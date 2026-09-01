import assert from "node:assert/strict";
import test from "node:test";

import {
  buildImageReconciliationReport,
  toImageReconciliationCsv,
  toImageReconciliationMarkdown
} from "../src/modules/catalog/catalog-image-reconciliation-report.js";
import type { CatalogImageReconciliation } from "../src/modules/catalog/catalog-image-reconciliation.js";

const reconciliation: CatalogImageReconciliation = {
  sourceOutcomes: [
    {
      productCode: "P001",
      sourceName: "Exact Product",
      sourceNameNormalized: "exact product",
      status: "EXACT_MATCH",
      assetFileIds: ["exact-1"],
      reason: "exact"
    },
    {
      productCode: "P002",
      sourceName: "Review Product",
      sourceNameNormalized: "review product",
      status: "NEEDS_REVIEW",
      assetFileIds: ["review-1"],
      reason: "review"
    },
    {
      productCode: "P003",
      sourceName: "Mismatch Product 100g",
      sourceNameNormalized: "mismatch product 100g",
      status: "VARIANT_SIZE_MISMATCH",
      assetFileIds: ["mismatch-1"],
      reason: "mismatch"
    },
    {
      productCode: "P004",
      sourceName: "Duplicate Product",
      sourceNameNormalized: "duplicate product",
      status: "DUPLICATE_IMAGE",
      assetFileIds: ["dup-1", "dup-2"],
      reason: "duplicate"
    },
    {
      productCode: "P005",
      sourceName: "Missing Product",
      sourceNameNormalized: "missing product",
      status: "MISSING_IMAGE",
      assetFileIds: [],
      reason: "missing"
    }
  ],
  driveOnlyAssets: [
    {
      fileId: "drive-only-1",
      filename: "Drive Only.jpg",
      folderId: "folder-1",
      folderName: "Test",
      normalizedStem: "drive only",
      status: "DRIVE_ONLY",
      reason: "drive only"
    }
  ]
};

test("builds deterministic reconciliation status counts", () => {
  const report = buildImageReconciliationReport(reconciliation, 5, 7);

  assert.deepEqual(report.statusCounts, {
    EXACT_MATCH: 1,
    NEEDS_REVIEW: 1,
    VARIANT_SIZE_MISMATCH: 1,
    DUPLICATE_IMAGE: 1,
    MISSING_IMAGE: 1,
    DRIVE_ONLY: 1
  });
  assert.equal(report.sourceCount, 5);
  assert.equal(report.driveAssetCount, 7);
  assert.deepEqual(report.missingProductCodes, ["P005"]);
});

test("renders CSV rows for source outcomes and Drive-only assets", () => {
  const csv = toImageReconciliationCsv(reconciliation);

  assert.match(csv, /^productCode,sourceName,status,fileId,filename,folderName,reason/m);
  assert.match(csv, /P005,Missing Product,MISSING_IMAGE/);
  assert.match(csv, /,,DRIVE_ONLY,drive-only-1,Drive Only\.jpg,Test,drive only/);
});

test("renders an answer-first markdown report with no operational mutation claim", () => {
  const report = buildImageReconciliationReport(reconciliation, 5, 7);
  const markdown = toImageReconciliationMarkdown(report, reconciliation);

  assert.match(markdown, /# Phase 9 Image Reconciliation Report/);
  assert.match(markdown, /No operational Product, Inventory, InventoryBatch, or current-price data was modified/);
  assert.match(markdown, /\| EXACT_MATCH \| 1 \|/);
  assert.match(markdown, /P005 — Missing Product/);
  assert.match(markdown, /Drive Only\.jpg/);
});
