/**
 * Fix malformed GEOIDs for state legislative districts.
 *
 * States like MA, NH, VT, DC, and ME use named districts that don't
 * directly convert to Census GEOIDs with simple padding. This script
 * matches Open States district names to Census boundary NAMEs and
 * updates the region_id in the database.
 *
 * Usage: npx tsx src/ingestion/fix-geoids.ts
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { parse as parseJson } from "json5";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Load Census boundary data
function loadCensusDistricts(filePath: string): Map<string, string> {
  const topo = JSON.parse(readFileSync(filePath, "utf-8"));
  const obj = Object.values(topo.objects)[0] as any;
  // Map: "STATEFP_normalizedName" → GEOID
  // Index by both normal and aggressive normalization
  const map = new Map<string, string>();
  for (const g of obj.geometries) {
    const st = g.properties.STATEFP;
    const name = g.properties.NAME;
    map.set(st + "_" + normalize(name), g.properties.GEOID);
    map.set(st + "_" + normalizeAggressive(name), g.properties.GEOID);
  }
  return map;
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Also strip "and" since Census uses hyphens while Open States uses "and"
function normalizeAggressive(name: string): string {
  return name.toLowerCase().replace(/\band\b/g, "").replace(/[^a-z0-9]/g, "");
}

function generateVariants(name: string): string[] {
  const variants = new Set<string>();
  variants.add(normalize(name));
  variants.add(normalizeAggressive(name));

  // Try padding trailing numbers to 2 digits
  const match = name.match(/^(.+?)(\d+)$/);
  if (match) {
    const prefix = normalize(match[1]);
    const prefixAgg = normalizeAggressive(match[1]);
    const num = match[2].padStart(2, "0");
    variants.add(prefix + num);
    variants.add(prefixAgg + num);
  }

  return [...variants];
}

async function run() {
  const censusLower = loadCensusDistricts("public/geo/sldl-10m.json");
  const censusUpper = loadCensusDistricts("public/geo/sldu-10m.json");

  console.log(`Census lower districts: ${censusLower.size}`);
  console.log(`Census upper districts: ${censusUpper.size}`);

  // Fetch all malformed elections
  let page = 0;
  const toFix: { id: string; regionType: string; regionId: string; office: string }[] = [];

  while (true) {
    const { data } = await sb
      .from("elections")
      .select("id, office, region_type, region_id")
      .in("region_type", ["state_legislative_upper", "state_legislative_lower"])
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    for (const e of data) {
      if (!/^[0-9A-Z]{4,6}$/i.test(e.region_id)) {
        toFix.push(e);
      }
    }
    if (data.length < 1000) break;
    page++;
  }

  console.log(`\nMalformed GEOIDs to fix: ${toFix.length}`);

  let fixed = 0;
  let notFound = 0;
  const unfixable: string[] = [];

  for (const e of toFix) {
    const stateFips = e.region_id.substring(0, 2);
    const distPart = e.region_id.substring(2);
    const census = e.region_type === "state_legislative_upper" ? censusUpper : censusLower;

    // Try matching
    let newGeoid: string | null = null;
    const variants = generateVariants(distPart);

    for (const v of variants) {
      const key = stateFips + "_" + v;
      if (census.has(key)) {
        newGeoid = census.get(key)!;
        break;
      }
    }

    if (newGeoid && newGeoid !== e.region_id) {
      await sb.from("elections").update({ region_id: newGeoid }).eq("id", e.id);
      fixed++;
    } else if (!newGeoid) {
      notFound++;
      if (unfixable.length < 20) {
        unfixable.push(`${e.office} | ${e.region_id}`);
      }
    }
  }

  console.log(`\nFixed: ${fixed}`);
  console.log(`Not found in Census: ${notFound}`);
  if (unfixable.length > 0) {
    console.log("\nSample unfixable:");
    unfixable.forEach((u) => console.log(`  ${u}`));
  }
}

run().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
