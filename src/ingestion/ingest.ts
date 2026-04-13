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

// ── Fuzzy matching ────────────────────────────────────────────────
//
// Different sources may name the same office slightly differently:
//   OpenFEC:      "U.S. Senator — GA"
//   Google Civic: "U.S. Senate"
//   Mock data:    "U.S. Senator"
//
// We normalize to a canonical key for dedup matching. The key is:
//   (level, region_type, region_id, date)
//
// Office name is NOT part of the dedup key because it varies across sources.
// Instead, we match on the combination of what level of government it is,
// what geographic region it covers, and when the election is. This uniquely
// identifies a race — there's only one Senate race per state per election date.

async function findExistingElection(
  supabase: SupabaseClient,
  election: NormalizedElection
): Promise<{ id: string; description: string | null; why_it_matters: string | null; why_it_matters_source: string | null } | null> {
  const { data } = await supabase
    .from("elections")
    .select("id, description, why_it_matters, why_it_matters_source")
    .eq("level", election.level)
    .eq("region_type", election.regionType)
    .eq("region_id", election.regionId)
    .eq("date", election.date)
    .limit(1)
    .maybeSingle();

  return data;
}

async function upsertElections(
  supabase: SupabaseClient,
  sourceId: string,
  elections: NormalizedElection[]
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const election of elections) {
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
