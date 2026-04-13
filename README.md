# ElectionMap

**Every Election, Everywhere.**

An interactive map of the United States that shows every upcoming election - from Senate races to school boards - with plain-language explanations of what each office does and why it matters.

## Why

There are roughly 500,000 elected positions in the US. Most voters only know about a handful. Down-ballot elections — utility commissions, school boards, county judges — directly control daily life but have the lowest awareness and turnout.

In 2025, Hank Green made a video about Georgia's Public Service Commission. His 850,000-view video led to a turnout surge that flipped two seats. But it shouldn't require being Hank Green to find out about these elections.

ElectionMap makes every election discoverable. Anyone can explore the map, see what's on the ballot anywhere in the country, and share it.

## Features

- **Zoomable map** with state, county, and congressional district boundaries
- **Hover to preview** elections in any area, **click to pin** and read details
- **Every level of government** — federal, state, county, municipal, special district
- **"What is this?"** — plain-language explanation of what each office does
- **"Why it matters"** — specific to the region, connecting to real daily-life impacts
- **Time window filter** — show elections in the next 1 month to 2 years
- **Level filter** — toggle federal, state, county, municipal, special district
- **Congressional district overlay** — see district shapes (gerrymandering visibility)
- **AI-generated descriptions** with clear labeling, ready for volunteer improvement
- **Automated daily data sync** from OpenFEC, Open States, and Google Civic APIs

## Current Data

| Source | Coverage | Elections |
|--------|----------|-----------|
| OpenFEC | All 2026 Senate + House candidates | ~500 |
| Open States | State legislature incumbents | ~550 |
| Google Civic | Active elections near election day | Adapter ready |
| **Total** | | **~1,050** |

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/YatinJC/electionmap.git
   cd electionmap
   npm install
   ```

2. Create `.env.local` with your keys:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-secret-key
   OPENFEC_API_KEY=your-key          # free at api.open.fec.gov
   OPEN_STATES_API_KEY=your-key      # free at openstates.org
   GOOGLE_CIVIC_API_KEY=your-key     # free via Google Cloud
   ANTHROPIC_API_KEY=your-key        # for AI descriptions
   ```

3. Create database tables — run `supabase-setup.sql` in the Supabase SQL Editor

4. Ingest election data:
   ```bash
   npm run ingest
   ```

5. Generate AI descriptions (optional):
   ```bash
   npm run generate-descriptions
   ```

6. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run ingest` | Run all data ingestion adapters |
| `npm run ingest -- openfec` | Ingest only federal election data |
| `npm run ingest -- openstates` | Ingest only state legislature data |
| `npm run ingest -- google-civic` | Ingest only active Google Civic elections |
| `npm run generate-descriptions` | AI-generate missing descriptions (batch of 500) |

## Tech Stack

- **Framework:** Next.js 16, React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Map:** Leaflet + react-leaflet, CARTO dark tiles
- **Geo data:** Census TIGER/Line (states, counties, congressional districts)
- **Spatial:** Turf.js (point-in-polygon for district lookup)
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude Sonnet (description generation)
- **Data:** OpenFEC, Open States, Google Civic Information API

## Architecture

The app has three layers:

1. **Data ingestion** — adapters fetch from election APIs, normalize, deduplicate, and upsert into Supabase. Runs nightly via Vercel Cron.
2. **API** — Next.js route handlers serve election data filtered by location, time window, and government level.
3. **Map frontend** — Leaflet renders GeoJSON boundaries with imperative style updates for smooth hover performance.

See [ROADMAP.md](ROADMAP.md) for the full development plan including upcoming phases (volunteer editing system, AI scrapers for local government websites).

## Contributing

This project is in active development. The biggest needs are:

- **Data sources** — access to BallotReady or Democracy Works APIs for local election coverage
- **"Why it matters" content** — improving AI-generated descriptions with human-written context
- **Testing** — verifying election data accuracy across states
-**Localization and Accessibility** - More languages, accommodations for vision impairments, other ideas idk

## License

MIT
