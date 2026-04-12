# ElectionMap — Development Roadmap

**Every Election, Everywhere.**

A zoomable map of the US that shows every election happening at every level — from Senate races to school boards — with plain-language explanations of what each office does and why it matters.

---

## The Problem

There are roughly 500,000 elected positions in the United States. Most voters only know about a handful of them. Down-ballot elections — utility commissions, school boards, county judges, water districts — directly control people's daily lives, but they have the lowest awareness and lowest turnout.

In 2025, Hank Green made a video about the Georgia Public Service Commission, an obscure body that had approved six electricity rate hikes in three years. His video got 850,000 views, turnout surged, and both incumbents lost. But it shouldn't require being Hank Green to find out about these elections.

ElectionMap makes every election discoverable. Anyone can zoom into any part of the country, see what's on the ballot, understand what each office controls, and share it.

---

## Architecture Overview

```
Phase 1: Database + API          ──┐
  (foundation - blocks everything) │
                                   ▼
Phase 2: API Ingestion  ───┐  Phase 3: AI "Why It Matters"
  (real election data)      │    (can run in parallel)
                            ▼         │
                    Phase 4: Volunteer System
                      (Wikipedia-style editing)
                            │
                            ▼
                    Phase 5: AI Scrapers
                      (local govt websites)
```

---

## Phase 1 — Database + API Layer

**Status:** Not started
**Goal:** Replace hardcoded mock data with a real database and API. The frontend should work identically but pull from the DB instead of a static file.

### Tech Stack
- **Database:** Supabase (PostgreSQL) — free tier: 500MB storage, built-in auth
- **ORM:** Drizzle ORM — lightweight, TypeScript-native, no binary bloat
- **API:** Next.js Route Handlers (App Router)

### Database Schema

**`elections`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| office | TEXT | e.g. "Public Service Commissioner, District 3" |
| level | TEXT | federal, state, county, municipal, special_district |
| district | TEXT | Human-readable district name |
| date | DATE | Election date |
| description | TEXT | What this office does |
| why_it_matters | TEXT | Plain-language impact explanation |
| why_it_matters_source | TEXT | 'manual', 'ai_generated', 'volunteer' |
| region_type | TEXT | 'nation', 'state', 'county' |
| region_id | TEXT | FIPS code |
| status | TEXT | 'active', 'archived', 'draft' |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**`candidates`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| election_id | UUID | FK → elections |
| name | TEXT | |
| party | TEXT | |
| incumbent | BOOLEAN | |
| website | TEXT | |
| description | TEXT | |

**`data_sources`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | TEXT | e.g. 'google_civic', 'volunteer' |
| source_type | TEXT | 'api', 'scraper', 'volunteer' |
| reliability | INT | 0–100 trust score |
| last_synced_at | TIMESTAMPTZ | |
| config | JSONB | API keys, URLs, scraper params |

**`election_sources`** (junction — tracks provenance)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| election_id | UUID | FK → elections |
| source_id | UUID | FK → data_sources |
| external_id | TEXT | ID in the source system |
| raw_data | JSONB | Original API response |
| confidence | INT | 0–100 |
| fetched_at | TIMESTAMPTZ | |

### API Endpoints
- `GET /api/elections?stateId=XX&countyId=XXXXX` — elections for a location
- `GET /api/regions/summary` — FIPS codes with elections (for map coloring, cached aggressively)

### Key Decisions
- **FIPS codes** as the geographic key — standard US identifier, encodes the state→county hierarchy naturally (state FIPS = first 2 digits of county FIPS)
- **Drizzle over Prisma** — no binary bloat, better Vercel cold starts, pure TypeScript
- **Supabase over Neon+Clerk** — bundles auth (needed for Phase 4) in one service

---

## Phase 2 — Data Ingestion from Free APIs

**Status:** Not started
**Goal:** Replace mock data with real election data from public APIs.
**Depends on:** Phase 1

### Data Sources (priority order)

1. **Google Civic Information API** (free with API key)
   - Best structured source for federal + state races
   - `elections` endpoint: lists upcoming elections
   - `voterinfo` endpoint: ballot info by address
   - Limitation: data only available ~2–4 weeks before each election

2. **civicAPI.org** (free, no key)
   - Claims coverage down to school board level
   - Needs real-world testing to verify completeness

3. **Open States** (free)
   - State legislature data

4. **Democracy Works / BallotReady** (may require partnership)
   - Most comprehensive down-ballot coverage
   - Worth pursuing for deeper local data

### Adapter Pattern

Each data source gets a module in `src/ingestion/adapters/` that implements:

```typescript
interface IngestionAdapter {
  sourceId: string;
  fetch(): Promise<RawElectionData[]>;
  mapToElection(raw: RawElectionData): Partial<Election>;
}
```

### Data Reconciliation

