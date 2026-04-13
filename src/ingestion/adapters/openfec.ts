/**
 * OpenFEC Adapter
 *
 * Fetches federal candidate data from the FEC API.
 * Coverage: all U.S. Senate and House candidates who have filed with the FEC.
 * Free with DEMO_KEY (limited rate) or a registered key (higher limits).
 *
 * API docs: https://api.open.fec.gov/developers/
 */

const API_BASE = "https://api.open.fec.gov/v1";
const API_KEY = process.env.OPENFEC_API_KEY || "DEMO_KEY";
const ELECTION_YEAR = 2026;
const ELECTION_DATE = "2026-11-03";
const PER_PAGE = 100;

// State FIPS codes
const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17", IN: "18",
  IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24", MA: "25",
  MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31", NV: "32",
  NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38", OH: "39",
  OK: "40", OR: "41", PA: "42", RI: "44", SC: "45", SD: "46", TN: "47",
  TX: "48", UT: "49", VT: "50", VA: "51", WA: "53", WV: "54", WI: "55",
  WY: "56", DC: "11", AS: "60", GU: "66", MP: "69", PR: "72", VI: "78",
};

interface FECCandidate {
  candidate_id: string;
  name: string;
  party_full: string;
  party: string;
  state: string;
  office: string;
  office_full: string;
  district: string;
  incumbent_challenge: string;
  incumbent_challenge_full: string;
  election_years: number[];
  has_raised_funds: boolean;
  candidate_status: string;
}

export interface NormalizedElection {
  office: string;
  level: "federal";
  district: string;
  date: string;
  regionType: "state" | "congressional_district";
  regionId: string; // FIPS code
  candidates: {
    name: string;
    party: string;
    incumbent: boolean;
  }[];
}

async function fetchAllPages(
  office: "S" | "H"
): Promise<FECCandidate[]> {
  const results: FECCandidate[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${API_BASE}/candidates/search/?api_key=${API_KEY}&election_year=${ELECTION_YEAR}&office=${office}&is_active_candidate=true&per_page=${PER_PAGE}&page=${page}&sort=state`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`FEC API error (page ${page}):`, res.status, res.statusText);
      break;
    }
    const data = await res.json();
    results.push(...data.results);
    totalPages = data.pagination.pages;
    page++;

    // Rate limit: DEMO_KEY allows 1000 requests/hour, ~20/minute effective
    await new Promise((r) => setTimeout(r, API_KEY === "DEMO_KEY" ? 3500 : 500));
  }

  return results;
}

function formatName(fecName: string | null): string {
  if (!fecName) return "Unknown";
  // FEC names are "LAST, FIRST MIDDLE" — convert to "First Last"
  const parts = fecName.split(",").map((s) => s.trim());
  if (parts.length < 2) return fecName;
  const last = parts[0];
  const first = parts[1].split(" ")[0]; // Just first name, drop middle
  const capitalize = (s: string) =>
    s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return `${capitalize(first)} ${capitalize(last)}`;
}

function normalizeParty(partyFull: string | null): string {
  if (!partyFull) return "Unknown";
  if (partyFull.includes("DEMOCRAT")) return "Democratic";
  if (partyFull.includes("REPUBLICAN")) return "Republican";
  if (partyFull.includes("LIBERTARIAN")) return "Libertarian";
  if (partyFull.includes("GREEN")) return "Green";
  if (partyFull.includes("INDEPENDENT")) return "Independent";
  // Title case the rest
  return partyFull
    .split(" ")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function groupCandidatesIntoElections(
  candidates: FECCandidate[],
  office: "S" | "H"
): NormalizedElection[] {
  // Group by state (Senate) or state+district (House)
  const groups = new Map<string, FECCandidate[]>();

  for (const c of candidates) {
    const dist = c.district ?? "00";
    const key =
      office === "S" ? c.state : `${c.state}-${dist.padStart(2, "0")}`;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  const elections: NormalizedElection[] = [];

  for (const [key, group] of groups) {
    const stateAbbr = group[0].state;
    const stateFips = STATE_FIPS[stateAbbr];
    if (!stateFips) continue; // Skip territories we don't have boundaries for

    if (office === "S") {
      elections.push({
        office: `U.S. Senator — ${stateAbbr}`,
        level: "federal",
        district: `${stateAbbr} Senate`,
        date: ELECTION_DATE,
        regionType: "state",
        regionId: stateFips,
        candidates: group.map((c) => ({
          name: formatName(c.name),
          party: normalizeParty(c.party_full),
          incumbent: c.incumbent_challenge === "I",
        })),
      });
    } else {
      const distNum = (group[0].district ?? "00").padStart(2, "0");
      const districtGeoid = `${stateFips}${distNum}`;
      elections.push({
        office: `U.S. Representative — ${stateAbbr}-${parseInt(distNum)}`,
        level: "federal",
        district: `${stateAbbr}'s ${ordinal(parseInt(distNum))} Congressional District`,
        date: ELECTION_DATE,
        regionType: "congressional_district",
        regionId: districtGeoid,
        candidates: group.map((c) => ({
          name: formatName(c.name),
          party: normalizeParty(c.party_full),
          incumbent: c.incumbent_challenge === "I",
        })),
      });
    }
  }

  return elections;
}

function ordinal(n: number): string {
  if (n === 0) return "At-Large";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function fetchAllFederalElections(): Promise<NormalizedElection[]> {
  console.log("Fetching Senate candidates from FEC...");
  const senateCandidates = await fetchAllPages("S");
  console.log(`  Found ${senateCandidates.length} Senate candidates`);

  console.log("Fetching House candidates from FEC...");
  const houseCandidates = await fetchAllPages("H");
  console.log(`  Found ${houseCandidates.length} House candidates`);

  const senateElections = groupCandidatesIntoElections(senateCandidates, "S");
  const houseElections = groupCandidatesIntoElections(houseCandidates, "H");

  console.log(`  → ${senateElections.length} Senate races, ${houseElections.length} House races`);

  return [...senateElections, ...houseElections];
}
