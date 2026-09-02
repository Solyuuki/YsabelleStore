import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogPromotionCategoryGapPlan } from "../src/modules/catalog/catalog-promotion-category-gap-plan.js";

const executionRows = [
  { productCode: "P001", plannedCategory: "Personal Care / Hygiene" },
  { productCode: "P002", plannedCategory: "Personal Care / Hygiene" },
  { productCode: "P003", plannedCategory: "Beverages / Coffee & Milk" },
  { productCode: "P004", plannedCategory: "Snacks" },
  { productCode: "P005", plannedCategory: "Frozen / Chilled" },
  { productCode: "P006", plannedCategory: "Household Supplies" },
  { productCode: "P007", plannedCategory: "Tissue & Cotton" }
];

const categories = [
  {
    id: "cat_operational_personal_care",
    name: "Personal Care / Hygiene",
    slug: "personal-care-hygiene",
    isActive: true,
    recordSource: "IMPORT",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  },
  {
    id: "cat_snacks",
    name: "Snacks",
    slug: "snacks",
    isActive: true,
    recordSource: "CATALOG",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  },
  {
    id: "cat_fixture_frozen",
    name: "Frozen / Chilled",
    slug: "frozen-chilled",
    isActive: true,
    recordSource: "TEST_FIXTURE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  },
  {
    id: "cat_household_operational",
    name: "Household Supplies",
    slug: "household-supplies",
    isActive: false,
    recordSource: "IMPORT",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  },
  {
    id: "cat_tissue_operational",
    name: "Tissue & Cotton",
    slug: "tissue-cotton",
    isActive: true,
    recordSource: "IMPORT",
    dataQualityStatus: "REJECTED",
    isStorefrontVisible: false
  }
] as const;

test("category gap plan classifies distinct source taxonomy without auto-creating or auto-mapping missing categories", () => {
  const plan = buildCatalogPromotionCategoryGapPlan({ executionRows, categories: [...categories] });

  assert.deepEqual(plan.summary, {
    candidateRows: 7,
    distinctSourceCategories: 6,
    existingStagingEligible: 1,
    missingCategories: 1,
    developmentSeedCategories: 1,
    testFixtureCategories: 1,
    inactiveCategories: 1,
    rejectedCategories: 1,
    ambiguousCategories: 0,
    plannedCategoryCreates: 0,
    plannedCategoryUpdates: 0
  });

  const personalCare = plan.rows.find((row) => row.sourceCategory === "Personal Care / Hygiene");
  assert.equal(personalCare?.candidateCount, 2);
  assert.equal(personalCare?.resolutionStatus, "EXISTING_STAGING_ELIGIBLE");
  assert.equal(personalCare?.recommendedAction, "REUSE_EXISTING");
  assert.equal(personalCare?.matchedCategory?.id, "cat_operational_personal_care");
  assert.equal(personalCare?.matchedCategory?.recordSource, "IMPORT");

  const missing = plan.rows.find((row) => row.sourceCategory === "Beverages / Coffee & Milk");
  assert.equal(missing?.resolutionStatus, "MISSING_CATEGORY");
  assert.equal(missing?.recommendedAction, "REVIEW_CREATE_OR_MAP");
  assert.equal(missing?.matchedCategory, null);

  const seed = plan.rows.find((row) => row.sourceCategory === "Snacks");
  assert.equal(seed?.resolutionStatus, "DEVELOPMENT_SEED_CATEGORY");
  assert.equal(seed?.recommendedAction, "REVIEW_REQUIRED");

  const fixture = plan.rows.find((row) => row.sourceCategory === "Frozen / Chilled");
  assert.equal(fixture?.resolutionStatus, "TEST_FIXTURE_CATEGORY");

  const inactive = plan.rows.find((row) => row.sourceCategory === "Household Supplies");
  assert.equal(inactive?.resolutionStatus, "INACTIVE_CATEGORY");

  const rejected = plan.rows.find((row) => row.sourceCategory === "Tissue & Cotton");
  assert.equal(rejected?.resolutionStatus, "REJECTED_CATEGORY");
});

test("category gap plan remains defensive when duplicate category names are supplied", () => {
  const plan = buildCatalogPromotionCategoryGapPlan({
    executionRows: [{ productCode: "P001", plannedCategory: "Beverages" }],
    categories: [
      {
        id: "cat_one",
        name: "Beverages",
        slug: "beverages-one",
        isActive: true,
        recordSource: "IMPORT",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      },
      {
        id: "cat_two",
        name: "Beverages",
        slug: "beverages-two",
        isActive: true,
        recordSource: "IMPORT",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      }
    ]
  });

  assert.equal(plan.rows[0]?.resolutionStatus, "AMBIGUOUS_CATEGORY");
  assert.equal(plan.rows[0]?.recommendedAction, "REVIEW_REQUIRED");
  assert.equal(plan.rows[0]?.matchedCategory, null);
  assert.equal(plan.summary.ambiguousCategories, 1);
});
