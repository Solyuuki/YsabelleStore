import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationalCatalogAudit,
  type OperationalProductSnapshot
} from "../src/modules/catalog/catalog-operational-audit.js";
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

test("blocked historical identity still surfaces matching operational candidates without auto-mapping them", () => {
  const preview: CatalogPromotionPreview = {
    sourceIdentityCount: 1,
    canonicalIdentityCount: 0,
    duplicateAliasCount: 0,
    blockedIdentityCount: 1,
    rows: [
      {
        productCode: "P144",
        sourceName: "Ligo Sardines in Tomato Sauce Chili Added 155g",
        category: "Canned Goods",
        identityStatus: "BLOCKED_REVIEW",
        canonicalProductCode: "P014",
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

  const product: OperationalProductSnapshot = {
    id: "prd_sarima_p144_ligo_sardines_155g",
    sku: "SARIMA-P144",
    barcode: null,
    name: "Ligo Sardines in Tomato Sauce, Chili Added 155g",
    recordSource: "IMPORT",
    dataQualityStatus: "APPROVED",
    sarimaSourceProductId: null,
    rawNameAliases: [],
    hasInventoryRecord: false,
    relationshipCounts: zeroRelationships
  };

  const audit = buildOperationalCatalogAudit(preview, [product]);
  const row = audit.candidateRows[0];

  assert.equal(row?.status, "BLOCKED");
  assert.equal(row?.operationalProductId, null);
  assert.deepEqual(row?.candidateOperationalProductIds, [product.id]);
  assert.match(row?.reason ?? "", /manual canonical review/i);
  assert.equal(audit.summary.unmatchedOperationalProducts, 0);
});
