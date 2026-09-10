import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOperationalCatalogAudit,
  type OperationalProductSnapshot
} from "../src/modules/catalog/catalog-operational-audit.js";
import {
  DEVELOPMENT_CATALOG_SEED_IDENTITIES,
  isDevelopmentCatalogSeedProduct
} from "../src/modules/catalog/development-catalog-seed-identities.js";
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

function product(
  overrides: Partial<OperationalProductSnapshot> &
    Pick<OperationalProductSnapshot, "id" | "name" | "sku">
): OperationalProductSnapshot {
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
    relationshipCounts: overrides.relationshipCounts ?? zeroRelationships
  };
}

const preview: CatalogPromotionPreview = {
  sourceIdentityCount: 1,
  canonicalIdentityCount: 1,
  duplicateAliasCount: 0,
  blockedIdentityCount: 0,
  rows: [
    {
      productCode: "P001",
      sourceName: "Unrelated Real Product",
      category: "Beverages",
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

test("development catalog seed identity list contains the exact eight legacy sample products", () => {
  assert.deepEqual(
    DEVELOPMENT_CATALOG_SEED_IDENTITIES.map(({ id, sku }) => ({ id, sku })),
    [
      { id: "prd_cola_15l", sku: "BEV-COLA-001" },
      { id: "prd_mineral_water_500ml", sku: "BEV-WATER-001" },
      { id: "prd_sardines_155g", sku: "CAN-SARD-001" },
      { id: "prd_cheese_crackers", sku: "SNK-CRACK-001" },
      { id: "prd_beef_noodles", sku: "NDL-BEEF-001" },
      { id: "prd_shampoo_180ml", sku: "TOI-SHAMP-001" },
      { id: "prd_dishwashing_liquid", sku: "HSE-DISH-001" },
      { id: "prd_hand_sanitizer", sku: "TOI-SANI-001" }
    ]
  );
});

test("development seed detection requires the exact seeded id and sku pair", () => {
  assert.equal(
    isDevelopmentCatalogSeedProduct({ id: "prd_mineral_water_500ml", sku: "BEV-WATER-001" }),
    true
  );
  assert.equal(
    isDevelopmentCatalogSeedProduct({ id: "different-id", sku: "BEV-WATER-001" }),
    false
  );
  assert.equal(
    isDevelopmentCatalogSeedProduct({ id: "prd_mineral_water_500ml", sku: "DIFFERENT-SKU" }),
    false
  );
});

test("operational audit quarantines exact development seeds without hiding near-collision operational rows", () => {
  const seeded = product({
    id: "prd_mineral_water_500ml",
    sku: "BEV-WATER-001",
    name: "Mineral Water 500ml",
    hasInventoryRecord: true,
    relationshipCounts: {
      ...zeroRelationships,
      inventoryMovements: 2,
      saleItems: 1
    }
  });
  const nearCollision = product({
    id: "real-water-candidate",
    sku: "BEV-WATER-001",
    name: "Mineral Water 500ml"
  });

  const audit = buildOperationalCatalogAudit(preview, [seeded, nearCollision]);

  assert.equal(audit.summary.developmentSeedProducts, 1);
  assert.equal(audit.summary.developmentSeedProductsWithProtectedReferences, 1);
  assert.equal(audit.summary.unmatchedOperationalProducts, 1);
  assert.equal(audit.developmentSeedProducts[0]?.productId, seeded.id);
  assert.equal(audit.developmentSeedProducts[0]?.protectedReferenceCount, 4);
  assert.equal(audit.unmatchedOperationalProducts[0]?.productId, nearCollision.id);
});
