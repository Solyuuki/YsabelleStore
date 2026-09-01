import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateCatalogPromotionRequiredFieldReadiness
} from "../src/scripts/generateCatalogPromotionRequiredFieldReadiness.js";

const executionManifest = {
  summary: {
    promotionCandidates: 2,
    newCandidates: 2,
    readyToCreate: 0,
    blockedForRequiredFields: 2,
    excludedExisting: 0,
    excludedDuplicateAliases: 0,
    excludedBlocked: 0
  },
  rows: [
    {
      productCode: "P001",
      plannedSku: "SARIMA-P001",
      plannedName: "Sample Shampoo Sachet 13mL",
      plannedCategory: "Personal Care",
      plannedSellingPrice: null,
      plannedUnit: null,
      plannedInventoryQuantity: null,
      plannedStorefrontVisible: false,
      plannedDataQualityStatus: "NEEDS_REVIEW",
      plannedRecordSource: "IMPORT",
      imageStatus: "EXACT_MATCH",
      assetFileIds: ["drive-a"],
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      writeReadiness: "BLOCKED_REQUIRED_FIELDS",
      blockingFields: ["sellingPrice", "unit"]
    },
    {
      productCode: "P002",
      plannedSku: "SARIMA-P002",
      plannedName: "Sample Sardines 155g",
      plannedCategory: "Canned Goods",
      plannedSellingPrice: null,
      plannedUnit: null,
      plannedInventoryQuantity: null,
      plannedStorefrontVisible: false,
      plannedDataQualityStatus: "NEEDS_REVIEW",
      plannedRecordSource: "IMPORT",
      imageStatus: "MISSING_IMAGE",
      assetFileIds: [],
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      writeReadiness: "BLOCKED_REQUIRED_FIELDS",
      blockingFields: ["sellingPrice", "unit"]
    }
  ]
};

test("required-field readiness generator writes read-only JSON, CSV, and Markdown evidence", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-required-field-readiness-"));
  const executionManifestPath = path.join(temp, "execution.json");
  const jsonPath = path.join(temp, "readiness.json");
  const csvPath = path.join(temp, "readiness.csv");
  const reportPath = path.join(temp, "readiness.md");

  await fs.writeFile(executionManifestPath, JSON.stringify(executionManifest), "utf8");

  const result = await generateCatalogPromotionRequiredFieldReadiness({
    executionManifestPath,
    jsonPath,
    csvPath,
    reportPath,
    historicalProducts: [
      { productCode: "P001", historicalSellingPrice2025: 8.5 },
      { productCode: "P002", historicalSellingPrice2025: 22 }
    ]
  });

  assert.deepEqual(result.summary, {
    candidates: 2,
    historicalPriceEvidenceAvailable: 2,
    currentPriceVerified: 0,
    explicitUnitResolved: 1,
    unitNeedsReview: 1,
    readyToCreate: 0
  });

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.rows[0].historicalSellingPrice2025, 8.5);
  assert.equal(json.rows[0].proposedUnit, "SACHET");
  assert.equal(json.rows[0].currentSellingPrice, null);

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /LAST_RECORDED_HISTORICAL_PRICE_2025/);
  assert.match(csv, /EXPLICIT_SACHET/);

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /historical price/i);
  assert.match(report, /not a verified current selling price/i);
  assert.match(report, /no Product, Inventory, InventoryBatch/i);
});
