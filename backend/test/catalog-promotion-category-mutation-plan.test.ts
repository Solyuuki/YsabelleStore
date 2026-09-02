import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogPromotionCategoryMutationPlan } from "../src/modules/catalog/catalog-promotion-category-mutation-plan.js";

const operationalization = {
  summary: {
    sourceCategories: 3,
    proposeCreate: 1,
    reuseExisting: 1,
    reviewAdoptSeed: 1,
    blockedNameCollision: 0,
    blockedSlugCollision: 0,
    seedCategoryProductReferences: 3,
    seedCategoryNonSeedProductReferences: 2,
    plannedCategoryCreates: 0,
    plannedCategoryUpdates: 0,
    actualMutationsPerformed: 0
  },
  rows: [
    {
      sourceCategory: "Snacks / Biscuits & Confectionery",
      candidateCount: 135,
      decision: "PROPOSE_CREATE",
      candidateSlug: "snacks-biscuits-confectionery",
      reuseBasis: null,
      proposedCategory: {
        name: "Snacks / Biscuits & Confectionery",
        slug: "snacks-biscuits-confectionery",
        isActive: true,
        recordSource: "IMPORT",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      },
      existingCategoryId: null,
      collisionCategories: [],
      seedCategoryProductReferences: 0,
      seedCategoryNonSeedProductReferences: 0,
      seedCategoryProducts: []
    },
    {
      sourceCategory: "Frozen / Chilled",
      candidateCount: 7,
      decision: "REUSE_EXISTING",
      candidateSlug: "frozen-chilled",
      reuseBasis: "SLUG_EQUIVALENCE",
      proposedCategory: null,
      existingCategoryId: "cat_frozen_chilled",
      collisionCategories: [],
      seedCategoryProductReferences: 0,
      seedCategoryNonSeedProductReferences: 0,
      seedCategoryProducts: []
    },
    {
      sourceCategory: "Canned Goods",
      candidateCount: 44,
      decision: "REVIEW_ADOPT_SEED",
      candidateSlug: null,
      reuseBasis: null,
      proposedCategory: null,
      existingCategoryId: "cat_canned_goods",
      collisionCategories: [],
      seedCategoryProductReferences: 3,
      seedCategoryNonSeedProductReferences: 2,
      seedCategoryProducts: [
        { id: "prd_sardines_155g", sku: "CAN-SARD-001", isDevelopmentSeed: true },
        { id: "prd_sarima_p088", sku: "SARIMA-P088", isDevelopmentSeed: false },
        { id: "prd_sarima_p144", sku: "SARIMA-P144", isDevelopmentSeed: false }
      ]
    }
  ]
} as const;

const audit = {
  candidateRows: [
    {
      productCode: "P088",
      sourceName: "Fresca Tuna Flakes in Oil 175g",
      canonicalProductCode: "P088",
      status: "EXISTING",
      operationalProductId: "prd_sarima_p088",
      candidateOperationalProductIds: ["prd_sarima_p088"],
      reason: "Existing operational Product is proven by its SARIMA source mapping."
    },
    {
      productCode: "P144",
      sourceName: "Ligo Sardines in Tomato Sauce Chili Added 155g",
      canonicalProductCode: "P014",
      status: "BLOCKED",
      operationalProductId: null,
      candidateOperationalProductIds: ["prd_sarima_p144"],
      reason: "Historical identity remains blocked for manual canonical review."
    }
  ]
} as const;

const sources = [
  {
    category: "Canned Goods",
    productCode: "P014",
    sourceName: "Ligo Sardines in Tomato Sauce Chili Added",
    sourceNameNormalized: "ligo sardines in tomato sauce chili added",
    yearsPresent: [2024, 2025]
  },
  {
    category: "Canned Goods",
    productCode: "P088",
    sourceName: "Fresca Tuna Flakes in Oil 175g",
    sourceNameNormalized: "fresca tuna flakes in oil 175g",
    yearsPresent: [2024, 2025]
  },
  {
    category: "Canned Goods",
    productCode: "P144",
    sourceName: "Ligo Sardines in Tomato Sauce Chili Added 155g",
    sourceNameNormalized: "ligo sardines in tomato sauce chili added 155g",
    yearsPresent: [2024, 2025]
  }
] as const;

test("final category mutation plan clears seed-category reuse when every non-seed Product reference is category-aligned", () => {
  const plan = buildCatalogPromotionCategoryMutationPlan({
    operationalization: operationalization as any,
    audit: audit as any,
    sources: sources as any
  });

  assert.deepEqual(plan.summary, {
    sourceCategories: 3,
    proposedCategoryCreates: 1,
    proposedCategoryReuses: 2,
    blockedCategories: 0,
    seedAdoptionsCleared: 1,
    actualMutationsPerformed: 0
  });

  const canned = plan.rows.find((row) => row.sourceCategory === "Canned Goods");
  assert.equal(canned?.decision, "REUSE_EXISTING");
  assert.equal(canned?.existingCategoryId, "cat_canned_goods");
  assert.equal(canned?.reuseBasis, "SEED_CATEGORY_EVIDENCE");
  assert.deepEqual(canned?.blockers, []);
  assert.deepEqual(
    canned?.seedAdoptionEvidence.map((evidence) => [evidence.productId, evidence.auditStatus, evidence.categoryAligned]),
    [
      ["prd_sarima_p088", "EXISTING", true],
      ["prd_sarima_p144", "BLOCKED", true]
    ]
  );

  const snacks = plan.rows.find((row) => row.sourceCategory === "Snacks / Biscuits & Confectionery");
  assert.equal(snacks?.decision, "CREATE_CATEGORY");
  assert.equal(snacks?.proposedCategoryCreate?.slug, "snacks-biscuits-confectionery");

  const frozen = plan.rows.find((row) => row.sourceCategory === "Frozen / Chilled");
  assert.equal(frozen?.decision, "REUSE_EXISTING");
  assert.equal(frozen?.reuseBasis, "SLUG_EQUIVALENCE");
});

test("final category mutation plan keeps seed adoption blocked when a blocked identity crosses source categories", () => {
  const mismatchedSources = sources.map((source) =>
    source.productCode === "P014" ? { ...source, category: "Condiments & Cooking Ingredients" } : source
  );

  const plan = buildCatalogPromotionCategoryMutationPlan({
    operationalization: operationalization as any,
    audit: audit as any,
    sources: mismatchedSources as any
  });

  const canned = plan.rows.find((row) => row.sourceCategory === "Canned Goods");
  assert.equal(canned?.decision, "BLOCKED_REVIEW");
  assert.equal(canned?.reuseBasis, null);
  assert.ok(canned?.blockers.includes("SEED_CATEGORY_REFERENCE_CATEGORY_MISMATCH"));
  assert.equal(plan.summary.blockedCategories, 1);
  assert.equal(plan.summary.seedAdoptionsCleared, 0);
  assert.equal(plan.summary.actualMutationsPerformed, 0);
});
