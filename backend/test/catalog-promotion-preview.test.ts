import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogPromotionPreview } from "../src/modules/catalog/catalog-promotion-preview.js";
import type { CatalogImageReconciliation } from "../src/modules/catalog/catalog-image-reconciliation.js";
import type { SarimaSourceIdentity } from "../src/modules/catalog/sarima-source-manifest.js";

function source(productCode: string, sourceName: string): SarimaSourceIdentity {
  return {
    category: "Test",
    productCode,
    sourceName,
    sourceNameNormalized: sourceName.toLowerCase(),
    yearsPresent: [2024, 2025]
  };
}

test("promotion preview separates canonical identity from image readiness", () => {
  const sources = [
    source("P001", "Exact Product"),
    source("P002", "Alias Product"),
    source("P003", "Missing Image Product"),
    source("P004", "Review Product")
  ];
  const reconciliation: CatalogImageReconciliation = {
    sourceOutcomes: [
      {
        productCode: "P001",
        sourceName: "Exact Product",
        sourceNameNormalized: "exact product",
        status: "EXACT_MATCH",
        assetFileIds: ["img-1"],
        reason: "Normalized source and Drive identities match exactly."
      },
      {
        productCode: "P002",
        sourceName: "Alias Product",
        sourceNameNormalized: "alias product",
        status: "NEEDS_REVIEW",
        assetFileIds: [],
        reason: "Token-equivalent historical source identity overlaps P001; review source identity before assigning another Drive image."
      },
      {
        productCode: "P003",
        sourceName: "Missing Image Product",
        sourceNameNormalized: "missing image product",
        status: "MISSING_IMAGE",
        assetFileIds: [],
        reason: "No defensible Drive image candidate was found."
      },
      {
        productCode: "P004",
        sourceName: "Review Product",
        sourceNameNormalized: "review product",
        status: "NEEDS_REVIEW",
        assetFileIds: ["img-4"],
        reason: "Product-family tokens are compatible, but one side omits identity or packaging descriptors."
      }
    ],
    driveOnlyAssets: []
  };

  const preview = buildCatalogPromotionPreview(sources, reconciliation);

  assert.equal(preview.sourceIdentityCount, 4);
  assert.equal(preview.canonicalIdentityCount, 2);
  assert.equal(preview.duplicateAliasCount, 1);
  assert.equal(preview.blockedIdentityCount, 1);

  const exact = preview.rows.find((row) => row.productCode === "P001");
  assert.equal(exact?.identityStatus, "CANONICAL");
  assert.equal(exact?.imageStatus, "EXACT_MATCH");

  const alias = preview.rows.find((row) => row.productCode === "P002");
  assert.equal(alias?.identityStatus, "DUPLICATE_ALIAS");
  assert.equal(alias?.canonicalProductCode, "P001");

  const missing = preview.rows.find((row) => row.productCode === "P003");
  assert.equal(missing?.identityStatus, "CANONICAL");
  assert.equal(missing?.imageStatus, "MISSING_IMAGE");

  const blocked = preview.rows.find((row) => row.productCode === "P004");
  assert.equal(blocked?.identityStatus, "BLOCKED_REVIEW");
});

test("promotion preview rejects reconciliation that does not cover every source identity exactly once", () => {
  const sources = [source("P001", "One"), source("P002", "Two")];
  const reconciliation: CatalogImageReconciliation = {
    sourceOutcomes: [
      {
        productCode: "P001",
        sourceName: "One",
        sourceNameNormalized: "one",
        status: "EXACT_MATCH",
        assetFileIds: ["img-1"],
        reason: "Normalized source and Drive identities match exactly."
      }
    ],
    driveOnlyAssets: []
  };

  assert.throws(
    () => buildCatalogPromotionPreview(sources, reconciliation),
    /cover every SARIMA source identity exactly once/i
  );
});
