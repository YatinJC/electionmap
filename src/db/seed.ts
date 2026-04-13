import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { elections as mockElections } from "../data/mock-elections";

async function seed() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env or .env.local"
    );
  }

  // Service role client bypasses RLS
  const supabase = createClient(url, serviceKey);

  console.log("Seeding database...");

  // 1. Create data source
  const { data: source, error: sourceErr } = await supabase
    .from("data_sources")
    .upsert({ name: "manual_seed", source_type: "manual", reliability: 80 }, { onConflict: "name" })
    .select()
    .single();

  if (sourceErr) throw new Error(`Data source error: ${sourceErr.message}`);
  console.log(`Data source: manual_seed (${source.id})`);

  // 2. Insert elections and candidates
  let electionCount = 0;
  let candidateCount = 0;

  for (const mock of mockElections) {
    const { data: election, error: elErr } = await supabase
      .from("elections")
      .insert({
        office: mock.office,
        level: mock.level,
        district: mock.district,
        date: mock.date,
        description: mock.description,
        why_it_matters: mock.whyItMatters,
        why_it_matters_source: "manual",
        region_type: mock.regionType,
        region_id: mock.regionId,
        status: "active",
      })
      .select()
      .single();

    if (elErr) {
      console.error(`Failed to insert ${mock.office}:`, elErr.message);
      continue;
    }
    electionCount++;

    // Insert candidates
    for (const c of mock.candidates) {
      const { error: cErr } = await supabase.from("candidates").insert({
        election_id: election.id,
        name: c.name,
        party: c.party,
        incumbent: c.incumbent,
        website: c.website ?? null,
        description: c.description ?? null,
      });
      if (cErr) {
        console.error(`  Failed candidate ${c.name}:`, cErr.message);
      } else {
        candidateCount++;
      }
    }

    // Track provenance
    await supabase.from("election_sources").insert({
      election_id: election.id,
      source_id: source.id,
      confidence: 80,
    });
  }

  console.log(`Inserted ${electionCount} elections and ${candidateCount} candidates`);
  console.log("Seed complete!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
