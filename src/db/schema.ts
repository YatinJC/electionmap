import {
  pgTable,
  uuid,
  text,
  date,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// ── Elections ─────────────────────────────────────────────────────

export const elections = pgTable(
  "elections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    office: text("office").notNull(),
    level: text("level").notNull(), // federal, state, county, municipal, special_district
    district: text("district").notNull(),
    date: date("date").notNull(),
    description: text("description"),
    whyItMatters: text("why_it_matters"),
    whyItMattersSource: text("why_it_matters_source").default("manual"), // manual, ai_generated, volunteer
    regionType: text("region_type").notNull(), // nation, state, county
    regionId: text("region_id").notNull(), // FIPS code
    status: text("status").default("active").notNull(), // active, archived, draft
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_elections_region").on(table.regionType, table.regionId),
    index("idx_elections_date").on(table.date),
    index("idx_elections_status").on(table.status),
  ]
);

// ── Candidates ────────────────────────────────────────────────────

export const candidates = pgTable(
  "candidates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    party: text("party"),
    incumbent: boolean("incumbent").default(false).notNull(),
    website: text("website"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_candidates_election").on(table.electionId),
  ]
);

// ── Data Sources (provenance tracking) ────────────────────────────

export const dataSources = pgTable("data_sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(), // e.g. 'google_civic', 'volunteer', 'scraper:fulton_county'
  sourceType: text("source_type").notNull(), // api, scraper, volunteer
  reliability: integer("reliability").default(50).notNull(), // 0-100
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  config: jsonb("config"), // API keys, URLs, scraper params
});

// ── Election ↔ Source junction (tracks where data came from) ──────

export const electionSources = pgTable(
  "election_sources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    electionId: uuid("election_id")
      .notNull()
      .references(() => elections.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => dataSources.id, { onDelete: "cascade" }),
    externalId: text("external_id"), // ID in the source system
    rawData: jsonb("raw_data"), // Original API response
    confidence: integer("confidence").default(50).notNull(), // 0-100
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_election_source_unique").on(table.electionId, table.sourceId),
  ]
);

// ── Type exports for use in app code ──────────────────────────────

export type Election = typeof elections.$inferSelect;
export type NewElection = typeof elections.$inferInsert;
export type Candidate = typeof candidates.$inferSelect;
export type NewCandidate = typeof candidates.$inferInsert;
export type DataSource = typeof dataSources.$inferSelect;
export type ElectionSource = typeof electionSources.$inferSelect;
