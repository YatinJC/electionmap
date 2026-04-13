/**
 * Google Civic Information API Adapter
 *
 * Fetches election and contest data from Google's Civic Information API.
 * Coverage: federal + state + local races, but only for elections that are
 * currently active (typically 2-4 weeks before election day).
 *
 * API docs: https://developers.google.com/civic-information
 */

const API_BASE = "https://www.googleapis.com/civicinfo/v2";

function getApiKey() {
  return process.env.GOOGLE_CIVIC_API_KEY;
}

// State FIPS lookup
const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18",
  IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25",
  MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32",
  NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
  OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47",
  TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55",
  WY: "56", DC: "11",
};

// Representative addresses to sample in each state — one per state capital
const STATE_CAPITALS: Record<string, string> = {
  AL: "600 Dexter Ave, Montgomery, AL",
  AK: "120 4th St, Juneau, AK",
  AZ: "1700 W Washington St, Phoenix, AZ",
  AR: "500 Woodlane St, Little Rock, AR",
  CA: "1315 10th St, Sacramento, CA",
  CO: "200 E Colfax Ave, Denver, CO",
  CT: "210 Capitol Ave, Hartford, CT",
  DE: "411 Legislative Ave, Dover, DE",
  FL: "400 S Monroe St, Tallahassee, FL",
  GA: "206 Washington St SW, Atlanta, GA",
  HI: "415 S Beretania St, Honolulu, HI",
  ID: "700 W Jefferson St, Boise, ID",
  IL: "401 S 2nd St, Springfield, IL",
  IN: "200 W Washington St, Indianapolis, IN",
  IA: "1007 E Grand Ave, Des Moines, IA",
  KS: "300 SW 10th Ave, Topeka, KS",
  KY: "700 Capitol Ave, Frankfort, KY",
  LA: "900 3rd St, Baton Rouge, LA",
  ME: "230 State St, Augusta, ME",
  MD: "100 State Cir, Annapolis, MD",
  MA: "24 Beacon St, Boston, MA",
  MI: "100 N Capitol Ave, Lansing, MI",
  MN: "75 Rev Dr Martin Luther King Jr Blvd, St Paul, MN",
  MS: "400 High St, Jackson, MS",
  MO: "201 W Capitol Ave, Jefferson City, MO",
  MT: "1301 E 6th Ave, Helena, MT",
  NE: "1445 K St, Lincoln, NE",
  NV: "101 N Carson St, Carson City, NV",
  NH: "107 N Main St, Concord, NH",
  NJ: "125 W State St, Trenton, NJ",
  NM: "490 Old Santa Fe Trl, Santa Fe, NM",
  NY: "138 Eagle St, Albany, NY",
  NC: "1 E Edenton St, Raleigh, NC",
  ND: "600 E Boulevard Ave, Bismarck, ND",
  OH: "1 Capitol Sq, Columbus, OH",
  OK: "2300 N Lincoln Blvd, Oklahoma City, OK",
  OR: "900 Court St NE, Salem, OR",
  PA: "501 N 3rd St, Harrisburg, PA",
  RI: "82 Smith St, Providence, RI",
  SC: "1100 Gervais St, Columbia, SC",
  SD: "500 E Capitol Ave, Pierre, SD",
  TN: "600 Dr MLK Jr Blvd, Nashville, TN",
  TX: "1100 Congress Ave, Austin, TX",
  UT: "350 S State St, Salt Lake City, UT",
  VT: "115 State St, Montpelier, VT",
  VA: "1000 Bank St, Richmond, VA",
  WA: "416 Sid Snyder Ave SW, Olympia, WA",
  WV: "1900 Kanawha Blvd E, Charleston, WV",
  WI: "2 E Main St, Madison, WI",
  WY: "200 W 24th St, Cheyenne, WY",
};

interface CivicElection {
  id: string;
  name: string;
  electionDay: string;
  ocdDivisionId?: string;
}

interface CivicCandidate {
  name: string;
  party: string;
}

interface CivicContest {
  type: string;
  office: string;
  level?: string[];
  roles?: string[];
  district?: { name: string; scope: string; id: string };
  candidates?: CivicCandidate[];
}

