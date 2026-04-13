/**
 * AI Description Generator
 *
 * Generates "What is this?" and "Why it matters" content for elections
 * that are missing descriptions. Uses Claude Sonnet for cost efficiency.
 *
 * Design principles:
 * - Nonpartisan: no endorsements, no predictions, no policy opinions
 * - Specific: tied to THIS region and THIS race, not generic boilerplate
 * - Actionable: tells the reader what the office controls and how it affects them
 * - Concise: 2-3 sentences for description, 2-4 for why it matters
 */

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BATCH_LIMIT = 100; // Cron default — fits within Vercel's 5min timeout

interface ElectionRow {
  id: string;
  office: string;
  level: string;
  district: string;
  date: string;
  region_type: string;
  region_id: string;
  description: string | null;
  why_it_matters: string | null;
  why_it_matters_source: string | null;
  candidates: {
    name: string;
    party: string;
    incumbent: boolean;
  }[];
}

interface GenerationResult {
  generated: number;
  skipped: number;
  errors: number;
}

function buildPrompt(election: ElectionRow): string {
  const candidateList = election.candidates
    .map(
      (c) =>
        `${c.name} (${c.party}${c.incumbent ? ", incumbent" : ""})`
    )
    .join(", ");

  return `You are writing for ElectionMap, a nonpartisan civic tool that helps Americans understand what elections are happening near them.

For the following election, write two short sections:

1. **DESCRIPTION**: What does this office do? Explain the role's powers and responsibilities in plain language. 2-3 sentences. Be specific to this jurisdiction, not generic.

2. **WHY_IT_MATTERS**: Why should a voter in this area care about this specific race? Connect it to real, tangible impacts on daily life — things like utility bills, school quality, road conditions, public safety, water supply, tax rates. 2-4 sentences. Be specific to the region and current context. Do NOT make partisan statements, endorse candidates, or predict outcomes.

Election details:
- Office: ${election.office}
- Level: ${election.level}
- District: ${election.district}
- Election date: ${election.date}
- Region type: ${election.region_type} (ID: ${election.region_id})
${candidateList ? `- Candidates: ${candidateList}` : "- Candidates: Not yet announced"}

Respond in exactly this format (no markdown, no extra text):
DESCRIPTION: [your description here]
WHY_IT_MATTERS: [your why it matters here]`;
}

function parseResponse(text: string): { description: string; whyItMatters: string } | null {
  const descIdx = text.indexOf("DESCRIPTION:");
  const whyIdx = text.indexOf("WHY_IT_MATTERS:");

  if (descIdx === -1 || whyIdx === -1) return null;

  const description = text.substring(descIdx + "DESCRIPTION:".length, whyIdx).trim();
  const whyItMatters = text.substring(whyIdx + "WHY_IT_MATTERS:".length).trim();

  if (!description || !whyItMatters) return null;

  return { description, whyItMatters };
}

async function generateForElection(
  anthropic: Anthropic,
  election: ElectionRow
): Promise<{ description: string; whyItMatters: string } | null> {
  const prompt = buildPrompt(election);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";
  return parseResponse(text);
}

/**
 * Find elections missing descriptions and generate them.
 * Returns a summary of what was generated.
 */
export async function generateMissingDescriptions(
  supabase?: SupabaseClient,
  batchLimit: number = DEFAULT_BATCH_LIMIT
): Promise<GenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set, skipping AI generation");
    return { generated: 0, skipped: 0, errors: 0 };
  }

  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Supabase env vars not set");
    supabase = createClient(url, key);
  }

  const anthropic = new Anthropic({ apiKey });

  // Find elections missing either description or why_it_matters.
  // Skip elections where a human has already written content.
  // Note: why_it_matters_source is null for most API-ingested elections,
  // "manual" for seed data, "volunteer" for community edits, "ai_generated" for prior AI runs.
  const { data: elections, error } = await supabase
    .from("elections")
    .select(`
      id, office, level, district, date, region_type, region_id,
      description, why_it_matters, why_it_matters_source,
      candidates (name, party, incumbent)
    `)
    .eq("status", "active")
    .or("description.is.null,why_it_matters.is.null")
    .or("why_it_matters_source.is.null,why_it_matters_source.eq.ai_generated")
    .limit(batchLimit);

  if (error) {
    console.error("Failed to fetch elections:", error.message);
    return { generated: 0, skipped: 0, errors: 1 };
  }

  if (!elections || elections.length === 0) {
    console.log("No elections need descriptions");
    return { generated: 0, skipped: 0, errors: 0 };
  }

  console.log(`Generating descriptions for ${elections.length} elections...`);

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in parallel batches. Concurrency is configurable via env var
  // to match your Anthropic API tier:
  //   Tier 1 (new accounts): 50 req/min → CONCURRENCY=10, delay=12s/batch
  //   Tier 2: 1000 req/min → CONCURRENCY=40, delay=3s/batch
  //   Tier 3+: 2000+ req/min → CONCURRENCY=50, minimal delay
  const CONCURRENCY = parseInt(process.env.AI_CONCURRENCY || "10", 10);
  const electionList = elections as ElectionRow[];

  console.log(`  Concurrency: ${CONCURRENCY} (set AI_CONCURRENCY env var to change)`);

  for (let i = 0; i < electionList.length; i += CONCURRENCY) {
    const batch = electionList.slice(i, i + CONCURRENCY);
    const batchStart = Date.now();
    process.stdout.write(`\r  Processing ${i + batch.length}/${electionList.length} (${generated} generated, ${errors} errors)...`);

    const results = await Promise.allSettled(
      batch.map(async (election) => {
        const result = await generateForElection(anthropic, election);
        if (!result) throw new Error("Failed to parse");

        const updates: Record<string, string> = {};
        if (!election.description) {
          updates.description = result.description;
        }
        if (!election.why_it_matters) {
          updates.why_it_matters = result.whyItMatters;
          updates.why_it_matters_source = "ai_generated";
        }

        if (Object.keys(updates).length > 0) {
          updates.updated_at = new Date().toISOString();
          await supabase!.from("elections").update(updates).eq("id", election.id);
          return "generated";
        }
        return "skipped";
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value === "generated") generated++;
        else skipped++;
      } else {
        errors++;
      }
    }

    // Rate limiting: ensure we don't exceed ~50 requests/minute (Tier 1)
    // Each batch = CONCURRENCY requests. We need 60s / (50/CONCURRENCY) between batches.
    const elapsed = Date.now() - batchStart;
    const minBatchTime = (CONCURRENCY / 50) * 60 * 1000; // ms per batch to stay under 50 req/min
    const delay = Math.max(0, minBatchTime - elapsed);
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  console.log(`\n  Done! Generated: ${generated}, Skipped: ${skipped}, Errors: ${errors}`);
  return { generated, skipped, errors };
}
