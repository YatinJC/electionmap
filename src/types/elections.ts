export interface Candidate {
  name: string;
  party: string;
  incumbent: boolean;
  website?: string;
  description?: string;
}

export interface Election {
  id: string;
  office: string;
  level: "federal" | "state" | "county" | "municipal" | "special_district";
  district: string;
  date: string;
  description: string;
  whyItMatters: string;
  candidates: Candidate[];
  // Geographic binding — which regions does this election apply to?
  // "state:13" = Georgia (FIPS 13), "county:13121" = Fulton County, etc.
  regionType: "nation" | "state" | "county" | "congressional_district";
  regionId: string; // FIPS code (for districts: SSDD e.g. "0804" = CO-4)
}

// Elections grouped by location for the hover panel
export interface LocationElections {
  stateName: string;
  stateId: string;
  countyName?: string;
  countyId?: string;
  elections: Election[];
}
