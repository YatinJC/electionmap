/**
 * Open States Bulk Import
 *
 * Reads legislator data directly from the openstates/people GitHub repo
 * (cloned locally), bypassing API rate limits entirely.
 *
 * Usage:
 *   git clone --depth 1 https://github.com/openstates/people.git /tmp/openstates-people
 *   npm run ingest -- openstates-bulk
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { parse as parseYaml } from "yaml";

const REPO_PATH = "/tmp/openstates-people/data";
const ELECTION_DATE = "2026-11-03";

const STATE_FIPS: Record<string, string> = {
  al: "01", ak: "02", az: "04", ar: "05", ca: "06", co: "08", ct: "09",
  de: "10", fl: "12", ga: "13", hi: "15", id: "16", il: "17", in: "18",
  ia: "19", ks: "20", ky: "21", la: "22", me: "23", md: "24", ma: "25",
  mi: "26", mn: "27", ms: "28", mo: "29", mt: "30", ne: "31", nv: "32",
  nh: "33", nj: "34", nm: "35", ny: "36", nc: "37", nd: "38", oh: "39",
  ok: "40", or: "41", pa: "42", ri: "44", sc: "45", sd: "46", tn: "47",
  tx: "48", ut: "49", vt: "50", va: "51", wa: "53", wv: "54", wi: "55",
  wy: "56", dc: "11",
};

const STATE_NAMES: Record<string, string> = {
  al: "Alabama", ak: "Alaska", az: "Arizona", ar: "Arkansas", ca: "California",
  co: "Colorado", ct: "Connecticut", de: "Delaware", fl: "Florida", ga: "Georgia",
  hi: "Hawaii", id: "Idaho", il: "Illinois", in: "Indiana", ia: "Iowa",
  ks: "Kansas", ky: "Kentucky", la: "Louisiana", me: "Maine", md: "Maryland",
  ma: "Massachusetts", mi: "Michigan", mn: "Minnesota", ms: "Mississippi",
  mo: "Missouri", mt: "Montana", ne: "Nebraska", nv: "Nevada", nh: "New Hampshire",
  nj: "New Jersey", nm: "New Mexico", ny: "New York", nc: "North Carolina",
  nd: "North Dakota", oh: "Ohio", ok: "Oklahoma", or: "Oregon", pa: "Pennsylvania",
  ri: "Rhode Island", sc: "South Carolina", sd: "South Dakota", tn: "Tennessee",
  tx: "Texas", ut: "Utah", vt: "Vermont", va: "Virginia", wa: "Washington",
  wv: "West Virginia", wi: "Wisconsin", wy: "Wyoming", dc: "District of Columbia",
};

export interface NormalizedElection {
  office: string;
  level: "state";
  district: string;
  date: string;
  regionType: "state" | "state_legislative_upper" | "state_legislative_lower";
  regionId: string;
  candidates: {
    name: string;
    party: string;
    incumbent: boolean;
  }[];
}

interface LegislatorYaml {
  name: string;
  party: { name: string }[];
  roles: {
    type: string; // "upper" or "lower"
    district: string;
    jurisdiction: string;
  }[];
}

export async function fetchStateLegislatureBulk(): Promise<NormalizedElection[]> {
  if (!existsSync(REPO_PATH)) {
    console.error(`Open States repo not found at ${REPO_PATH}`);
    console.error("Run: git clone --depth 1 https://github.com/openstates/people.git /tmp/openstates-people");
    return [];
  }

  const stateDirs = readdirSync(REPO_PATH).filter(
    (d) => STATE_FIPS[d] !== undefined
  );

  console.log(`  Found ${stateDirs.length} states in bulk data`);

  // Group legislators by (state, chamber, district) to create one election per seat
  const elections = new Map<string, NormalizedElection>();

  for (const stateAbbr of stateDirs) {
    const legDir = join(REPO_PATH, stateAbbr, "legislature");
    if (!existsSync(legDir)) continue;

    const files = readdirSync(legDir).filter((f) => f.endsWith(".yml"));
    const stateFips = STATE_FIPS[stateAbbr];
    const stateName = STATE_NAMES[stateAbbr] || stateAbbr.toUpperCase();
    const stateUpper = stateAbbr.toUpperCase();

    let count = 0;
    for (const file of files) {
      try {
        const raw = readFileSync(join(legDir, file), "utf-8");
        const person: LegislatorYaml = parseYaml(raw);

        // Get current role (most recent)
        const currentRole = person.roles?.[0];
        if (!currentRole) continue;

        const party = person.party?.[0]?.name || "Unknown";
        const chamber = currentRole.type; // "upper" or "lower"
        const dist = currentRole.district;

        const isNebraska = stateAbbr === "ne";
        const chamberLabel = chamber === "upper"
          ? (isNebraska ? "Legislature" : "Senate")
          : "House";
        const roleLabel = chamber === "upper"
          ? "Senator"
          : (isNebraska ? "Senator" : "Representative");

        const office = `State ${roleLabel} — ${stateUpper} District ${dist}`;
        const key = `${stateAbbr}:${chamber}:${dist}`;

        // Build Census-compatible GEOID: state FIPS + district padded to 3 digits
        // e.g. GA Senate District 12 → "13" + "012" → "13012"
        const distPadded = dist.replace(/[^0-9A-Za-z]/g, "").padStart(3, "0");
        const geoid = `${stateFips}${distPadded}`;
        const regionType = chamber === "upper" ? "state_legislative_upper" : "state_legislative_lower";

        if (!elections.has(key)) {
          elections.set(key, {
            office,
            level: "state",
            district: `${stateName} ${chamberLabel} District ${dist}`,
            date: ELECTION_DATE,
            regionType: regionType as "state_legislative_upper" | "state_legislative_lower",
            regionId: geoid,
            candidates: [],
          });
        }

        // Add this legislator as incumbent candidate
        elections.get(key)!.candidates.push({
          name: person.name,
          party,
          incumbent: true,
        });

        count++;
      } catch {
        // Skip malformed files
      }
    }

    process.stdout.write(`\r  [${stateDirs.indexOf(stateAbbr) + 1}/${stateDirs.length}] ${stateName}: ${count} legislators`);
  }

  console.log(`\n  → ${elections.size} state legislature seats from bulk data`);
  return Array.from(elections.values());
}
