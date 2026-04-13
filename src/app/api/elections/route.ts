export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// ── Input validation ──────────────────────────────────────────────

function isValidFips(code: string | null): code is string {
  // FIPS codes are 2-5 digit numeric strings
  return code !== null && /^\d{2,5}$/.test(code);
}

const VALID_LEVELS = new Set([
  "federal", "state", "county", "municipal", "special_district",
]);

function sanitizeLevels(raw: string | null): string[] | null {
  if (!raw) return null;
  const filtered = raw.split(",").filter((l) => VALID_LEVELS.has(l));
  return filtered.length > 0 ? filtered : null;
}

// ── Route handler ─────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const params = request.nextUrl.searchParams;
  const stateId = params.get("stateId");
  const countyId = params.get("countyId");
  const districtId = params.get("districtId");
  const months = Math.min(Math.max(parseInt(params.get("months") || "6", 10), 1), 48);
  const levels = sanitizeLevels(params.get("levels"));

  if (!isValidFips(stateId)) {
    return NextResponse.json(
      { error: "stateId must be a 2-5 digit FIPS code" },
      { status: 400 }
    );
  }

  if (countyId !== null && !isValidFips(countyId)) {
    return NextResponse.json(
      { error: "countyId must be a valid FIPS code" },
      { status: 400 }
    );
  }

  if (districtId !== null && !isValidFips(districtId)) {
    return NextResponse.json(
      { error: "districtId must be a valid FIPS code" },
      { status: 400 }
    );
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + months);
  const todayStr = now.toISOString().split("T")[0];
  const cutoffStr = cutoff.toISOString().split("T")[0];

  // Build query using Supabase's parameterized methods where possible.
  // The .or() filter still uses string syntax but inputs are now validated
  // to be numeric-only FIPS codes, preventing injection.
  // Always include statewide elections for this state.
  // The frontend resolves the exact county and district at the mouse position
  // via point-in-polygon, so only the relevant local elections are fetched.
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
    query = query.in("level", levels);
  }

  const { data, error } = await query.order("date").order("level").limit(500);

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
