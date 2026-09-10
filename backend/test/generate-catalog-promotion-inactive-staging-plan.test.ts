import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCatalogPromotionInactiveStagingPlan } from "../src/scripts/generateCatalogPromotionInactiveStagingPlan.js";

test("inactive staging generator writes read-only JSON CSV and Markdown artifacts", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-inactive-staging-"));
  const executionPath = path.join(temp, "execution.json");
  const readinessPath = path.join(temp, "readiness.json");
  const jsonPath = path.join(temp, "staging.json");
  const csvPath = path.join(temp, "staging.csv");
  const reportPath = path.join(temp, "staging.md");

  await fs.writeFile(
    executionPath,
    JSON.stringify({
      rows: [
        {
          productCode: "P001",
          plannedSku: "SARIMA-P001",
          plannedName: "Sample Shampoo Sachet 13mL",
          plannedCategory: "Personal Care",
          imageStatus: "EXACT_MATCH",
          assetFileIds: ["drive-1"]
        }
      ]
    }),
    "utf8"
  );

  await fs.writeFile(
    readinessPath,
    JSON.stringify({
      rows: [
        {
          productCode: "P001",
          historicalSellingPrice2025: 8.5,
          historicalPriceMeaning: "LAST_RECORDED_HISTORICAL_PRICE_2025",
          currentSellingPrice: null,
          currentPriceReadiness: "UNVERIFIED",
          proposedUnit: "SACHET",
          unitEvidence: "EXPLICIT_SACHET"
        }
      ]
    }),
    "utf8"
  );

  const result = await generateCatalogPromotionInactiveStagingPlan({
    executionPath,
    readinessPath,
    jsonPath,
    csvPath,
    reportPath
  });

  assert.equal(result.summary.stageableInactiveIdentities, 1);

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.stageableRows[0].plannedStatus, "INACTIVE");
  assert.equal(json.stageableRows[0].sellingPriceUsage, "PROVISIONAL_INACTIVE_ONLY");

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /P001/);
  assert.match(csv, /INACTIVE/);
  assert.match(csv, /PROVISIONAL_INACTIVE_ONLY/);

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /No Product, Inventory, InventoryBatch, or mapping data was modified/i);
  assert.match(report, /provisional/i);
});
