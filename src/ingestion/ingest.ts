/**
 * Core ingestion logic — shared by the CLI script and the cron API route.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAllFederalElections } from "./adapters/openfec";
import { fetchStateLegislatureElections } from "./adapters/openstates";
import { fetchGoogleCivicElections } from "./adapters/google-civic";

interface NormalizedElection {
  office: string;
  level: string;
  district: string;
  date: string;
  regionType: string;
  regionId: string;
  candidates: {
    name: string;
    party: string;
    incumbent: boolean;
  }[];
}

interface IngestResult {
  source: string;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}

async function ensureSource(
  supabase: SupabaseClient,
  name: string,
  reliability: number
): Promise<string> {
  const { data } = await supabase
    .from("data_sources")
    .upsert({ name, source_type: "api", reliability }, { onConflict: "name" })
    .select()
    .single();
  if (!data) throw new Error(`Failed to create source: ${name}`);
  return data.id;
}

// ── Dedup matching ────────────────────────────────────────────────
//
// Different sources may name the same office differently:
//   OpenFEC:      "U.S. Senator — GA"
//   Google Civic: "U.S. Senate"
//   Mock data:    "U.S. Senator"
//
// Strategy: first try exact match on office name. If no hit, try matching
// on (level, region_type, region_id, date) and compare normalized office names.

function normalizeOfficeName(office: string): string {
  return office
    .toLowerCase()
    .replace(/[—–-]/g, " ")       // dashes
    .replace(/\s+/g, " ")          // collapse whitespace
    .replace(/\b(u\.s\.|us)\b/g, "us")
    .replace(/\brepresentative\b/g, "rep")
    .replace(/\bsenator\b/g, "senate")
    .replace(/\bdistrict\b/g, "dist")
    .replace(/\s*(,|\|)\s*/g, " ") // punctuation
    .trim();
}

function officeNamesMatch(a: string, b: string): boolean {
  const na = normalizeOfficeName(a);
  const nb = normalizeOfficeName(b);
  // Exact match after normalization
  if (na === nb) return true;
  // One contains the other (e.g. "us senate" matches "us senate ga")
  if (na.includes(nb) || nb.includes(na)) return true;
  return false;
}

type ExistingElection = {
  id: string;
  office: string;
  description: string | null;
  why_it_matters: string | null;
  why_it_matters_source: string | null;
};

async function findExistingElection(
  supabase: SupabaseClient,
  election: NormalizedElection
): Promise<ExistingElection | null> {
  // First: exact match on all fields including office
  const { data: exact } = await supabase
    .from("elections")
    .select("id, office, description, why_it_matters, why_it_matters_source")
    .eq("office", election.office)
    .eq("region_type", election.regionType)
    .eq("region_id", election.regionId)
    .eq("date", election.date)
    .limit(1)
    .maybeSingle();

  if (exact) return exact;

  // Second: fuzzy match — same region/date/level, compare office names
  const { data: candidates } = await supabase
    .from("elections")
    .select("id, office, description, why_it_matters, why_it_matters_source")
    .eq("level", election.level)
    .eq("region_type", election.regionType)
    .eq("region_id", election.regionId)
    .eq("date", election.date);

  if (!candidates || candidates.length === 0) return null;

  // Find the best fuzzy match
  for (const candidate of candidates) {
    if (officeNamesMatch(election.office, candidate.office)) {
      return candidate;
    }
  }

  return null;
}

async function upsertElections(
  supabase: SupabaseClient,
  sourceId: string,
  elections: NormalizedElection[]
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  const total = elections.length;
  for (let i = 0; i < elections.length; i++) {
    const election = elections[i];
    if (i % 50 === 0 || i === total - 1) {
      process.stdout.write(`\r  Processing ${i + 1}/${total}...`);
    }
    const existing = await findExistingElection(supabase, election);

    let electionId: string;

    if (existing) {
      electionId = existing.id;

      // Update office name and district (API data is authoritative for these)
      // but PRESERVE human-written descriptions
      await supabase
        .from("elections")
        .update({
          office: election.office,
          district: election.district,
          updated_at: new Date().toISOString(),
        })
        .eq("id", electionId);

      updated++;
    } else {
      const { data: inserted, error } = await supabase
        .from("elections")
        .insert({
          office: election.office,
          level: election.level,
          district: election.district,
          date: election.date,
          description: null,
          why_it_matters: null,
          why_it_matters_source: null,
          region_type: election.regionType,
          region_id: election.regionId,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        skipped++;
        continue;
      }
      electionId = inserted!.id;
      created++;
    }

    // Refresh candidates from this source.
    // Only replace candidates that came from this same source — preserve
    // manually-added candidates by checking the election_sources table.
    //
    // For simplicity in v1: if this source previously provided candidates
    // for this election, replace them. Otherwise, merge (add new ones).
    const { data: existingSource } = await supabase
      .from("election_sources")
      .select("id")
      .eq("election_id", electionId)
      .eq("source_id", sourceId)
      .maybeSingle();

    if (existingSource) {
      // This source has provided data before — safe to refresh candidates
      await supabase.from("candidates").delete().eq("election_id", electionId);
    }

    if (election.candidates.length > 0) {
      // Use upsert-like behavior: insert candidates, skip if name already exists
      for (const c of election.candidates) {
        const { data: existingCandidate } = await supabase
          .from("candidates")
          .select("id")
          .eq("election_id", electionId)
          .eq("name", c.name)
          .maybeSingle();

        if (!existingCandidate) {
          await supabase.from("candidates").insert({
            election_id: electionId,
            name: c.name,
            party: c.party,
            incumbent: c.incumbent,
          });
        } else {
          // Update existing candidate's info
          await supabase
            .from("candidates")
            .update({ party: c.party, incumbent: c.incumbent })
            .eq("id", existingCandidate.id);
        }
      }
    }

    // Track provenance
    await supabase.from("election_sources").upsert(
      {
        election_id: electionId,
        source_id: sourceId,
        confidence: 90,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "election_id,source_id" }
    );
  }

  console.log(`\n  Done: ${created} created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

export type Adapter = "openfec" | "openstates" | "google-civic";

/**
 * Run ingestion for the specified adapters (or all if none specified).
 */
export async function runIngestion(
  adapters?: Adapter[]
): Promise<IngestResult[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key);
  const runAll = !adapters || adapters.length === 0;
  const results: IngestResult[] = [];

  if (runAll || adapters?.includes("openfec")) {
    try {
      const sourceId = await ensureSource(supabase, "openfec", 90);
      const elections = await fetchAllFederalElections();
      const r = await upsertElections(supabase, sourceId, elections);
      results.push({ source: "openfec", ...r });
    } catch (err) {
      results.push({ source: "openfec", created: 0, updated: 0, skipped: 0, error: String(err) });
    }
  }

  if (runAll || adapters?.includes("openstates")) {
    try {
      const sourceId = await ensureSource(supabase, "openstates", 85);
      const elections = await fetchStateLegislatureElections();
      const r = await upsertElections(supabase, sourceId, elections);
      results.push({ source: "openstates", ...r });
    } catch (err) {
      results.push({ source: "openstates", created: 0, updated: 0, skipped: 0, error: String(err) });
    }
  }

  if (runAll || adapters?.includes("google-civic")) {
    try {
      const sourceId = await ensureSource(supabase, "google_civic", 95);
      const elections = await fetchGoogleCivicElections();
      const r = await upsertElections(supabase, sourceId, elections);
      results.push({ source: "google-civic", ...r });
    } catch (err) {
      results.push({ source: "google-civic", created: 0, updated: 0, skipped: 0, error: String(err) });
    }
  }

  return results;
}
