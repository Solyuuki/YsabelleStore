import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogPromotionCategoryOperationalizationPreview } from "../src/modules/catalog/catalog-promotion-category-operationalization-preview.js";

const gapRows = [
  {
    sourceCategory: "Snacks / Biscuits & Confectionery",
    candidateCount: 135,
    productCodes: ["P001"],
    resolutionStatus: "MISSING_CATEGORY",
    recommendedAction: "REVIEW_CREATE_OR_MAP",
    matchedCategory: null
  },
  {
    sourceCategory: "Bread & Bakery",
    candidateCount: 26,
    productCodes: ["P002"],
    resolutionStatus: "EXISTING_STAGING_ELIGIBLE",
    recommendedAction: "REUSE_EXISTING",
    matchedCategory: {
      id: "cat_bread",
      name: "Bread & Bakery",
      slug: "bread-bakery",
      isActive: true,
      recordSource: "INTERNAL",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    }
  },
  {
    sourceCategory: "Canned Goods",
    candidateCount: 44,
    productCodes: ["P003"],
    resolutionStatus: "DEVELOPMENT_SEED_CATEGORY",
    recommendedAction: "REVIEW_REQUIRED",
    matchedCategory: {
      id: "cat_canned_goods",
      name: "Canned Goods",
      slug: "canned-goods",
      isActive: true,
      recordSource: "CATALOG",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    }
  }
] as const;

const allCategories = [
  {
    id: "cat_bread",
    name: "Bread & Bakery",
    slug: "bread-bakery",
    isActive: true,
    recordSource: "INTERNAL",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  },
  {
    id: "cat_canned_goods",
    name: "Canned Goods",
    slug: "canned-goods",
    isActive: true,
    recordSource: "CATALOG",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  }
] as const;

const categoryProducts = [
  { id: "prd_sardines_155g", sku: "CAN-SARD-001", categoryId: "cat_canned_goods" }
];

test("operationalization preview proposes hidden import categories for missing taxonomy and performs zero writes", () => {
  const preview = buildCatalogPromotionCategoryOperationalizationPreview({
    gapRows: [...gapRows],
    allCategories: [...allCategories],
    categoryProducts
  });

  assert.deepEqual(preview.summary, {
    sourceCategories: 3,
    proposeCreate: 1,
    reuseExisting: 1,
    reviewAdoptSeed: 1,
    blockedNameCollision: 0,
    blockedSlugCollision: 0,
    seedCategoryProductReferences: 1,
    seedCategoryNonSeedProductReferences: 0,
    plannedCategoryCreates: 0,
    plannedCategoryUpdates: 0,
    actualMutationsPerformed: 0
  });

  const proposed = preview.rows.find((row) => row.sourceCategory === "Snacks / Biscuits & Confectionery");
  assert.equal(proposed?.decision, "PROPOSE_CREATE");
  assert.deepEqual(proposed?.proposedCategory, {
    name: "Snacks / Biscuits & Confectionery",
    slug: "snacks-biscuits-confectionery",
    isActive: true,
    recordSource: "IMPORT",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  });

  const reused = preview.rows.find((row) => row.sourceCategory === "Bread & Bakery");
  assert.equal(reused?.decision, "REUSE_EXISTING");
  assert.equal(reused?.existingCategoryId, "cat_bread");

  const seed = preview.rows.find((row) => row.sourceCategory === "Canned Goods");
  assert.equal(seed?.decision, "REVIEW_ADOPT_SEED");
  assert.equal(seed?.seedCategoryProductReferences, 1);
  assert.equal(seed?.seedCategoryNonSeedProductReferences, 0);
  assert.deepEqual(seed?.seedCategoryProducts, [
    { id: "prd_sardines_155g", sku: "CAN-SARD-001", isDevelopmentSeed: true }
  ]);
});

test("operationalization preview blocks a proposed category when generated slug collides with another database category", () => {
  const preview = buildCatalogPromotionCategoryOperationalizationPreview({
    gapRows: [gapRows[0]],
    allCategories: [
      ...allCategories,
      {
        id: "cat_collision",
        name: "Different Category",
        slug: "snacks-biscuits-confectionery",
        isActive: true,
        recordSource: "IMPORT",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      }
    ],
    categoryProducts: []
  });

  assert.equal(preview.rows[0]?.decision, "BLOCKED_SLUG_COLLISION");
  assert.equal(preview.rows[0]?.proposedCategory, null);
  assert.equal(preview.summary.blockedSlugCollision, 1);
});
