export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const params = request.nextUrl.searchParams;
  const stateId = params.get("stateId");
  const countyId = params.get("countyId");
  const districtId = params.get("districtId");
  const months = parseInt(params.get("months") || "6", 10);
  const levels = params.get("levels"); // comma-separated: "federal,state,county"

  if (!stateId) {
    return NextResponse.json(
      { error: "stateId is required" },
      { status: 400 }
    );
  }

  // Calculate date window: today → today + N months
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + months);
  const todayStr = now.toISOString().split("T")[0];
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Build OR conditions for all applicable region types
  const conditions: string[] = [
    `and(region_type.eq.state,region_id.eq.${stateId})`,
  ];
  if (countyId) {
    conditions.push(`and(region_type.eq.county,region_id.eq.${countyId})`);
  }
  if (districtId) {
    conditions.push(`and(region_type.eq.congressional_district,region_id.eq.${districtId})`);
  }

  let query = supabase
    .from("elections")
    .select(`
      id, office, level, district, date, description,
      why_it_matters, why_it_matters_source, region_type, region_id,
      candidates (name, party, incumbent, website, description)
    `)
    .eq("status", "active")
    .gte("date", todayStr)
    .lte("date", cutoffStr)
    .or(conditions.join(","));

  if (levels) {
    query = query.in("level", levels.split(","));
  }

  const { data, error } = await query.order("date").order("level");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const elections = (data ?? []).map((e) => ({
    id: e.id,
    office: e.office,
    level: e.level,
    district: e.district,
    date: e.date,
    description: e.description,
    whyItMatters: e.why_it_matters,
    whyItMattersSource: e.why_it_matters_source,
    regionType: e.region_type,
    regionId: e.region_id,
    candidates: e.candidates ?? [],
  }));

  return NextResponse.json({ elections });
}
