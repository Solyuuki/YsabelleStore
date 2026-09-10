import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogPromotionRequiredFieldReadiness,
  resolveExplicitProductUnit
} from "../src/modules/catalog/catalog-promotion-required-field-readiness.js";
import { loadHistoricalSalesData } from "../src/modules/forecasting/historical-sales.service.js";

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

test("bottled is accepted as high-confidence bottle morphology", () => {
  assert.deepEqual(resolveExplicitProductUnit("Bottled Water"), {
    unit: "BOTTLE",
    evidence: "EXPLICIT_BOTTLE"
  });
});

test("conflicting explicit packaging signals remain review-required", () => {
  assert.deepEqual(resolveExplicitProductUnit("Gift Set Bottle Box"), {
    unit: null,
    evidence: "REVIEW_REQUIRED"
  });
});

test("explicit-only resolver still refuses to guess generic products", () => {
  assert.deepEqual(resolveExplicitProductUnit("Oishi Ridges Barbecue Flavor 60g"), {
    unit: null,
    evidence: "REVIEW_REQUIRED"
  });
  assert.deepEqual(resolveExplicitProductUnit("Ligo Sardines 155g"), {
    unit: null,
    evidence: "REVIEW_REQUIRED"
  });
});

test("catalog readiness resolves a discrete canned-good SKU as one retail piece", () => {
  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: [
      {
        ...baseRow,
        productCode: "P008",
        plannedSku: "SARIMA-P008",
        plannedName: "Century Tuna Flakes in Oil",
        plannedCategory: "Canned Goods"
      }
    ],
    historicalProducts: [{ productCode: "P008", historicalSellingPrice2025: 42 }]
  });

  assert.equal(readiness.rows[0]?.proposedUnit, "PIECE");
  assert.equal(readiness.rows[0]?.unitEvidence, "CATEGORY_SINGLE_RETAIL_ITEM");
  assert.equal(readiness.rows[0]?.writeReadiness, "BLOCKED_CURRENT_PRICE");
});

test("catalog readiness maps pouch to PACK because ProductUnit has no pouch value", () => {
  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: [
      {
        ...baseRow,
        productCode: "P101",
        plannedSku: "SARIMA-P101",
        plannedName: "Magnolia Real Mayonnaise Pouch",
        plannedCategory: "Baking / Spreads & Dessert Ingredients"
      }
    ],
    historicalProducts: [{ productCode: "P101", historicalSellingPrice2025: 30 }]
  });

  assert.equal(readiness.rows[0]?.proposedUnit, "PACK");
  assert.equal(readiness.rows[0]?.unitEvidence, "EXPLICIT_POUCH_AS_PACK");
});

test("reviewed overrides resolve source names with conflicting explicit packaging signals", () => {
  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: [
      {
        ...baseRow,
        productCode: "P021",
        plannedSku: "SARIMA-P021",
        plannedName: "Downy Fabric Conditioner Twin / Larger Sachet Pack",
        plannedCategory: "Laundry Supplies"
      }
    ],
    historicalProducts: [{ productCode: "P021", historicalSellingPrice2025: 18 }]
  });

  assert.equal(readiness.rows[0]?.proposedUnit, "PACK");
  assert.equal(readiness.rows[0]?.unitEvidence, "REVIEWED_PRODUCT_OVERRIDE");
});

test("repacked rice keeps a reviewed weight unit instead of becoming a generic piece", () => {
  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: [
      {
        ...baseRow,
        productCode: "P216",
        plannedSku: "SARIMA-P216",
        plannedName: "Repacked Rice / Bigas",
        plannedCategory: "Rice & Staples"
      }
    ],
    historicalProducts: [{ productCode: "P216", historicalSellingPrice2025: 58 }]
  });

  assert.equal(readiness.rows[0]?.proposedUnit, "KILOGRAM");
  assert.equal(readiness.rows[0]?.unitEvidence, "REVIEWED_PRODUCT_OVERRIDE");
});

test("unknown taxonomy remains fail-closed when no explicit or reviewed unit evidence exists", () => {
  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: [
      {
        ...baseRow,
        productCode: "PX01",
        plannedSku: "SARIMA-PX01",
        plannedName: "Mystery Commodity 500g",
        plannedCategory: "Unreviewed Taxonomy"
      }
    ],
    historicalProducts: [{ productCode: "PX01", historicalSellingPrice2025: 50 }]
  });

  assert.equal(readiness.rows[0]?.proposedUnit, null);
  assert.equal(readiness.rows[0]?.unitEvidence, "REVIEW_REQUIRED");
  assert.equal(readiness.rows[0]?.writeReadiness, "BLOCKED_CURRENT_PRICE_AND_UNIT");
});

test("every committed source identity has deterministic unit evidence before NEW-row filtering", async () => {
  const historical = await loadHistoricalSalesData();
  assert.equal(historical.validation.valid, true);
  assert.equal(historical.products.length, 472);

  const executionRows = historical.products.map((product) => ({
    ...baseRow,
    productCode: product.productId,
    plannedSku: `SARIMA-${product.productId}`,
    plannedName: product.productName,
    plannedCategory: product.category
  }));
  const historicalProducts = historical.products.map((product) => ({
    productCode: product.productId,
    historicalSellingPrice2025: product.sellingPrice
  }));

  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows,
    historicalProducts
  });

  assert.equal(readiness.summary.candidates, 472);
  assert.equal(readiness.summary.unitResolved, 472);
  assert.equal(readiness.summary.unitNeedsReview, 0);
  assert.equal(readiness.rows.filter((row) => row.proposedUnit === null).length, 0);
});

test("historical price is review evidence only and never unlocks current-price readiness", () => {
  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: [
      {
        ...baseRow,
        plannedName: "Sunsilk Shampoo Sachet 13mL",
        plannedCategory: "Personal Care / Hygiene"
      },
      {
        ...baseRow,
        productCode: "PX02",
        plannedSku: "SARIMA-PX02",
        plannedName: "Unknown Loose Commodity 60g",
        plannedCategory: "Unreviewed Taxonomy"
      }
    ],
    historicalProducts: [
      { productCode: "P001", historicalSellingPrice2025: 8.5 },
      { productCode: "PX02", historicalSellingPrice2025: 22 }
    ]
  });

  assert.deepEqual(readiness.summary, {
    candidates: 2,
    historicalPriceEvidenceAvailable: 2,
    currentPriceVerified: 0,
    explicitUnitResolved: 1,
    unitResolved: 1,
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
