export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const VALID_LEVELS = new Set([
  "federal", "state", "county", "municipal", "special_district",
]);

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const params = request.nextUrl.searchParams;
  const months = Math.min(Math.max(parseInt(params.get("months") || "6", 10), 1), 48);
  const levelsRaw = params.get("levels");
  const levels = levelsRaw
    ? levelsRaw.split(",").filter((l) => VALID_LEVELS.has(l))
    : null;

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + months);
  const todayStr = now.toISOString().split("T")[0];
  const cutoffStr = cutoff.toISOString().split("T")[0];

  let query = supabase
    .from("elections")
    .select("region_type, region_id")
    .eq("status", "active")
    .gte("date", todayStr)
    .lte("date", cutoffStr);

  if (levels && levels.length > 0) {
    query = query.in("level", levels);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
