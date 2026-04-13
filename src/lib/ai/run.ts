/**
 * CLI runner for AI description generation.
 * Usage: npm run generate-descriptions
 *
 * Uses a higher batch limit (500) than the cron job (100)
 * since there's no timeout constraint when running locally.
 */

import "dotenv/config";
import { generateMissingDescriptions } from "./generate-descriptions";

const CLI_BATCH_LIMIT = 500;

generateMissingDescriptions(undefined, CLI_BATCH_LIMIT)
  .then((result) => {
    console.log("\n=== Results ===");
    console.log(`Generated: ${result.generated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors}`);
  })
  .catch((err) => {
    console.error("Generation failed:", err);
    process.exit(1);
  });
