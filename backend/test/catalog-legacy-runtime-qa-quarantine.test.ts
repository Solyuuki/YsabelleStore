import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationalCatalogAudit,
  type OperationalProductSnapshot
} from "../src/modules/catalog/catalog-operational-audit.js";
import {
  LEGACY_RUNTIME_QA_IDENTITIES,
  isLegacyRuntimeQaProduct
} from "../src/modules/catalog/legacy-runtime-qa-identities.js";
import type { CatalogPromotionPreview } from "../src/modules/catalog/catalog-promotion-preview.js";

const zeroRelationships = {
  inventoryBatches: 0,
  inventoryMovements: 0,
  saleItems: 0,
  forecastRecords: 0,
  recommendationRecords: 0,
  historicalMonthlySales: 0,
  historicalSalesImportRows: 0,
  customerOrderItems: 0,
  productReviews: 0,
  imageAssets: 0
};

const preview: CatalogPromotionPreview = {
  sourceIdentityCount: 1,
  canonicalIdentityCount: 1,
  duplicateAliasCount: 0,
  blockedIdentityCount: 0,
  rows: [
    {
      productCode: "P001",
      sourceName: "Unrelated Product",
      category: "Other",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P001",
      imageStatus: "MISSING_IMAGE",
      assetFileIds: [],
      identityReason: "canonical",
      imageReason: "missing",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    }
  ]
};

function product(overrides: Partial<OperationalProductSnapshot> & Pick<OperationalProductSnapshot, "id" | "sku" | "barcode" | "name">): OperationalProductSnapshot {
  return {
    id: overrides.id,
    sku: overrides.sku,
    barcode: overrides.barcode,
    name: overrides.name,
    recordSource: overrides.recordSource ?? "CATALOG",
    dataQualityStatus: overrides.dataQualityStatus ?? "NEEDS_REVIEW",
    sarimaSourceProductId: overrides.sarimaSourceProductId ?? null,
    rawNameAliases: overrides.rawNameAliases ?? [],
    hasInventoryRecord: overrides.hasInventoryRecord ?? true,
    relationshipCounts: overrides.relationshipCounts ?? zeroRelationships
  };
}

test("legacy runtime QA identity list contains the exact three provenance-proven cohort products", () => {
  assert.deepEqual(
    LEGACY_RUNTIME_QA_IDENTITIES.map(({ id, sku, barcode }) => ({ id, sku, barcode })),
    [
      { id: "cmrdl144d0005ibqc05dq8jhv", sku: "PAN-UBE-001", barcode: "4800041123456" },
      { id: "cmrdl14710009ibqcwfyqtuiv", sku: "BEV-WAT-500", barcode: "4800041123463" },
      { id: "cmrdl1482000dibqcle38ptpp", sku: "PAN-BRD-001", barcode: "4800041123470" }
    ]
  );
});

test("legacy runtime QA detection requires exact id, sku, and barcode", () => {
  assert.equal(
    isLegacyRuntimeQaProduct({
      id: "cmrdl144d0005ibqc05dq8jhv",
      sku: "PAN-UBE-001",
      barcode: "4800041123456"
    }),
    true
  );
  assert.equal(
    isLegacyRuntimeQaProduct({
      id: "different-id",
      sku: "PAN-UBE-001",
      barcode: "4800041123456"
    }),
    false
  );
  assert.equal(
    isLegacyRuntimeQaProduct({
      id: "cmrdl144d0005ibqc05dq8jhv",
      sku: "PAN-UBE-001",
      barcode: "different-barcode"
    }),
    false
  );
});

test("operational audit quarantines the legacy runtime QA cohort and preserves protected-reference counts", () => {
  const ube = product({
    id: "cmrdl144d0005ibqc05dq8jhv",
    sku: "PAN-UBE-001",
    barcode: "4800041123456",
    name: "Ube Condensed Milk",
    relationshipCounts: {
      ...zeroRelationships,
      inventoryBatches: 1,
      inventoryMovements: 3,
      saleItems: 3
    }
  });
  const real = product({
    id: "real-unmatched",
    sku: "REAL-001",
    barcode: "4800000000001",
    name: "Real Unmatched Product",
    hasInventoryRecord: false
  });

  const audit = buildOperationalCatalogAudit(preview, [ube, real]);

  assert.equal(audit.summary.legacyRuntimeQaProducts, 1);
  assert.equal(audit.summary.legacyRuntimeQaProductsWithProtectedReferences, 1);
  assert.equal(audit.summary.unmatchedOperationalProducts, 1);
  assert.equal(audit.legacyRuntimeQaProducts[0]?.productId, ube.id);
  assert.equal(audit.legacyRuntimeQaProducts[0]?.protectedReferenceCount, 8);
  assert.equal(audit.unmatchedOperationalProducts[0]?.productId, real.id);
});
