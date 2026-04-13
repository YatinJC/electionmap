/**
 * Open States Adapter
 *
 * Fetches state legislature data from the Open States API (v3).
 * Coverage: current state senators and representatives for all 50 states + DC.
 * These are the incumbents — effectively the baseline for 2026 state legislative races.
 *
 * API docs: https://docs.openstates.org/api-v3/
 */

const API_BASE = "https://v3.openstates.org";
const ELECTION_DATE = "2026-11-03";
const PER_PAGE = 50;

function getApiKey() {
  return process.env.OPEN_STATES_API_KEY;
}

// State abbreviation to FIPS
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

// Extract state abbreviation from OCD jurisdiction ID
function stateFromJurisdiction(jid: string): string | null {
  const match = jid.match(/state:(\w{2})/);
  return match ? match[1] : null;
}

interface OpenStatesPerson {
  name: string;
  party: string;
  current_role: {
    title: string;
    district: string;
    org_classification: string; // "upper" or "lower"
  } | null;
  jurisdiction: { id: string; name: string };
}

export interface NormalizedElection {
  office: string;
  level: "state";
  district: string;
  date: string;
  regionType: "state";
  regionId: string;
  candidates: {
    name: string;
    party: string;
    incumbent: boolean;
  }[];
}

async function fetchPeople(
  chamber: "upper" | "lower",
  stateJurisdiction: string
): Promise<OpenStatesPerson[]> {
  const results: OpenStatesPerson[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${API_BASE}/people?jurisdiction=${encodeURIComponent(stateJurisdiction)}&org_classification=${chamber}&apikey=${getApiKey()}&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  Open States error (${chamber} page ${page}):`, res.status);
      break;
    }
    const data = await res.json();
    results.push(...data.results);
    hasMore = page < data.pagination.max_page;
    page++;
    // Rate limit — Open States free tier is strict
    await new Promise((r) => setTimeout(r, 2000));
  }

  return results;
}

function normalizeParty(party: string): string {
  if (party === "Democratic") return "Democratic";
  if (party === "Republican") return "Republican";
  if (party === "Independent") return "Independent";
  if (party === "Libertarian") return "Libertarian";
  return party;
}

export async function fetchStateLegislatureElections(): Promise<NormalizedElection[]> {
  if (!getApiKey()) {
    console.error("OPEN_STATES_API_KEY not set, skipping");
    return [];
  }

  // 1. Get all state jurisdictions
  console.log("Fetching state jurisdictions...");
  const jRes = await fetch(
    `${API_BASE}/jurisdictions?classification=state&per_page=52&apikey=${getApiKey()}`
  );
  const jData = await jRes.json();
  const jurisdictions: { id: string; name: string }[] = jData.results;
  console.log(`  Found ${jurisdictions.length} states`);

  const elections: NormalizedElection[] = [];
  const totalStates = jurisdictions.length;

  for (let si = 0; si < jurisdictions.length; si++) {
    const jurisdiction = jurisdictions[si];
    const stateAbbr = stateFromJurisdiction(jurisdiction.id);
    if (!stateAbbr) continue;
    const stateFips = STATE_FIPS[stateAbbr];
    if (!stateFips) continue;

    const stateUpper = stateAbbr.toUpperCase();
    console.log(`  [${si + 1}/${totalStates}] ${jurisdiction.name}...`);

    // 2. Fetch upper chamber (Senate)
    const senators = await fetchPeople("upper", jurisdiction.id);

    // Group senators by district → one election per district
    for (const person of senators) {
      if (!person.current_role) continue;
      const dist = person.current_role.district;
      elections.push({
        office: `State Senator — ${stateUpper} District ${dist}`,
        level: "state",
        district: `${jurisdiction.name} Senate District ${dist}`,
        date: ELECTION_DATE,
        regionType: "state",
        regionId: stateFips,
        candidates: [
          {
            name: person.name,
            party: normalizeParty(person.party),
            incumbent: true,
          },
        ],
      });
    }

    // 3. Fetch lower chamber (House/Assembly)
    const reps = await fetchPeople("lower", jurisdiction.id);

    for (const person of reps) {
      if (!person.current_role) continue;
      const dist = person.current_role.district;
      const chamberName = jurisdiction.name === "Nebraska" ? "Legislature" : "House";
      elections.push({
        office: `State ${chamberName === "House" ? "Representative" : "Senator"} — ${stateUpper} District ${dist}`,
        level: "state",
        district: `${jurisdiction.name} ${chamberName} District ${dist}`,
        date: ELECTION_DATE,
        regionType: "state",
        regionId: stateFips,
        candidates: [
          {
            name: person.name,
            party: normalizeParty(person.party),
            incumbent: true,
          },
        ],
      });
    }
  }

  console.log(`  → ${elections.length} state legislature seats`);
  return elections;
}
