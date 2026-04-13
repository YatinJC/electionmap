export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("elections")
    .select("region_type, region_id")
    .eq("status", "active");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Deduplicate and split by type
  const stateSet = new Set<string>();
  const countySet = new Set<string>();
  const districtSet = new Set<string>();

  for (const r of data ?? []) {
    if (r.region_type === "state") {
      stateSet.add(r.region_id);
    } else if (r.region_type === "county") {
      countySet.add(r.region_id);
      stateSet.add(r.region_id.substring(0, 2));
    } else if (r.region_type === "congressional_district") {
      districtSet.add(r.region_id);
      stateSet.add(r.region_id.substring(0, 2));
    }
  }

  return NextResponse.json({
    statesWithElections: Array.from(stateSet),
    countiesWithElections: Array.from(countySet),
    districtsWithElections: Array.from(districtSet),
  });
}
