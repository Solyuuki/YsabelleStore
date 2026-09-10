import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogPromotionInactiveStagingPlan,
  type InactiveStagingExecutionRow,
  type InactiveStagingReadinessRow
} from "../src/modules/catalog/catalog-promotion-inactive-staging-plan.js";

const executionRows: InactiveStagingExecutionRow[] = [
  {
    productCode: "P001",
    plannedSku: "SARIMA-P001",
    plannedName: "Sample Shampoo Sachet 13mL",
    plannedCategory: "Personal Care",
    imageStatus: "EXACT_MATCH",
    assetFileIds: ["drive-1"]
  },
  {
    productCode: "P002",
    plannedSku: "SARIMA-P002",
    plannedName: "Ambiguous Snack 60g",
    plannedCategory: "Snacks",
    imageStatus: "EXACT_MATCH",
    assetFileIds: ["drive-2"]
  },
  {
    productCode: "P003",
    plannedSku: "SARIMA-P003",
    plannedName: "Bottle Drink 500mL",
    plannedCategory: "Beverages",
    imageStatus: "MISSING_IMAGE",
    assetFileIds: []
  }
];

const readinessRows: InactiveStagingReadinessRow[] = [
  {
    productCode: "P001",
    historicalSellingPrice2025: 8.5,
    historicalPriceMeaning: "LAST_RECORDED_HISTORICAL_PRICE_2025",
    currentSellingPrice: null,
    currentPriceReadiness: "UNVERIFIED",
    proposedUnit: "SACHET",
    unitEvidence: "EXPLICIT_SACHET"
  },
  {
    productCode: "P002",
    historicalSellingPrice2025: 22,
    historicalPriceMeaning: "LAST_RECORDED_HISTORICAL_PRICE_2025",
    currentSellingPrice: null,
    currentPriceReadiness: "UNVERIFIED",
    proposedUnit: null,
    unitEvidence: "REVIEW_REQUIRED"
  },
  {
    productCode: "P003",
    historicalSellingPrice2025: 0,
    historicalPriceMeaning: "LAST_RECORDED_HISTORICAL_PRICE_2025",
    currentSellingPrice: null,
    currentPriceReadiness: "UNVERIFIED",
    proposedUnit: "BOTTLE",
    unitEvidence: "EXPLICIT_BOTTLE"
  }
];

test("inactive staging plan only admits identities with explicit unit evidence and positive historical price evidence", () => {
  const plan = buildCatalogPromotionInactiveStagingPlan({ executionRows, readinessRows });

  assert.deepEqual(plan.summary, {
    candidates: 3,
    stageableInactiveIdentities: 1,
    blockedUnitReview: 1,
    blockedHistoricalPriceEvidence: 1,
    plannedInventoryRows: 0,
    plannedStorefrontVisible: 0,
    currentPriceVerified: 0
  });

  const row = plan.stageableRows[0];
  assert.equal(row?.productCode, "P001");
  assert.equal(row?.plannedSku, "SARIMA-P001");
  assert.equal(row?.plannedSellingPrice, 8.5);
  assert.equal(row?.sellingPriceProvenance, "LAST_RECORDED_HISTORICAL_PRICE_2025");
  assert.equal(row?.sellingPriceUsage, "PROVISIONAL_INACTIVE_ONLY");
  assert.equal(row?.plannedUnit, "SACHET");
  assert.equal(row?.plannedStatus, "INACTIVE");
  assert.equal(row?.plannedDataQualityStatus, "NEEDS_REVIEW");
  assert.equal(row?.plannedRecordSource, "IMPORT");
  assert.equal(row?.plannedStorefrontVisible, false);
  assert.equal(row?.plannedCreateInventory, false);
  assert.equal(row?.plannedCreateInventoryBatch, false);
  assert.equal(row?.plannedCreateSarimaMapping, true);
  assert.deepEqual(row?.activationBlockers, [
    "CURRENT_SELLING_PRICE",
    "PHYSICAL_STOCK",
    "QUALITY_APPROVAL"
  ]);
});

test("inactive staging plan never converts historical price into verified current price", () => {
  const plan = buildCatalogPromotionInactiveStagingPlan({ executionRows, readinessRows });
  const row = plan.stageableRows[0];

  assert.equal(row?.currentSellingPrice, null);
  assert.equal(row?.currentPriceReadiness, "UNVERIFIED");
  assert.notEqual(row?.plannedStatus, "ACTIVE");
  assert.equal(row?.plannedStorefrontVisible, false);
});
