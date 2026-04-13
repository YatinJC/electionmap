-- ElectionMap database setup
-- Run this in the Supabase SQL Editor

-- Elections table
CREATE TABLE IF NOT EXISTS elections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  office TEXT NOT NULL,
  level TEXT NOT NULL,
  district TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  why_it_matters TEXT,
  why_it_matters_source TEXT DEFAULT 'manual',
  region_type TEXT NOT NULL,
  region_id TEXT NOT NULL,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_elections_region ON elections (region_type, region_id);
CREATE INDEX IF NOT EXISTS idx_elections_date ON elections (date);
CREATE INDEX IF NOT EXISTS idx_elections_status ON elections (status);

-- Candidates table
CREATE TABLE IF NOT EXISTS candidates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  party TEXT,
  incumbent BOOLEAN DEFAULT false NOT NULL,
  website TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candidates_election ON candidates (election_id);

-- Data sources (provenance tracking)
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL,
  reliability INTEGER DEFAULT 50 NOT NULL,
  last_synced_at TIMESTAMPTZ,
  config JSONB
);

-- Election <-> Source junction
CREATE TABLE IF NOT EXISTS election_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  external_id TEXT,
  raw_data JSONB,
  confidence INTEGER DEFAULT 50 NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (election_id, source_id)
);

-- Enable Row Level Security (allow public read access)
ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_sources ENABLE ROW LEVEL SECURITY;

-- Public read access policies
CREATE POLICY "Public read access" ON elections FOR SELECT USING (true);
CREATE POLICY "Public read access" ON candidates FOR SELECT USING (true);
CREATE POLICY "Public read access" ON data_sources FOR SELECT USING (true);
CREATE POLICY "Public read access" ON election_sources FOR SELECT USING (true);

-- Service role can do everything (for seeding and ingestion)
CREATE POLICY "Service role full access" ON elections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON candidates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON data_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON election_sources FOR ALL USING (true) WITH CHECK (true);
