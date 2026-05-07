export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import fs from "node:fs";
import path from "node:path";

interface GeoFeature extends Feature<Polygon | MultiPolygon> {
  id?: string | number;
  properties: Record<string, string>;
}

interface GeoIndex {
  states: GeoFeature[];
  countiesByState: Map<string, GeoFeature[]>;
  districtsByState: Map<string, GeoFeature[]>;
  sldUpperByState: Map<string, GeoFeature[]>;
  sldLowerByState: Map<string, GeoFeature[]>;
}

let geoCache: GeoIndex | null = null;

function readTopo(file: string): Topology {
  const p = path.join(process.cwd(), "public", "geo", file);
  return JSON.parse(fs.readFileSync(p, "utf8")) as Topology;
}

function loadGeo(): GeoIndex {
  if (geoCache) return geoCache;

  const statesTopo = readTopo("states-10m.json");
  const countiesTopo = readTopo("counties-10m.json");
  const districtsTopo = readTopo("districts-10m.json");
  const slduTopo = readTopo("sldu-10m.json");
  const sldlTopo = readTopo("sldl-10m.json");

  const statesFC = topojson.feature(statesTopo, statesTopo.objects.states);
  const countiesFC = topojson.feature(countiesTopo, countiesTopo.objects.counties);
  const districtsFC = topojson.feature(districtsTopo, Object.values(districtsTopo.objects)[0]);
  const slduFC = topojson.feature(slduTopo, Object.values(slduTopo.objects)[0]);
  const sldlFC = topojson.feature(sldlTopo, Object.values(sldlTopo.objects)[0]);

  const states = (statesFC as unknown as { features: GeoFeature[] }).features;
  const counties = (countiesFC as unknown as { features: GeoFeature[] }).features;
  const districts = (districtsFC as unknown as { features: GeoFeature[] }).features;
  const slduFeats = (slduFC as unknown as { features: GeoFeature[] }).features;
  const sldlFeats = (sldlFC as unknown as { features: GeoFeature[] }).features;

  const groupBy = (
    feats: GeoFeature[],
    keyFn: (f: GeoFeature) => string,
  ): Map<string, GeoFeature[]> => {
    const map = new Map<string, GeoFeature[]>();
    for (const f of feats) {
      const k = keyFn(f);
      const list = map.get(k);
      if (list) list.push(f);
      else map.set(k, [f]);
    }
    return map;
  };

  geoCache = {
    states,
    countiesByState: groupBy(counties, (c) => String(c.id).substring(0, 2)),
    districtsByState: groupBy(districts, (d) => d.properties.STATEFP),
    sldUpperByState: groupBy(slduFeats, (f) => f.properties.STATEFP),
    sldLowerByState: groupBy(sldlFeats, (f) => f.properties.STATEFP),
  };
  return geoCache;
}

function pip(features: GeoFeature[] | undefined, lat: number, lng: number): GeoFeature | null {
  if (!features) return null;
  const pt = turfPoint([lng, lat]);
  for (const f of features) {
    try {
      if (booleanPointInPolygon(pt, f)) return f;
    } catch {
      /* skip malformed */
    }
  }
  return null;
}

const VALID_LEVELS = new Set(["federal", "state", "county", "municipal", "special_district"]);

function sanitizeLevels(raw: string | null): string[] | null {
  if (!raw) return null;
  const filtered = raw.split(",").filter((l) => VALID_LEVELS.has(l));
  return filtered.length > 0 ? filtered : null;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = parseFloat(params.get("lat") ?? "");
  const lng = parseFloat(params.get("lng") ?? "");
  const months = Math.min(Math.max(parseInt(params.get("months") || "12", 10), 1), 48);
  const levels = sanitizeLevels(params.get("levels"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "lat and lng must be valid coordinates" }, { status: 400 });
  }

  const geo = loadGeo();
  const stateFeat = pip(geo.states, lat, lng);
  if (!stateFeat) {
    return NextResponse.json({ regionName: null, stateId: null, elections: [] });
  }

  const stateId = String(stateFeat.id);
  const stateName = stateFeat.properties.name;

  const countyFeat = pip(geo.countiesByState.get(stateId), lat, lng);
  const districtFeat = pip(geo.districtsByState.get(stateId), lat, lng);
  const slduFeat = pip(geo.sldUpperByState.get(stateId), lat, lng);
  const sldlFeat = pip(geo.sldLowerByState.get(stateId), lat, lng);

  const countyId = countyFeat ? String(countyFeat.id) : null;
  const countyName = countyFeat?.properties.name ?? null;
  const districtId = districtFeat?.properties.GEOID ?? null;
  const sldUpperId = slduFeat?.properties.GEOID ?? null;
  const sldLowerId = sldlFeat?.properties.GEOID ?? null;

  const regionName = countyName ? `${countyName}, ${stateName}` : stateName;

  // Build supabase OR conditions matching every region this point belongs to.
  // FIPS values come from our own topojson — safe to interpolate.
  const conditions: string[] = [
    `and(region_type.eq.nation,region_id.eq.US)`,
    `and(region_type.eq.state,region_id.eq.${stateId})`,
  ];
  if (countyId) conditions.push(`and(region_type.eq.county,region_id.eq.${countyId})`);
  if (districtId) conditions.push(`and(region_type.eq.congressional_district,region_id.eq.${districtId})`);
  if (sldUpperId) conditions.push(`and(region_type.eq.state_legislative_upper,region_id.eq.${sldUpperId})`);
  if (sldLowerId) conditions.push(`and(region_type.eq.state_legislative_lower,region_id.eq.${sldLowerId})`);

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() + months);
  const todayStr = now.toISOString().split("T")[0];
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const supabase = createClient();
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

  if (levels) query = query.in("level", levels);

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

  return NextResponse.json({
    regionName,
    stateId,
    stateName,
    countyId,
    countyName,
    districtId,
    sldUpperId,
    sldLowerId,
    elections,
  });
}
