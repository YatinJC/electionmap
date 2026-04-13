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

async function upsertElections(
  supabase: SupabaseClient,
  sourceId: string,
  elections: NormalizedElection[]
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const election of elections) {
    const { data: existing } = await supabase
      .from("elections")
      .select("id")
      .eq("office", election.office)
      .eq("region_type", election.regionType)
      .eq("region_id", election.regionId)
      .eq("date", election.date)
      .limit(1)
      .maybeSingle();

    let electionId: string;

    if (existing) {
      electionId = existing.id;
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

    // Refresh candidates
    await supabase.from("candidates").delete().eq("election_id", electionId);
    if (election.candidates.length > 0) {
      await supabase.from("candidates").insert(
        election.candidates.map((c) => ({
          election_id: electionId,
          name: c.name,
          party: c.party,
          incumbent: c.incumbent,
        }))
      );
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

  // ── OpenFEC ──────────────────────────────────────────────────────
  if (runAll || adapters?.includes("openfec")) {
    try {
      const sourceId = await ensureSource(supabase, "openfec", 90);
      const elections = await fetchAllFederalElections();
      const r = await upsertElections(supabase, sourceId, elections);
      results.push({ source: "openfec", ...r });
    } catch (err) {
      results.push({
        source: "openfec",
        created: 0,
        updated: 0,
        skipped: 0,
        error: String(err),
      });
    }
  }

  // ── Open States ──────────────────────────────────────────────────
  if (runAll || adapters?.includes("openstates")) {
    try {
      const sourceId = await ensureSource(supabase, "openstates", 85);
      const elections = await fetchStateLegislatureElections();
      const r = await upsertElections(supabase, sourceId, elections);
      results.push({ source: "openstates", ...r });
    } catch (err) {
      results.push({
        source: "openstates",
        created: 0,
        updated: 0,
        skipped: 0,
        error: String(err),
      });
    }
  }

  // ── Google Civic ─────────────────────────────────────────────────
  if (runAll || adapters?.includes("google-civic")) {
    try {
      const sourceId = await ensureSource(supabase, "google_civic", 95);
      const elections = await fetchGoogleCivicElections();
      const r = await upsertElections(supabase, sourceId, elections);
      results.push({ source: "google-civic", ...r });
    } catch (err) {
      results.push({
        source: "google-civic",
        created: 0,
        updated: 0,
        skipped: 0,
        error: String(err),
      });
    }
  }

  return results;
}
