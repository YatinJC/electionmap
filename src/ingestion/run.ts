/**
 * Ingestion runner
 *
 * Fetches data from all adapters, reconciles with existing DB records,
 * and upserts into Supabase.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllFederalElections,
  type NormalizedElection,
} from "./adapters/openfec";

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key);

  // 1. Ensure data source exists
  const { data: source } = await supabase
    .from("data_sources")
    .upsert(
      { name: "openfec", source_type: "api", reliability: 90 },
      { onConflict: "name" }
    )
    .select()
    .single();

  if (!source) throw new Error("Failed to create/find data source");

  // 2. Fetch from adapters
  console.log("\n=== Fetching from OpenFEC ===");
  const elections = await fetchAllFederalElections();

  // 3. Upsert into database
  console.log("\n=== Upserting into database ===");
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const election of elections) {
    // Check if this election already exists (match on office + region + date)
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
      // Update existing — keep human-written descriptions, update candidates
      electionId = existing.id;
      updated++;
    } else {
      // Insert new election
      const { data: inserted, error } = await supabase
        .from("elections")
        .insert({
          office: election.office,
          level: election.level,
          district: election.district,
          date: election.date,
          description: null,  // Will be filled by AI or volunteers
          why_it_matters: null,
          why_it_matters_source: null,
          region_type: election.regionType,
          region_id: election.regionId,
          status: "active",
        })
        .select()
        .single();

      if (error) {
        console.error(`  Failed: ${election.office}:`, error.message);
        skipped++;
        continue;
      }
      electionId = inserted!.id;
      created++;
    }

    // Refresh candidates: delete old ones and insert new
    await supabase
      .from("candidates")
      .delete()
      .eq("election_id", electionId);

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
    await supabase
      .from("election_sources")
      .upsert(
        {
          election_id: electionId,
          source_id: source.id,
          confidence: 90,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "election_id,source_id" }
      );
  }

  console.log(`\nDone! Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`);
  console.log(`Total federal elections in DB: ${created + updated}`);
}

run().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
