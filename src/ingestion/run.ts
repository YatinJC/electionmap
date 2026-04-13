/**
 * CLI ingestion runner
 *
 * Usage:
 *   npm run ingest              # run all adapters
 *   npm run ingest -- openfec   # run only OpenFEC
 *   npm run ingest -- openstates
 *   npm run ingest -- google-civic
 */

import "dotenv/config";
import { runIngestion, type Adapter } from "./ingest";

const adapterArg = process.argv[2] as Adapter | undefined;
const adapters = adapterArg ? [adapterArg] : undefined;

runIngestion(adapters)
  .then((results) => {
    console.log("\n=== Results ===");
    let totalCreated = 0;
    let totalUpdated = 0;
    for (const r of results) {
      console.log(`  [${r.source}] Created: ${r.created}, Updated: ${r.updated}, Skipped: ${r.skipped}${r.error ? ` ERROR: ${r.error}` : ""}`);
      totalCreated += r.created;
      totalUpdated += r.updated;
    }
    console.log(`  Total: ${totalCreated} created, ${totalUpdated} updated`);
  })
  .catch((err) => {
    console.error("Ingestion failed:", err);
    process.exit(1);
  });
