import { NextRequest, NextResponse } from "next/server";
import { runIngestion } from "@/ingestion/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes max (Vercel Pro allows up to 300s)

/**
 * Cron endpoint for automated election data ingestion.
 *
 * Called nightly by Vercel Cron. Can also be triggered manually:
 *   curl http://localhost:3000/api/cron/sync-elections
 *
 * Protected by CRON_SECRET in production to prevent unauthorized triggers.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const results = await runIngestion();

    const summary = {
      timestamp: new Date().toISOString(),
      results,
      totals: {
        created: results.reduce((sum, r) => sum + r.created, 0),
        updated: results.reduce((sum, r) => sum + r.updated, 0),
        skipped: results.reduce((sum, r) => sum + r.skipped, 0),
        errors: results.filter((r) => r.error).length,
      },
    };

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
