import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCatalogPromotionRequiredFieldReadiness } from "../src/scripts/generateCatalogPromotionRequiredFieldReadiness.js";

const executionManifest = {
  summary: {
    promotionCandidates: 3,
    newCandidates: 3,
    readyToCreate: 0,
    blockedForRequiredFields: 3,
    excludedExisting: 0,
    excludedDuplicateAliases: 0,
    excludedBlocked: 0
  },
  rows: [
    {
      productCode: "P001",
      plannedSku: "SARIMA-P001",
      plannedName: "Sample Shampoo Sachet 13mL",
      plannedCategory: "Personal Care / Hygiene",
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
      productCode: "P008",
      plannedSku: "SARIMA-P008",
      plannedName: "Century Tuna Flakes in Oil",
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
    },
    {
      productCode: "PX01",
      plannedSku: "SARIMA-PX01",
      plannedName: "Unknown Loose Commodity 500g",
      plannedCategory: "Unreviewed Taxonomy",
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
      { productCode: "P008", historicalSellingPrice2025: 42 },
      { productCode: "PX01", historicalSellingPrice2025: 22 }
    ]
  });

  assert.deepEqual(result.summary, {
    candidates: 3,
    historicalPriceEvidenceAvailable: 3,
    currentPriceVerified: 0,
    explicitUnitResolved: 1,
    unitResolved: 2,
    unitNeedsReview: 1,
    readyToCreate: 0
  });

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.rows[0].historicalSellingPrice2025, 8.5);
  assert.equal(json.rows[0].proposedUnit, "SACHET");
  assert.equal(json.rows[0].currentSellingPrice, null);
  assert.equal(json.rows[1].proposedUnit, "PIECE");
  assert.equal(json.rows[1].unitEvidence, "CATEGORY_SINGLE_RETAIL_ITEM");
  assert.equal(json.rows[2].proposedUnit, null);

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /LAST_RECORDED_HISTORICAL_PRICE_2025/);
  assert.match(csv, /EXPLICIT_SACHET/);
  assert.match(csv, /CATEGORY_SINGLE_RETAIL_ITEM/);

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /historical price/i);
  assert.match(report, /not a verified current selling price/i);
  assert.match(report, /reviewed catalog taxonomy/i);
  assert.match(report, /no Product, Inventory, InventoryBatch/i);
});
