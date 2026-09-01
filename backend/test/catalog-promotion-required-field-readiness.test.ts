import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogPromotionRequiredFieldReadiness,
  resolveExplicitProductUnit
} from "../src/modules/catalog/catalog-promotion-required-field-readiness.js";

const baseRow = {
  productCode: "P001",
  plannedSku: "SARIMA-P001",
  plannedName: "Sample Product",
  plannedCategory: "Other",
  plannedSellingPrice: null,
  plannedUnit: null,
  plannedInventoryQuantity: null,
  plannedStorefrontVisible: false as const,
  plannedDataQualityStatus: "NEEDS_REVIEW" as const,
  plannedRecordSource: "IMPORT" as const,
  imageStatus: "MISSING_IMAGE" as const,
  assetFileIds: [] as string[],
  priceReadiness: "UNVERIFIED_CURRENT_PRICE" as const,
  inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK" as const,
  writeReadiness: "BLOCKED_REQUIRED_FIELDS" as const,
  blockingFields: ["sellingPrice", "unit"] as Array<"sellingPrice" | "unit">
};

test("explicit packaging words resolve ProductUnit conservatively", () => {
  assert.deepEqual(resolveExplicitProductUnit("Sunsilk Shampoo Sachet 13mL"), {
    unit: "SACHET",
    evidence: "EXPLICIT_SACHET"
  });
  assert.deepEqual(resolveExplicitProductUnit("Drinking Water Bottle 500mL"), {
    unit: "BOTTLE",
    evidence: "EXPLICIT_BOTTLE"
  });
  assert.deepEqual(resolveExplicitProductUnit("Assorted Biscuits Pack 10s"), {
    unit: "PACK",
    evidence: "EXPLICIT_PACK"
  });
  assert.deepEqual(resolveExplicitProductUnit("Tea Bags Box 25s"), {
    unit: "BOX",
    evidence: "EXPLICIT_BOX"
  });
});

test("unit remains unresolved when packaging is not explicit instead of defaulting to PIECE", () => {
  assert.deepEqual(resolveExplicitProductUnit("Oishi Ridges Barbecue Flavor 60g"), {
    unit: null,
    evidence: "REVIEW_REQUIRED"
  });
  assert.deepEqual(resolveExplicitProductUnit("Ligo Sardines 155g"), {
    unit: null,
    evidence: "REVIEW_REQUIRED"
  });
});

test("historical price is review evidence only and never unlocks current-price readiness", () => {
  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: [
      {
        ...baseRow,
        plannedName: "Sunsilk Shampoo Sachet 13mL"
      },
      {
        ...baseRow,
        productCode: "P002",
        plannedSku: "SARIMA-P002",
        plannedName: "Oishi Ridges Barbecue Flavor 60g"
      }
    ],
    historicalProducts: [
      { productCode: "P001", historicalSellingPrice2025: 8.5 },
      { productCode: "P002", historicalSellingPrice2025: 22 }
    ]
  });

  assert.deepEqual(readiness.summary, {
    candidates: 2,
    historicalPriceEvidenceAvailable: 2,
    currentPriceVerified: 0,
    explicitUnitResolved: 1,
    unitNeedsReview: 1,
    readyToCreate: 0
  });

  const sachet = readiness.rows[0];
  assert.equal(sachet?.historicalSellingPrice2025, 8.5);
  assert.equal(sachet?.historicalPriceMeaning, "LAST_RECORDED_HISTORICAL_PRICE_2025");
  assert.equal(sachet?.currentSellingPrice, null);
  assert.equal(sachet?.currentPriceReadiness, "UNVERIFIED");
  assert.equal(sachet?.proposedUnit, "SACHET");
  assert.equal(sachet?.unitEvidence, "EXPLICIT_SACHET");
  assert.equal(sachet?.writeReadiness, "BLOCKED_CURRENT_PRICE");

  const unresolved = readiness.rows[1];
  assert.equal(unresolved?.proposedUnit, null);
  assert.equal(unresolved?.unitEvidence, "REVIEW_REQUIRED");
  assert.equal(unresolved?.writeReadiness, "BLOCKED_CURRENT_PRICE_AND_UNIT");
});
