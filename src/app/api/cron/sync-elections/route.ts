import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/ingestion/ingest";
import { generateMissingDescriptions } from "@/lib/ai/generate-descriptions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Cron endpoint for automated election data sync + AI description generation.
 *
 * Runs nightly via Vercel Cron. Two phases:
 *   1. Ingest election data from all API sources
 *   2. Generate AI descriptions for any elections missing them
 *
 * Trigger manually:
 *   curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/sync-elections
 */
export async function GET(request: NextRequest) {
  // Always require authentication — prevents abuse (expensive API calls + AI generation)
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Phase 1: Ingest from data sources
    const ingestionResults = await runIngestion();

    // Phase 2: Generate AI descriptions for new elections
    const aiResults = await generateMissingDescriptions();

    const summary = {
      timestamp: new Date().toISOString(),
      ingestion: {
        results: ingestionResults,
        totals: {
          created: ingestionResults.reduce((sum, r) => sum + r.created, 0),
          updated: ingestionResults.reduce((sum, r) => sum + r.updated, 0),
          skipped: ingestionResults.reduce((sum, r) => sum + r.skipped, 0),
          errors: ingestionResults.filter((r) => r.error).length,
        },
      },
      aiGeneration: aiResults,
    };

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
