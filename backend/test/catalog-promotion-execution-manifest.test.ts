import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogPromotionExecutionManifest,
  type PromotionExecutionSource
} from "../src/modules/catalog/catalog-promotion-execution-manifest.js";
import type { OperationalCatalogAudit } from "../src/modules/catalog/catalog-operational-audit.js";
import type { CatalogPromotionPreview } from "../src/modules/catalog/catalog-promotion-preview.js";

const preview: CatalogPromotionPreview = {
  sourceIdentityCount: 4,
  canonicalIdentityCount: 2,
  duplicateAliasCount: 1,
  blockedIdentityCount: 1,
  rows: [
    {
      productCode: "P001",
      sourceName: "New Product",
      category: "Beverages",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P001",
      imageStatus: "EXACT_MATCH",
      assetFileIds: ["img-1"],
      identityReason: "canonical",
      imageReason: "exact",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    },
    {
      productCode: "P002",
      sourceName: "Existing Product",
      category: "Snacks",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P002",
      imageStatus: "MISSING_IMAGE",
      assetFileIds: [],
      identityReason: "canonical",
      imageReason: "missing",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    },
    {
      productCode: "P003",
      sourceName: "Alias Product",
      category: "Snacks",
      identityStatus: "DUPLICATE_ALIAS",
      canonicalProductCode: "P002",
      imageStatus: "NEEDS_REVIEW",
      assetFileIds: [],
      identityReason: "alias",
      imageReason: "alias",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    },
    {
      productCode: "P004",
      sourceName: "Blocked Product",
      category: "Household",
      identityStatus: "BLOCKED_REVIEW",
      canonicalProductCode: "P001",
      imageStatus: "NEEDS_REVIEW",
      assetFileIds: [],
      identityReason: "blocked",
      imageReason: "blocked",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    }
  ]
};

const audit: OperationalCatalogAudit = {
  summary: {
    promotionCandidates: 4,
    existing: 1,
    new: 1,
    duplicateAliases: 1,
    blocked: 1,
    testFixtures: 0,
    testFixturesWithProtectedReferences: 0,
    developmentSeedProducts: 0,
    developmentSeedProductsWithProtectedReferences: 0,
    legacyRuntimeQaProducts: 0,
    legacyRuntimeQaProductsWithProtectedReferences: 0,
    unmatchedOperationalProducts: 0
  },
  candidateRows: [
    {
      productCode: "P001",
      sourceName: "New Product",
      canonicalProductCode: "P001",
      status: "NEW",
      operationalProductId: null,
      candidateOperationalProductIds: [],
      reason: "new"
    },
    {
      productCode: "P002",
      sourceName: "Existing Product",
      canonicalProductCode: "P002",
      status: "EXISTING",
      operationalProductId: "db-p002",
      candidateOperationalProductIds: ["db-p002"],
      reason: "existing"
    },
    {
      productCode: "P003",
      sourceName: "Alias Product",
      canonicalProductCode: "P002",
      status: "DUPLICATE_ALIAS",
      operationalProductId: null,
      candidateOperationalProductIds: [],
      reason: "alias"
    },
    {
      productCode: "P004",
      sourceName: "Blocked Product",
      canonicalProductCode: "P001",
      status: "BLOCKED",
      operationalProductId: null,
      candidateOperationalProductIds: [],
      reason: "blocked"
    }
  ],
  testFixtures: [],
  developmentSeedProducts: [],
  legacyRuntimeQaProducts: [],
  unmatchedOperationalProducts: []
};

const sourceByCode = new Map<string, PromotionExecutionSource>([
  [
    "P001",
    {
      productCode: "P001",
      sourceName: "New Product",
      category: "Beverages"
    }
  ],
  [
    "P002",
    {
      productCode: "P002",
      sourceName: "Existing Product",
      category: "Snacks"
    }
  ],
  [
    "P003",
    {
      productCode: "P003",
      sourceName: "Alias Product",
      category: "Snacks"
    }
  ],
  [
    "P004",
    {
      productCode: "P004",
      sourceName: "Blocked Product",
      category: "Household"
    }
  ]
]);

test("promotion execution manifest includes only NEW identities and blocks writes until required product fields are verified", () => {
  const manifest = buildCatalogPromotionExecutionManifest({
    preview,
    audit,
    sources: [...sourceByCode.values()]
  });

  assert.equal(manifest.summary.promotionCandidates, 4);
  assert.equal(manifest.summary.newCandidates, 1);
  assert.equal(manifest.summary.readyToCreate, 0);
  assert.equal(manifest.summary.blockedForRequiredFields, 1);
  assert.equal(manifest.summary.excludedExisting, 1);
  assert.equal(manifest.summary.excludedDuplicateAliases, 1);
  assert.equal(manifest.summary.excludedBlocked, 1);

  const row = manifest.rows[0];
  assert.equal(row?.productCode, "P001");
  assert.equal(row?.plannedSku, "SARIMA-P001");
  assert.equal(row?.plannedName, "New Product");
  assert.equal(row?.plannedCategory, "Beverages");
  assert.equal(row?.plannedSellingPrice, null);
  assert.equal(row?.plannedUnit, null);
  assert.equal(row?.plannedInventoryQuantity, null);
  assert.equal(row?.plannedStorefrontVisible, false);
  assert.equal(row?.plannedDataQualityStatus, "NEEDS_REVIEW");
  assert.equal(row?.plannedRecordSource, "IMPORT");
  assert.equal(row?.imageStatus, "EXACT_MATCH");
  assert.deepEqual(row?.assetFileIds, ["img-1"]);
  assert.equal(row?.writeReadiness, "BLOCKED_REQUIRED_FIELDS");
  assert.deepEqual(row?.blockingFields, ["sellingPrice", "unit"]);
});

test("manifest rejects drift between preview and operational audit coverage", () => {
  assert.throws(
    () =>
      buildCatalogPromotionExecutionManifest({
        preview,
        audit: {
          ...audit,
          candidateRows: audit.candidateRows.slice(0, 3)
        },
        sources: [...sourceByCode.values()]
      }),
    /cover every promotion preview product code exactly once/i
  );
});
