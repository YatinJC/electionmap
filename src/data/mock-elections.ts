import { Election } from "@/types/elections";

// Mock data based on real 2025-2026 elections.
// In production, this comes from Democracy Works / Google Civic API.
// Elections are keyed to real FIPS codes so they light up the correct boundaries.

export const elections: Election[] = [
  // ── Georgia (FIPS 13) ─────────────────────────────────────────────
  {
    id: "ga-senate",
    office: "U.S. Senator",
    level: "federal",
    district: "Georgia",
    date: "2026-11-03",
    description:
      "U.S. Senators represent their state in the Senate for 6-year terms. They vote on federal legislation, confirm presidential appointments including Supreme Court justices, and ratify treaties.",
    whyItMatters:
      "Georgia's Senate races have decided control of the entire U.S. Senate twice in recent years. Every Senate seat can be the difference between legislation passing or stalling.",
    candidates: [
      { name: "Jon Ossoff", party: "Democratic", incumbent: true, description: "Incumbent senator elected in the 2021 runoff." },
      { name: "TBD", party: "Republican", incumbent: false, description: "Primary will determine the Republican nominee." },
    ],
    regionType: "state",
    regionId: "13",
  },
  {
    id: "ga-gov",
    office: "Governor of Georgia",
    level: "state",
    district: "Georgia",
    date: "2026-11-03",
    description:
      "The Governor serves as chief executive of the state, signs or vetoes legislation, proposes the state budget, and appoints officials to dozens of state boards and commissions.",
    whyItMatters:
      "The governor appoints members to boards that affect daily life — from healthcare policy to education standards — and has significant influence over redistricting and election administration.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false, description: "Primary elections will determine nominees." },
    ],
    regionType: "state",
    regionId: "13",
  },
  {
    id: "ga-psc-3",
    office: "Public Service Commissioner, District 3",
    level: "state",
    district: "Georgia PSC District 3",
    date: "2026-11-03",
    description:
      "The Georgia Public Service Commission regulates utilities including Georgia Power, Atlanta Gas Light, and telecom companies. Commissioners approve or deny rate increases, set energy policy, and oversee infrastructure investment.",
    whyItMatters:
      "This commission directly controls your electricity bill. In 2022–2025, the PSC approved six rate hikes for Georgia Power. The 2025 election flipped two seats after voters learned about the PSC's role — proving that awareness changes outcomes.",
    candidates: [
      { name: "TBD", party: "Democratic", incumbent: false },
      { name: "TBD", party: "Republican", incumbent: true },
    ],
    regionType: "state",
    regionId: "13",
  },
  // Fulton County, GA (FIPS 13121)
  {
    id: "fulton-commission",
    office: "Fulton County Commission, District 4",
    level: "county",
    district: "Fulton County District 4",
    date: "2026-11-03",
    description:
      "The Fulton County Board of Commissioners governs the county with a $1.2B budget covering public safety, health services, infrastructure, and county courts.",
    whyItMatters:
      "Fulton County covers most of Atlanta and has 1.1 million residents. The commission decides property tax rates, funds the county jail, manages elections infrastructure, and runs public health programs.",
    candidates: [
      { name: "TBD", party: "Nonpartisan", incumbent: false, description: "Filing period opens later this year." },
    ],
    regionType: "county",
    regionId: "13121",
  },
  {
    id: "fulton-school-board",
    office: "Fulton County School Board, District 7",
    level: "special_district",
    district: "Fulton County Schools District 7",
    date: "2026-05-19",
    description:
      "The school board oversees Fulton County Schools — 90,000+ students. They hire the superintendent, set curriculum standards, approve school budgets, and decide school boundaries.",
    whyItMatters:
      "School board members decide what your kids learn, which schools get funding, and set teacher pay. These elections typically have under 15% turnout — a small number of votes have enormous impact.",
    candidates: [
      { name: "TBD", party: "Nonpartisan", incumbent: false },
    ],
    regionType: "county",
    regionId: "13121",
  },
  {
    id: "fulton-da",
    office: "Fulton County District Attorney",
    level: "county",
    district: "Fulton County",
    date: "2026-11-03",
    description:
      "The District Attorney is the chief prosecutor for Fulton County, deciding which cases to prosecute, what charges to bring, and setting prosecution priorities.",
    whyItMatters:
      "The DA has more influence over criminal justice outcomes than almost any other local official. They decide cash bail policy, how to handle drug offenses, and set priorities that affect incarceration rates.",
    candidates: [
      { name: "TBD", party: "Democratic", incumbent: false },
    ],
    regionType: "county",
    regionId: "13121",
  },
  // Gwinnett County, GA (FIPS 13135)
  {
    id: "gwinnett-commission",
    office: "Gwinnett County Commission Chair",
    level: "county",
    district: "Gwinnett County",
    date: "2026-11-03",
    description:
      "The Commission Chair leads the governing body of Gwinnett County, Georgia's second-most populous county with nearly 1 million residents.",
    whyItMatters:
      "Gwinnett has transformed from a rural exurb to one of the most diverse counties in the Southeast. The commission chair shapes how the county handles rapid growth, transit expansion, and affordable housing.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "county",
    regionId: "13135",
  },

  // ── Texas (FIPS 48) ───────────────────────────────────────────────
  {
    id: "tx-gov",
    office: "Governor of Texas",
    level: "state",
    district: "Texas",
    date: "2026-11-03",
    description:
      "The Governor of Texas serves as chief executive, with power to sign or veto legislation, appoint state officials, and command the Texas National Guard.",
    whyItMatters:
      "Texas is the second-most populous state. The governor's decisions on border policy, energy regulation, education funding, and healthcare affect 30 million people and often set the tone for national policy.",
    candidates: [
      { name: "Greg Abbott", party: "Republican", incumbent: true, description: "Current governor, in office since 2015." },
    ],
    regionType: "state",
    regionId: "48",
  },
  // Harris County, TX (FIPS 48201)
  {
    id: "harris-judge",
    office: "Harris County Judge",
    level: "county",
    district: "Harris County",
    date: "2026-11-03",
    description:
      "Despite the title, the County Judge in Texas is primarily an executive role — chief executive of the county, presiding over the Commissioners Court, managing a multi-billion dollar budget.",
    whyItMatters:
      "Harris County (Houston) has 4.7 million people. The County Judge leads emergency response for hurricanes and floods, and sets priorities for infrastructure and public health.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "county",
    regionId: "48201",
  },
  {
    id: "harris-flood",
    office: "Harris County Flood Control District Board",
    level: "special_district",
    district: "Harris County Flood Control District",
    date: "2026-11-03",
    description:
      "The Flood Control District manages drainage infrastructure, bayou maintenance, and flood mitigation for one of the most flood-prone metro areas in the US.",
    whyItMatters:
      "After Hurricane Harvey caused $125 billion in damage, flood control became Houston's most critical issue. This board decides how billions in bond money gets spent. If you live in Houston, this might be the most important election on your ballot that you've never heard of.",
    candidates: [
      { name: "TBD", party: "Nonpartisan", incumbent: false },
    ],
    regionType: "county",
    regionId: "48201",
  },
  // Travis County, TX (FIPS 48453) — Austin
  {
    id: "travis-da",
    office: "Travis County District Attorney",
    level: "county",
    district: "Travis County",
    date: "2026-11-03",
    description:
      "The DA prosecutes criminal cases in Travis County (Austin), sets enforcement priorities, and decides how to allocate prosecution resources.",
    whyItMatters:
      "As Austin has grown into a major tech hub, the DA's office handles an increasing caseload around housing fraud, tech-sector crime, and public safety in a rapidly changing city.",
    candidates: [
      { name: "TBD", party: "Democratic", incumbent: false },
    ],
    regionType: "county",
    regionId: "48453",
  },

  // ── California (FIPS 06) ──────────────────────────────────────────
  {
    id: "ca-senate",
    office: "U.S. Senator",
    level: "federal",
    district: "California",
    date: "2026-11-03",
    description:
      "California's U.S. Senator represents nearly 40 million people — more than any other state's senators.",
    whyItMatters:
      "California's senators sit on powerful committees. Their votes on climate policy, tech regulation, immigration, and the federal budget have outsized national impact — representing 1 in 8 Americans.",
    candidates: [
      { name: "Alex Padilla", party: "Democratic", incumbent: true, description: "Incumbent senator, formerly California's Secretary of State." },
    ],
    regionType: "state",
    regionId: "06",
  },
  // Los Angeles County, CA (FIPS 06037)
  {
    id: "la-school-board",
    office: "LAUSD School Board, District 5",
    level: "special_district",
    district: "Los Angeles Unified School District 5",
    date: "2026-03-03",
    description:
      "The LAUSD Board governs the second-largest school district in the US with 420,000+ students and a $20 billion budget.",
    whyItMatters:
      "LAUSD's budget is larger than many US states. Board members decide what nearly half a million students learn, which schools stay open, and how billions get spent. These races often come down to a few thousand votes.",
    candidates: [
      { name: "TBD", party: "Nonpartisan", incumbent: false },
    ],
    regionType: "county",
    regionId: "06037",
  },

  // ── Michigan (FIPS 26) ────────────────────────────────────────────
  {
    id: "mi-senate",
    office: "U.S. Senator",
    level: "federal",
    district: "Michigan",
    date: "2026-11-03",
    description:
      "Michigan's U.S. Senate seat. Senators serve 6-year terms voting on federal legislation, confirming judicial appointments, and overseeing the executive branch.",
    whyItMatters:
      "Michigan is a perennial swing state whose Senate races frequently decide chamber control. The senator's positions on auto industry policy and Great Lakes protection directly affect Michigan's economy.",
    candidates: [
      { name: "Gary Peters", party: "Democratic", incumbent: true },
    ],
    regionType: "state",
    regionId: "26",
  },
  // Wayne County, MI (FIPS 26163) — Detroit
  {
    id: "wayne-executive",
    office: "Wayne County Executive",
    level: "county",
    district: "Wayne County",
    date: "2026-11-03",
    description:
      "The County Executive leads Wayne County, Michigan's most populous county, which includes Detroit and surrounding communities.",
    whyItMatters:
      "Wayne County manages critical services for 1.7 million residents — from the county jail to public health to road maintenance. Post-bankruptcy Detroit depends heavily on effective county governance.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "county",
    regionId: "26163",
  },

  // ── Arizona (FIPS 04) ────────────────────────────────────────────
  {
    id: "az-gov",
    office: "Governor of Arizona",
    level: "state",
    district: "Arizona",
    date: "2026-11-03",
    description:
      "Arizona's governor serves as chief executive, with authority over state agencies, the budget, and a critical role in water policy for this desert state.",
    whyItMatters:
      "Arizona faces an existential water crisis. The governor's decisions on Colorado River allocation, groundwater regulation, and development permits determine whether parts of the state remain habitable.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "state",
    regionId: "04",
  },
  // Maricopa County, AZ (FIPS 04013)
  {
    id: "maricopa-recorder",
    office: "Maricopa County Recorder",
    level: "county",
    district: "Maricopa County",
    date: "2026-11-03",
    description:
      "The County Recorder manages voter registration, early voting, and mail ballot processing for the fourth-largest county in the US.",
    whyItMatters:
      "Maricopa County is ground zero for election administration debates. The recorder's office processes millions of ballots and has been at the center of national controversies. Who holds this office determines how 2.5 million registered voters experience democracy.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "county",
    regionId: "04013",
  },

  // ── Pennsylvania (FIPS 42) ────────────────────────────────────────
  {
    id: "pa-gov",
    office: "Governor of Pennsylvania",
    level: "state",
    district: "Pennsylvania",
    date: "2026-11-03",
    description:
      "Pennsylvania's governor leads the executive branch, manages a $45 billion budget, and plays a key role in energy, education, and election certification.",
    whyItMatters:
      "PA is the ultimate swing state. The governor certifies election results, sets energy policy for a state that's both a fracking hub and a clean energy leader, and shapes education funding for 1.7 million public school students.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "state",
    regionId: "42",
  },
  // Philadelphia County, PA (FIPS 42101)
  {
    id: "philly-da",
    office: "Philadelphia District Attorney",
    level: "county",
    district: "Philadelphia County",
    date: "2026-11-03",
    description:
      "The DA is the chief law enforcement officer for Philadelphia, overseeing all criminal prosecutions in the city.",
    whyItMatters:
      "Philadelphia's DA office became a national flashpoint in the criminal justice reform debate. The office's approach to prosecution directly affects how 1.6 million residents experience the justice system.",
    candidates: [
      { name: "TBD", party: "Democratic", incumbent: false },
    ],
    regionType: "county",
    regionId: "42101",
  },

  // ── Florida (FIPS 12) ────────────────────────────────────────────
  {
    id: "fl-senate",
    office: "U.S. Senator",
    level: "federal",
    district: "Florida",
    date: "2026-11-03",
    description:
      "Florida's U.S. Senator represents the third-most populous state, serving on committees that shape national policy.",
    whyItMatters:
      "Florida is a massive swing state with 22 million residents. Senate races here often decide national control, and the senator's positions on climate, insurance, and immigration have direct local impact.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "state",
    regionId: "12",
  },
  // Miami-Dade County, FL (FIPS 12086)
  {
    id: "miami-mayor",
    office: "Miami-Dade County Mayor",
    level: "county",
    district: "Miami-Dade County",
    date: "2026-11-03",
    description:
      "The Mayor leads the most populous county in Florida with 2.7 million residents, managing transportation, water, housing, and public safety.",
    whyItMatters:
      "Miami-Dade is on the front line of climate change — rising sea levels threaten billions in real estate and infrastructure. The mayor's decisions on flood protection, building codes, and development will determine the county's long-term viability.",
    candidates: [
      { name: "TBD", party: "Nonpartisan", incumbent: false },
    ],
    regionType: "county",
    regionId: "12086",
  },
  // ── Congressional Districts ──────────────────────────────────────

  // Georgia's 5th (Atlanta) — GEOID "1305"
  {
    id: "ga-cd5",
    office: "U.S. Representative, Georgia 5th District",
    level: "federal",
    district: "Georgia's 5th Congressional District",
    date: "2026-11-03",
    description:
      "The U.S. Representative for GA-5 serves in the House for a 2-year term. This district covers most of Atlanta and parts of Fulton, DeKalb, and Clayton counties. House members vote on all federal legislation and control the federal budget.",
    whyItMatters:
      "GA-5 was represented by John Lewis for 33 years. The district's shape — stretching across three counties — determines which Atlanta neighborhoods get grouped together for federal representation. This is where redistricting decisions become visible.",
    candidates: [
      { name: "Nikema Williams", party: "Democratic", incumbent: true },
      { name: "TBD", party: "Republican", incumbent: false },
    ],
    regionType: "congressional_district",
    regionId: "1305",
  },
  // Texas 7th (Houston suburbs) — GEOID "4807"
  {
    id: "tx-cd7",
    office: "U.S. Representative, Texas 7th District",
    level: "federal",
    district: "Texas's 7th Congressional District",
    date: "2026-11-03",
    description:
      "TX-7 covers western Houston and its suburbs. The representative serves a 2-year term in the U.S. House, voting on federal legislation including energy policy, immigration, and the federal budget.",
    whyItMatters:
      "TX-7 flipped from Republican to Democrat in 2018 after decades, then was redrawn in 2021 redistricting to be more competitive. The district's new boundaries split communities that were previously in the same district — a textbook example of how redistricting reshapes representation.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "congressional_district",
    regionId: "4807",
  },
  // Illinois 4th (Chicago — the "earmuff" district) — GEOID "1704"
  {
    id: "il-cd4",
    office: "U.S. Representative, Illinois 4th District",
    level: "federal",
    district: "Illinois's 4th Congressional District",
    date: "2026-11-03",
    description:
      "IL-4 was designed to connect two Hispanic neighborhoods on Chicago's north and south sides. The representative serves a 2-year term in the U.S. House.",
    whyItMatters:
      "IL-4 is one of the most famous gerrymandered districts in America — nicknamed the 'earmuff district' because of its bizarre shape connecting two Latino communities via a thin strip along I-294. It was drawn to create a majority-Hispanic district under the Voting Rights Act, making it an example of gerrymandering for representation rather than partisan advantage.",
    candidates: [
      { name: "Chuy Garcia", party: "Democratic", incumbent: true },
      { name: "TBD", party: "Republican", incumbent: false },
    ],
    regionType: "congressional_district",
    regionId: "1704",
  },
  // North Carolina 12th (redrawn) — GEOID "3712"
  {
    id: "nc-cd12",
    office: "U.S. Representative, North Carolina 12th District",
    level: "federal",
    district: "North Carolina's 12th Congressional District",
    date: "2026-11-03",
    description:
      "NC-12 was historically one of the most gerrymandered districts in the country, stretching 120 miles along I-85 to connect Black communities in Charlotte and Greensboro. It has been redrawn multiple times after court challenges.",
    whyItMatters:
      "NC-12 has been at the center of two Supreme Court cases on racial gerrymandering (Shaw v. Reno, 1993 and Cooper v. Harris, 2017). Its history shows how district boundaries can be weaponized — and how courts can push back. The current boundaries reflect the latest round of redistricting after the 2020 Census.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "congressional_district",
    regionId: "3712",
  },
  // Arizona 6th (Scottsdale/Tempe) — GEOID "0406"
  {
    id: "az-cd6",
    office: "U.S. Representative, Arizona 6th District",
    level: "federal",
    district: "Arizona's 6th Congressional District",
    date: "2026-11-03",
    description:
      "AZ-6 covers parts of Maricopa County including Scottsdale, Tempe, and Mesa. The representative votes on federal legislation for a 2-year term.",
    whyItMatters:
      "Arizona uses an independent redistricting commission — one of the few states where politicians don't draw their own district lines. AZ-6 is the result of that process, making it worth comparing to districts in states where legislators control redistricting.",
    candidates: [
      { name: "TBD", party: "Multiple", incumbent: false },
    ],
    regionType: "congressional_district",
    regionId: "0406",
  },
  // Maryland 3rd — GEOID "2403"
  {
    id: "md-cd3",
    office: "U.S. Representative, Maryland 3rd District",
    level: "federal",
    district: "Maryland's 3rd Congressional District",
    date: "2026-11-03",
    description:
      "MD-3 covers parts of Baltimore and Anne Arundel County. The representative serves a 2-year term in the U.S. House.",
    whyItMatters:
      "MD-3 was previously considered one of the most gerrymandered districts in the country, with a shape so convoluted a federal judge called it 'reminiscent of a broken-winged pterodactyl.' Maryland's 2022 redistricting redrew the lines, but the district's history is a case study in how partisan gerrymandering works in practice.",
    candidates: [
      { name: "TBD", party: "Democratic", incumbent: true },
    ],
    regionType: "congressional_district",
    regionId: "2403",
  },
];

// Build lookup indexes for fast access
export function getElectionsForState(stateId: string): Election[] {
  return elections.filter(
    (e) => e.regionType === "state" && e.regionId === stateId
  );
}

export function getElectionsForCounty(countyId: string): Election[] {
  return elections.filter(
    (e) => e.regionType === "county" && e.regionId === countyId
  );
}

// Get ALL elections that apply to a county location (county elections + parent state elections)
export function getElectionsForLocation(stateId: string, countyId?: string): Election[] {
  const stateElections = getElectionsForState(stateId);
  const countyElections = countyId ? getElectionsForCounty(countyId) : [];
  return [...countyElections, ...stateElections];
}

// Set of all state FIPS codes that have any election
export const statesWithElections = new Set(
  elections
    .filter((e) => e.regionType === "state")
    .map((e) => e.regionId)
);

// Set of all county FIPS codes that have any election
export const countiesWithElections = new Set(
  elections
    .filter((e) => e.regionType === "county")
    .map((e) => e.regionId)
);
