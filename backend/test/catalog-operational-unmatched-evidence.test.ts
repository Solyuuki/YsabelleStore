import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationalCatalogAudit,
  type OperationalProductSnapshot
} from "../src/modules/catalog/catalog-operational-audit.js";
import type { CatalogPromotionPreview } from "../src/modules/catalog/catalog-promotion-preview.js";

const preview: CatalogPromotionPreview = {
  sourceIdentityCount: 1,
  canonicalIdentityCount: 1,
  duplicateAliasCount: 0,
  blockedIdentityCount: 0,
  rows: [
    {
      productCode: "P001",
      sourceName: "Different Product",
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

const product: OperationalProductSnapshot = {
  id: "db-unmatched",
  sku: "REAL-UNMATCHED",
  barcode: "4800000000999",
  name: "Unmatched Product",
  recordSource: "IMPORT",
  dataQualityStatus: "NEEDS_REVIEW",
  sarimaSourceProductId: null,
  rawNameAliases: [],
  hasInventoryRecord: true,
  relationshipCounts: {
    inventoryBatches: 2,
    inventoryMovements: 3,
    saleItems: 4,
    forecastRecords: 1,
    recommendationRecords: 0,
    historicalMonthlySales: 0,
    historicalSalesImportRows: 0,
    customerOrderItems: 1,
    productReviews: 0,
    imageAssets: 1
  }
};

test("unmatched operational rows include identity and protected-reference evidence for manual review", () => {
  const audit = buildOperationalCatalogAudit(preview, [product]);
  const row = audit.unmatchedOperationalProducts[0];

  assert.equal(row?.productId, product.id);
  assert.equal(row?.sku, product.sku);
  assert.equal(row?.barcode, product.barcode);
  assert.equal(row?.recordSource, "IMPORT");
  assert.equal(row?.hasInventoryRecord, true);
  assert.deepEqual(row?.relationshipCounts, product.relationshipCounts);
  assert.equal(row?.protectedReferenceCount, 13);
});
