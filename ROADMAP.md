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
Phase 1: Database + API           ✅ DONE
Phase 2: API Ingestion            ✅ DONE
Phase 3: AI "Why It Matters"      ✅ DONE
Phase 4: Volunteer System            NOT STARTED
Phase 5: AI Scrapers                 NOT STARTED
```

---

## Phase 1 — Database + API Layer ✅

**Status:** Complete

### What's Built
- **Supabase** PostgreSQL database with elections, candidates, data_sources, and election_sources tables
- **Supabase JS client** connecting over HTTPS (avoids IPv4/IPv6 issues with direct Postgres)
- **API routes:**
  - `GET /api/elections?stateId=XX&countyId=XXXXX&districtId=XXXX&months=N&levels=federal,state` — elections for a location with time window and level filtering
  - `GET /api/regions/summary?months=N&levels=federal,state` — FIPS codes with elections (for map highlighting)
- **Database-level dedup constraint:** unique index on `(level, region_type, region_id, date, office)` for active elections
- **Row Level Security:** public read access, service role for writes
- **Seed script:** `npm run db:seed` populates from mock data

### Database Schema

**`elections`** — office, level, district, date, description, why_it_matters, why_it_matters_source, region_type (state/county/congressional_district), region_id (FIPS), status

**`candidates`** — name, party, incumbent, linked to elections via election_id

**`data_sources`** — name, source_type (api/scraper/volunteer), reliability score (0-100)

**`election_sources`** — junction table tracking which source provided each election's data

---

## Phase 2 — Data Ingestion ✅

**Status:** Complete — 785+ elections, 4,000+ candidates from real APIs

### Data Sources (active)

| Source | Coverage | Elections | Status |
|--------|----------|-----------|--------|
| **OpenFEC** | All 2026 Senate + House candidates | ~502 | ✅ Working |
| **Open States** | State legislature (incumbents) | ~290 (3 states so far, rate-limited) | ✅ Working, needs full run |
| **Google Civic** | Active elections near election day | 0 (no active elections yet) | ✅ Adapter ready |

### Data Sources (pending — need partnership/payment)

| Source | Coverage | Status |
|--------|----------|--------|
| **BallotReady** | Every race down to school board, candidate bios, endorsements | Reaching out |
| **Democracy Works** | Federal → school board for jurisdictions 5,000+ | Reaching out |
| **Ballotpedia** | Comprehensive all levels, $600 CSV dump or paid API | Considering |

### Ingestion Architecture
- **Adapter pattern:** each source gets a module in `src/ingestion/adapters/` that fetches and normalizes data
- **Fuzzy dedup:** matches elections on `(level, region_type, region_id, date)` with normalized office name comparison to handle cross-source naming differences
- **Human data preserved:** API updates never overwrite manually-written descriptions or "why it matters"
- **Provenance tracking:** every election links back to which source provided it via `election_sources`
- **Progress logging:** shows page counts during fetch and election counter during upsert

### Automation
- **Vercel Cron:** `GET /api/cron/sync-elections` runs nightly at 6am UTC
  - Phase 1: ingests from all three API sources
  - Phase 2: generates AI descriptions for new elections
  - Protected by `CRON_SECRET` env var
- **CLI:** `npm run ingest` (all) or `npm run ingest -- openfec|openstates|google-civic`

### Time-Based Filtering
- Elections automatically drop off the map after their date passes
- Adjustable time window in the UI: 1 month, 3 months, 6 months, 1 year, 2 years
- Both API routes respect the `months` parameter

---

## Phase 3 — AI-Generated Descriptions ✅

**Status:** Complete — 113+ elections have AI-generated content, system ready for full run

### What's Built
- **Claude Sonnet** generates "What is this?" and "Why it matters" for elections missing descriptions
- **Nonpartisan, region-specific:** connects to real daily-life impacts (utility bills, school funding, road conditions)
- **Batch limits:** 500 for CLI (`npm run generate-descriptions`), 100 for nightly cron
- **Smart skip logic:** never overwrites human-written content (`manual` or `volunteer` source)
- **UI label:** elections with AI content show "AI-generated — volunteer editors can improve this"
- **Integrated into cron:** runs automatically after each data ingestion

### Cost
- ~$0.01 per election with Claude Sonnet
- Full backlog of 785 elections ≈ $7.85

---

## Phase 4 — Volunteer / Community System

**Status:** Not started
**Goal:** Wikipedia-style editing — users can sign up, submit new elections, edit descriptions, with review queue and revision history.

### Planned
- Supabase Auth (email + GitHub OAuth)
- Roles: contributor, reviewer, admin
- Field-level revision tracking (what changed, who, when)
- Review queue for all edits
- "Edit" button on election cards (visible when logged in)
- Reputation system — approved edits earn trust

---

## Phase 5 — AI Scraping Agents

**Status:** Not started
**Goal:** For local elections not covered by any API, scrape county/city government websites using Playwright + Claude extraction.

### Planned
- Each scraper targets a specific jurisdiction's election board website
- Claude extracts structured data from page HTML
- Scraped data gets low reliability score, flagged for volunteer verification
- Cannot run on Vercel — needs GitHub Actions or cheap VPS
- Volunteer system (Phase 4) acts as verification layer

---

## Frontend Features

### Map
- [x] Leaflet + CARTO dark tiles (no labels)
- [x] US state boundaries (Census TIGER/Line TopoJSON)
- [x] US county boundaries with zoom-based reveal (zoom ≥ 7)
- [x] 118th Congress district boundaries (dashed outlines, visual overlay)
- [x] Point-in-polygon lookup (Turf.js) finds congressional district at mouse position
- [x] Single unified color system — cyan at 3 intensities, party-neutral
- [x] Counties = solid lines, districts = dashed lines (distinguished by style, not color)

### Interaction
- [x] Hover to preview elections (debounced, imperative style updates for performance)
- [x] Click to lock/pin selection (scroll panel, move map while reading)
- [x] Escape or click to unlock
- [x] Hovering a state at zoomed-out level shows ALL elections in that state (not just statewide)

### Panel
- [x] Elections grouped by level with colored section headers
- [x] "What is this?" / "Why it matters" / "Candidates" sections with distinct consistent colors
- [x] AI-generated content label
- [x] "Description coming soon" placeholder for elections awaiting AI generation
- [x] Empty state with how-to-use guide, election levels legend, and card section guide

### Filters
- [x] Time window selector (1mo / 3mo / 6mo / 1yr / 2yr)
- [x] Election level toggles (Federal / State / County / Municipal / Special)
- [x] Filters update both map highlights and panel content

### Legend
- [x] Map legend overlay (bottom-left) showing boundary types and highlight meanings
- [x] Adapts to zoom level — county/district entries appear when zoomed in

### Performance
- [x] Imperative `setStyle()` updates instead of GeoJSON re-renders
- [x] Only update the 2 affected features on hover change (not all 3,231)
- [x] Stable event bindings via refs (no stale closures, no rebinding)
- [x] Point-in-polygon result caching (~1km threshold)
- [x] 16ms hover debounce (one animation frame)
- [x] Memoized FeatureCollection data (GeoJSON mounts once)
- [x] Client-side election cache keyed by region + filters

---

## Tech Stack

| Layer | Tech | Why |
|-------|------|-----|
| Framework | Next.js 16 (App Router) | SSR + API routes in one project |
| Frontend | React 19, Tailwind 4, Leaflet | Fast, dark theme, zoomable map |
| Database | Supabase (PostgreSQL) | Free tier, built-in auth for Phase 4 |
| Geo data | Census TIGER/Line TopoJSON | Official US boundaries, free |
| Spatial | Turf.js | Point-in-polygon for district lookup |
| AI | Anthropic Claude Sonnet | Description generation |
| Data | OpenFEC, Open States, Google Civic | Free election data APIs |
| Deployment | Vercel (planned) | Free tier, cron support |

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=         # Supabase project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=  # Supabase anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=        # Supabase secret key (server-side only)
OPENFEC_API_KEY=                  # FEC API key (free at api.open.fec.gov)
OPEN_STATES_API_KEY=              # Open States key (free at openstates.org)
GOOGLE_CIVIC_API_KEY=             # Google Civic API key (free via Google Cloud)
ANTHROPIC_API_KEY=                # Claude API key (for AI descriptions)
CRON_SECRET=                      # Protects the cron endpoint in production
```

---

## CLI Commands

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run ingest` | Run all data ingestion adapters |
| `npm run ingest -- openfec` | Ingest only federal election data |
| `npm run ingest -- openstates` | Ingest only state legislature data |
| `npm run ingest -- google-civic` | Ingest only active Google Civic elections |
| `npm run generate-descriptions` | AI-generate missing descriptions (batch of 500) |
| `npm run db:seed` | Seed database with mock election data |
