import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationalCatalogAudit,
  type OperationalProductSnapshot
} from "../src/modules/catalog/catalog-operational-audit.js";
import type { CatalogPromotionPreview } from "../src/modules/catalog/catalog-promotion-preview.js";

function product(overrides: Partial<OperationalProductSnapshot> & Pick<OperationalProductSnapshot, "id" | "name" | "sku">): OperationalProductSnapshot {
  return {
    id: overrides.id,
    sku: overrides.sku,
    barcode: overrides.barcode ?? null,
    name: overrides.name,
    recordSource: overrides.recordSource ?? "CATALOG",
    dataQualityStatus: overrides.dataQualityStatus ?? "NEEDS_REVIEW",
    sarimaSourceProductId: overrides.sarimaSourceProductId ?? null,
    rawNameAliases: overrides.rawNameAliases ?? [],
    hasInventoryRecord: overrides.hasInventoryRecord ?? false,
    relationshipCounts: overrides.relationshipCounts ?? {
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
    }
  };
}

const preview: CatalogPromotionPreview = {
  sourceIdentityCount: 5,
  canonicalIdentityCount: 3,
  duplicateAliasCount: 1,
  blockedIdentityCount: 1,
  rows: [
    {
      productCode: "P001",
      sourceName: "Mapped Product",
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
      sourceName: "Potential Existing Product",
      category: "Snacks",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P002",
      imageStatus: "EXACT_MATCH",
      assetFileIds: ["img-2"],
      identityReason: "canonical",
      imageReason: "exact",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    },
    {
      productCode: "P003",
      sourceName: "Historical Alias",
      category: "Beverages",
      identityStatus: "DUPLICATE_ALIAS",
      canonicalProductCode: "P001",
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
      sourceName: "Blocked Family Product",
      category: "Personal Care",
      identityStatus: "BLOCKED_REVIEW",
      canonicalProductCode: "P001",
      imageStatus: "NEEDS_REVIEW",
      assetFileIds: [],
      identityReason: "blocked",
      imageReason: "blocked",
      priceReadiness: "UNVERIFIED_CURRENT_PRICE",
      inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
      operationalAction: "REQUIRES_DATABASE_AUDIT"
    },
    {
      productCode: "P005",
      sourceName: "Fresh Real Product",
      category: "Bread",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P005",
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

test("operational audit separates mapped existing, ambiguous existing, new, alias, blocked, and test fixtures", () => {
  const products: OperationalProductSnapshot[] = [
    product({
      id: "db-mapped",
      sku: "REAL-001",
      name: "Mapped Product",
      dataQualityStatus: "APPROVED",
      sarimaSourceProductId: "P001"
    }),
    product({
      id: "db-name-collision",
      sku: "REAL-002",
      name: "Potential Existing Product"
    }),
    product({
      id: "db-test",
      sku: "POSPAQ-Q-999",
      name: "Fresh Real Product",
      recordSource: "TEST_FIXTURE",
      relationshipCounts: {
        inventoryBatches: 0,
        inventoryMovements: 0,
        saleItems: 2,
        forecastRecords: 0,
        recommendationRecords: 0,
        historicalMonthlySales: 0,
        historicalSalesImportRows: 0,
        customerOrderItems: 0,
        productReviews: 0,
        imageAssets: 0
      }
    }),
    product({
      id: "db-unmatched-real",
      sku: "REAL-UNMATCHED",
      name: "Legacy Unmatched Product"
    })
  ];

  const audit = buildOperationalCatalogAudit(preview, products);

  assert.equal(audit.summary.promotionCandidates, 5);
  assert.equal(audit.summary.existing, 1);
  assert.equal(audit.summary.new, 1);
  assert.equal(audit.summary.duplicateAliases, 1);
  assert.equal(audit.summary.blocked, 2);
  assert.equal(audit.summary.testFixtures, 1);
  assert.equal(audit.summary.testFixturesWithProtectedReferences, 1);
  assert.equal(audit.summary.unmatchedOperationalProducts, 1);

  const mapped = audit.candidateRows.find((row: { productCode: string }) => row.productCode === "P001");
  assert.equal(mapped?.status, "EXISTING");
  assert.equal(mapped?.operationalProductId, "db-mapped");

  const ambiguous = audit.candidateRows.find((row: { productCode: string }) => row.productCode === "P002");
  assert.equal(ambiguous?.status, "BLOCKED");
  assert.deepEqual(ambiguous?.candidateOperationalProductIds, ["db-name-collision"]);

  const alias = audit.candidateRows.find((row: { productCode: string }) => row.productCode === "P003");
  assert.equal(alias?.status, "DUPLICATE_ALIAS");
  assert.equal(alias?.canonicalProductCode, "P001");

  const blocked = audit.candidateRows.find((row: { productCode: string }) => row.productCode === "P004");
  assert.equal(blocked?.status, "BLOCKED");

  const fresh = audit.candidateRows.find((row: { productCode: string }) => row.productCode === "P005");
  assert.equal(fresh?.status, "NEW");
  assert.deepEqual(fresh?.candidateOperationalProductIds, []);

  assert.equal(audit.testFixtures[0]?.productId, "db-test");
  assert.equal(audit.testFixtures[0]?.protectedReferenceCount, 2);
  assert.equal(audit.unmatchedOperationalProducts[0]?.productId, "db-unmatched-real");
});

test("a canonical source mapped to a TEST_FIXTURE product is blocked instead of treated as existing", () => {
  const products: OperationalProductSnapshot[] = [
    product({
      id: "db-bad-map",
      sku: "POSPAQ-Q-001",
      name: "Mapped Product",
      recordSource: "TEST_FIXTURE",
      sarimaSourceProductId: "P001"
    })
  ];

  const audit = buildOperationalCatalogAudit(preview, products);
  const row = audit.candidateRows.find((candidate: { productCode: string }) => candidate.productCode === "P001");

  assert.equal(row?.status, "BLOCKED");
  assert.match(row?.reason ?? "", /test fixture/i);
});