When two sources report the same election (matched on `office + region + date`):
- Higher-reliability source wins for factual fields (candidates, dates)
- Human-written descriptions are preserved over API data
- Conflicts on factual fields are flagged for manual review — never silently overwritten
- If a source stops reporting an election, mark `possibly_stale` for review (don't auto-delete)

### Scheduling
- Vercel Cron (free tier: 2 jobs, daily)
- Nightly sync calls each adapter in sequence
- Route: `POST /api/cron/sync-elections`

---

## Phase 3 — AI-Generated "Why It Matters"

**Status:** Not started
**Goal:** Auto-generate placeholder descriptions for elections that lack human-written "why it matters" content.
**Depends on:** Phase 1
**Can run in parallel with:** Phase 2

### Approach
- When an election has no `why_it_matters`, queue it for AI generation
- Prompt includes: office name, level, region, population, candidates, any existing description
- Generated text stored with `why_it_matters_source = 'ai_generated'`
- UI shows: *"AI-generated — help us improve this"* linking to the edit flow (Phase 4)

### Tech
- Anthropic Claude API (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk`
- Batch job: `POST /api/cron/generate-descriptions`
- Rate limited to ~50 per run

### Cost
- ~300 tokens per generation
- 10,000 elections ≈ $1.50 total
- Essentially free at any reasonable scale

---

## Phase 4 — Volunteer / Community System

**Status:** Not started
**Goal:** Allow users to sign up, submit new elections, edit existing data, and have edits go through a review process. Wikipedia-style revision history.
**Depends on:** Phase 1, benefits from Phase 2

### Auth
- Supabase Auth (email + GitHub OAuth)
- Roles: contributor, reviewer, admin

### Additional Tables

**`users`**
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Matches Supabase auth.users.id |
| display_name | TEXT | |
| role | TEXT | contributor, reviewer, admin |
| reputation | INT | Earned through approved edits |

**`revisions`** (field-level edit tracking)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| election_id | UUID | FK → elections |
| user_id | UUID | FK → users |
| field_changed | TEXT | e.g. 'description', 'why_it_matters' |
| old_value | JSONB | |
| new_value | JSONB | |
| status | TEXT | pending, approved, rejected |
| reviewed_by | UUID | FK → users |
| comment | TEXT | Reviewer's note |

**`election_submissions`** (new elections proposed by volunteers)
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | FK → users |
| data | JSONB | Full election object as submitted |
| status | TEXT | pending, approved, rejected |
| created_election_id | UUID | Set when approved |

### User Flow
1. Anyone can browse the map without signing in
2. Sign in to propose edits or submit new elections
3. All edits go to a review queue
4. Reviewers approve/reject with comments
5. Full revision history visible on every election
6. After N approved edits, contributors can be promoted to reviewer

### Trust Model
- API-sourced data has higher default trust than volunteer submissions
- AI-generated content is clearly labeled and editable by anyone
- Volunteer edits to "why it matters" are encouraged — that's the unique value

---

## Phase 5 — AI Scraping Agents

**Status:** Not started
**Goal:** For local elections not covered by any API, build scrapers that extract election info from county/city government websites.
**Depends on:** Phase 2 (adapter pattern), Phase 4 (volunteer verification)

### Why This Is Last
Scrapers are brittle. Government websites change layouts, go down, and have inconsistent formatting. The volunteer system (Phase 4) acts as the verification layer for scraped data.

### Approach
- Playwright loads county election board websites
- Claude extracts structured election data from page HTML
- Each scraper targets a specific jurisdiction

### Scraper Config
```
src/ingestion/scrapers/
  base-scraper.ts           -- Playwright + Claude extraction pipeline
  targets/
    fulton-county-ga.ts     -- URL, selectors, extraction prompt
    harris-county-tx.ts
    ...
```

Each target specifies:
- URL(s) to scrape
- Claude prompt describing what to extract
- Mapping function to internal schema
- Schedule (how often to re-check)

### Deployment
- Cannot run on Vercel (no Playwright support)
- Options: GitHub Actions (free scheduled workflows), cheap VPS ($4/month), or Browserless.io
- Pushes results to Supabase via the ingestion API

### Trust
- Scraped data gets a low reliability score
- Flagged for volunteer verification before going live
- "Unverified — sourced from [county website]" label in UI

---

## Deployment Architecture

```
Vercel (free tier)
├── Next.js app (frontend + API routes)
├── Cron: /api/cron/sync-elections (daily)
└── Cron: /api/cron/generate-descriptions (daily)

Supabase (free tier)
├── PostgreSQL database
├── Auth (email + OAuth)
└── Row Level Security (optional)

External Services
├── Google Civic API (free)
├── civicAPI.org (free)
├── Anthropic Claude API (pay-per-use, ~$0.15/10K elections)
└── GitHub Actions or VPS (Phase 5 scrapers only)
```

**Cost at launch: $0/month** until meaningful traffic is reached.

---

## Current Status

### Completed
- [x] Next.js 16 project with TypeScript + Tailwind
- [x] Leaflet map with CARTO dark tiles
- [x] US state boundaries (Census TIGER/Line TopoJSON)
- [x] US county boundaries with zoom-based reveal (zoom ≥ 7)
- [x] Hover interaction — highlights region, shows elections in side panel
- [x] Click-to-lock — pin a region to read details while moving the map
- [x] Mock data for 7 states, 9 counties, 20 elections
- [x] Election cards with "What is this?" and "Why it matters" sections
- [x] Color-coded election levels (federal, state, county, municipal, special district)
- [x] Mobile-responsive layout

### Next Up
- [ ] Phase 1: Set up Supabase + Drizzle, migrate mock data to DB