export interface NormalizedElection {
  office: string;
  level: "federal" | "state" | "county" | "municipal" | "special_district";
  district: string;
  date: string;
  regionType: "state" | "county" | "congressional_district";
  regionId: string;
  candidates: {
    name: string;
    party: string;
    incumbent: boolean;
  }[];
}

function mapLevel(levels: string[] | undefined, roles: string[] | undefined, officeName?: string): NormalizedElection["level"] {
  if (roles?.includes("schoolBoard")) return "special_district";
  // Detect school districts and special districts by name
  if (officeName && /\b(ISD|school|board of education|water|utility|transit|fire|library)\b/i.test(officeName)) {
    return "special_district";
  }
  if (levels?.includes("country")) return "federal";
  if (levels?.includes("administrativeArea1")) return "state";
  if (levels?.includes("administrativeArea2")) return "county";
  if (levels?.includes("locality")) return "municipal";
  return "state";
}

function normalizeParty(party: string | undefined): string {
  if (!party) return "Unknown";
  if (party.includes("Democrat")) return "Democratic";
  if (party.includes("Republican")) return "Republican";
  if (party.includes("Libertarian")) return "Libertarian";
  if (party.includes("Green")) return "Green";
  if (party === "Nonpartisan") return "Nonpartisan";
  return party;
}

export async function fetchGoogleCivicElections(): Promise<NormalizedElection[]> {
  if (!getApiKey()) {
    console.error("GOOGLE_CIVIC_API_KEY not set, skipping");
    return [];
  }

  // 1. Get active elections
  console.log("Fetching active elections from Google Civic...");
  const electionsRes = await fetch(`${API_BASE}/elections?key=${getApiKey()}`);
  const electionsData = await electionsRes.json();
  const activeElections: CivicElection[] = (electionsData.elections || []).filter(
    (e: CivicElection) => e.id !== "2000" // Exclude test election
  );

  if (activeElections.length === 0) {
    console.log("  No active elections found");
    return [];
  }

  console.log(`  Found ${activeElections.length} active elections:`);
  for (const e of activeElections) {
    console.log(`    ${e.name} (${e.electionDay})`);
  }

  const elections: NormalizedElection[] = [];

  // 2. For each active election, query voterinfo with state capital addresses
  for (const election of activeElections) {
    console.log(`\n  Fetching contests for: ${election.name}...`);

    // Figure out which states this election covers from its name
    const stateMatches = Object.keys(STATE_CAPITALS).filter((abbr) => {
      const stateNames: Record<string, string> = {
        AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
        CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
        FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
        IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
        KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
        MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
        MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
        NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
        NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
        OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
        SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
        VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
        WI: "Wisconsin", WY: "Wyoming",
      };
      return election.name.includes(stateNames[abbr] || "NOMATCH");
    });

    if (stateMatches.length === 0) {
      console.log("    Could not determine state, skipping");
      continue;
    }

    for (const stateAbbr of stateMatches) {
      const address = STATE_CAPITALS[stateAbbr];
      if (!address) continue;

      const url = `${API_BASE}/voterinfo?key=${getApiKey()}&address=${encodeURIComponent(address)}&electionId=${election.id}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.log(`    ${stateAbbr}: no data (${res.status})`);
        continue;
      }

      const data = await res.json();
      const contests: CivicContest[] = data.contests || [];
      console.log(`    ${stateAbbr}: ${contests.length} contests`);

      const stateFips = STATE_FIPS[stateAbbr];
      if (!stateFips) continue;

      for (const contest of contests) {
        // Use office name, or fall back to district name, or skip
        const officeName = contest.office || contest.district?.name;
        if (!officeName) continue;

        const level = mapLevel(contest.level, contest.roles, officeName);

        elections.push({
          office: officeName,
          level,
          district: contest.district?.name || `${stateAbbr} ${officeName}`,
          date: election.electionDay,
          regionType: "state",
          regionId: stateFips,
          candidates: (contest.candidates || []).map((c) => ({
            name: c.name,
            party: normalizeParty(c.party),
            incumbent: false,
          })),
        });
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  console.log(`\n  → ${elections.length} elections from Google Civic`);
  return elections;
}
