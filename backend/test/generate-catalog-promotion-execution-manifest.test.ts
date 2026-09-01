import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCatalogPromotionExecutionManifest } from "../src/scripts/generateCatalogPromotionExecutionManifest.js";

const preview = {
  sourceIdentityCount: 1,
  canonicalIdentityCount: 1,
  duplicateAliasCount: 0,
  blockedIdentityCount: 0,
  rows: [{
    productCode: "P001", sourceName: "New Product", category: "Beverages",
    identityStatus: "CANONICAL", canonicalProductCode: "P001",
    imageStatus: "EXACT_MATCH", assetFileIds: ["img-1"], identityReason: "canonical",
    imageReason: "exact", priceReadiness: "UNVERIFIED_CURRENT_PRICE",
    inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK", operationalAction: "REQUIRES_DATABASE_AUDIT"
  }]
};

const audit = {
  summary: {
    promotionCandidates: 1, existing: 0, new: 1, duplicateAliases: 0, blocked: 0,
    testFixtures: 0, testFixturesWithProtectedReferences: 0,
    developmentSeedProducts: 0, developmentSeedProductsWithProtectedReferences: 0,
    legacyRuntimeQaProducts: 0, legacyRuntimeQaProductsWithProtectedReferences: 0,
    unmatchedOperationalProducts: 0
  },
  candidateRows: [{
    productCode: "P001", sourceName: "New Product", canonicalProductCode: "P001",
    status: "NEW", operationalProductId: null, candidateOperationalProductIds: [], reason: "new"
  }],
  testFixtures: [], developmentSeedProducts: [], legacyRuntimeQaProducts: [], unmatchedOperationalProducts: []
};

const sources = [{
  productCode: "P001", sourceName: "New Product", sourceNameNormalized: "new product",
  category: "Beverages", yearsPresent: [2024, 2025]
}];

test("generator writes read-only JSON, CSV, and Markdown promotion execution artifacts", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "promotion-execution-manifest-"));
  const previewPath = path.join(temp, "preview.json");
  const auditPath = path.join(temp, "audit.json");
  const sourcePath = path.join(temp, "sources.json");
  const jsonPath = path.join(temp, "manifest.json");
  const csvPath = path.join(temp, "manifest.csv");
  const reportPath = path.join(temp, "manifest.md");

  await Promise.all([
    fs.writeFile(previewPath, JSON.stringify(preview), "utf8"),
    fs.writeFile(auditPath, JSON.stringify(audit), "utf8"),
    fs.writeFile(sourcePath, JSON.stringify(sources), "utf8")
  ]);

  const result = await generateCatalogPromotionExecutionManifest({
    previewPath, auditPath, sourcePath, jsonPath, csvPath, reportPath
  });

  assert.equal(result.summary.newCandidates, 1);
  assert.equal(result.summary.readyToCreate, 0);
  assert.equal(result.summary.blockedForRequiredFields, 1);

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.rows[0].plannedSku, "SARIMA-P001");
  assert.equal(json.rows[0].plannedSellingPrice, null);
  assert.equal(json.rows[0].plannedInventoryQuantity, null);

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /productCode,plannedSku/);
  assert.match(csv, /P001,SARIMA-P001/);

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /0 ready to create/i);
  assert.match(report, /sellingPrice/i);
  assert.match(report, /unit/i);
  assert.match(report, /No Product, Inventory, InventoryBatch, mapping, price, or stock data was modified/i);
});
