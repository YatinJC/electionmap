/**
 * Core ingestion logic — shared by the CLI script and the cron API route.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchAllFederalElections } from "./adapters/openfec";
import { fetchStateLegislatureElections } from "./adapters/openstates";
import { fetchGoogleCivicElections } from "./adapters/google-civic";
import { fetchStateLegislatureBulk } from "./adapters/openstates-bulk";

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


async function upsertElections(
  supabase: SupabaseClient,
  sourceId: string,
  elections: NormalizedElection[]
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  // ── Phase 1: Pre-fetch all existing elections in bulk ───────────
  // One query instead of one per election.
  console.log(`  Loading existing elections from DB...`);
  const { data: allExisting } = await supabase
    .from("elections")
    .select("id, office, level, region_type, region_id, date, description, why_it_matters, why_it_matters_source")
    .eq("status", "active");

  // Build a lookup index: key → existing election
  const existingIndex = new Map<string, ExistingElection>();
  for (const e of allExisting ?? []) {
    // Index by exact match key
    const exactKey = `${e.level}|${e.region_type}|${e.region_id}|${e.date}|${e.office}`;
    existingIndex.set(exactKey, e);
    // Also index by fuzzy key (without office) for cross-source matching
    const fuzzyKey = `${e.level}|${e.region_type}|${e.region_id}|${e.date}`;
    if (!existingIndex.has(fuzzyKey)) {
      existingIndex.set(fuzzyKey, e);
    }
  }
  console.log(`  Found ${allExisting?.length ?? 0} existing elections`);

  // ── Phase 2: Classify each incoming election ────────────────────
  const toCreate: NormalizedElection[] = [];
  const toUpdate: { election: NormalizedElection; existingId: string }[] = [];

  for (const election of elections) {
    // Try exact match first
    const exactKey = `${election.level}|${election.regionType}|${election.regionId}|${election.date}|${election.office}`;
    let match = existingIndex.get(exactKey);

    // Try fuzzy match
    if (!match) {
      const candidates = (allExisting ?? []).filter(
        (e) => e.level === election.level && e.region_type === election.regionType && e.region_id === election.regionId && e.date === election.date
      );
      match = candidates.find((c) => officeNamesMatch(election.office, c.office));
    }

    if (match) {
      toUpdate.push({ election, existingId: match.id });
    } else {
      toCreate.push(election);
    }
  }

  console.log(`  To create: ${toCreate.length}, To update: ${toUpdate.length}`);

  // ── Phase 3: Batch insert new elections ─────────────────────────
  const BATCH_SIZE = 50;

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  Inserting ${Math.min(i + BATCH_SIZE, toCreate.length)}/${toCreate.length}...`);

    const { data: inserted, error } = await supabase
      .from("elections")
      .insert(
        batch.map((e) => ({
          office: e.office,
          level: e.level,
          district: e.district,
          date: e.date,
          description: null,
          why_it_matters: null,
          why_it_matters_source: null,
          region_type: e.regionType,
          region_id: e.regionId,
          status: "active",
        }))
      )
      .select("id");

    if (error || !inserted) {
      skipped += batch.length;
      continue;
    }

    // Insert candidates for new elections
    const candidateRows: { election_id: string; name: string; party: string; incumbent: boolean }[] = [];
    const provenanceRows: { election_id: string; source_id: string; confidence: number; fetched_at: string }[] = [];

    for (let j = 0; j < inserted.length; j++) {
      const elId = inserted[j].id;
      const el = batch[j];
      for (const c of el.candidates) {
        candidateRows.push({ election_id: elId, name: c.name, party: c.party, incumbent: c.incumbent });
      }
      provenanceRows.push({ election_id: elId, source_id: sourceId, confidence: 90, fetched_at: new Date().toISOString() });
    }

    if (candidateRows.length > 0) {
      await supabase.from("candidates").insert(candidateRows);
    }
    if (provenanceRows.length > 0) {
      await supabase.from("election_sources").upsert(provenanceRows, { onConflict: "election_id,source_id" });
    }

    created += inserted.length;
  }

  if (toCreate.length > 0) console.log();

  // ── Phase 4: Batch update existing elections ────────────────────
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    process.stdout.write(`\r  Updating ${Math.min(i + BATCH_SIZE, toUpdate.length)}/${toUpdate.length}...`);

    // Updates must be done per-row (Supabase doesn't support bulk update with different values)
    // but we can parallelize them
    await Promise.all(
      batch.map(async ({ election, existingId }) => {
        await supabase
          .from("elections")
          .update({ office: election.office, district: election.district, updated_at: new Date().toISOString() })
          .eq("id", existingId);

        // Refresh candidates
        if (election.candidates.length > 0) {
          await supabase.from("candidates").delete().eq("election_id", existingId);
          await supabase.from("candidates").insert(
            election.candidates.map((c) => ({
              election_id: existingId,
              name: c.name,
              party: c.party,
              incumbent: c.incumbent,
            }))
          );
        }

        await supabase.from("election_sources").upsert(
          { election_id: existingId, source_id: sourceId, confidence: 90, fetched_at: new Date().toISOString() },
          { onConflict: "election_id,source_id" }
        );
      })
    );

    updated += batch.length;
  }

  if (toUpdate.length > 0) console.log();

  console.log(`  Done: ${created} created, ${updated} updated, ${skipped} skipped`);
  return { created, updated, skipped };
}

export type Adapter = "openfec" | "openstates" | "openstates-bulk" | "google-civic";

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

  // Open States bulk import — reads from cloned GitHub repo, no API rate limits
  if (adapters?.includes("openstates-bulk")) {
    try {
      const sourceId = await ensureSource(supabase, "openstates", 85);
      const elections = await fetchStateLegislatureBulk();
      const r = await upsertElections(supabase, sourceId, elections);
      results.push({ source: "openstates-bulk", ...r });
    } catch (err) {
      results.push({ source: "openstates-bulk", created: 0, updated: 0, skipped: 0, error: String(err) });
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
