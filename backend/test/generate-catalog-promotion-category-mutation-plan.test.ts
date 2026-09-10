import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateCatalogPromotionCategoryMutationPlan } from "../src/scripts/generateCatalogPromotionCategoryMutationPlan.js";

const operationalization = {
  summary: {
    sourceCategories: 2,
    proposeCreate: 1,
    reuseExisting: 0,
    reviewAdoptSeed: 1,
    blockedNameCollision: 0,
    blockedSlugCollision: 0,
    seedCategoryProductReferences: 2,
    seedCategoryNonSeedProductReferences: 1,
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
      sourceCategory: "Canned Goods",
      candidateCount: 44,
      decision: "REVIEW_ADOPT_SEED",
      candidateSlug: null,
      reuseBasis: null,
      proposedCategory: null,
      existingCategoryId: "cat_canned_goods",
      collisionCategories: [],
      seedCategoryProductReferences: 2,
      seedCategoryNonSeedProductReferences: 1,
      seedCategoryProducts: [
        { id: "prd_sardines_155g", sku: "CAN-SARD-001", isDevelopmentSeed: true },
        { id: "prd_sarima_p144", sku: "SARIMA-P144", isDevelopmentSeed: false }
      ]
    }
  ]
};

const audit = {
  candidateRows: [
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
};

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
    productCode: "P144",
    sourceName: "Ligo Sardines in Tomato Sauce Chili Added 155g",
    sourceNameNormalized: "ligo sardines in tomato sauce chili added 155g",
    yearsPresent: [2024, 2025]
  }
];

test("category mutation plan generator reads review artifacts only and writes a zero-mutation plan", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-category-mutation-plan-"));
  const operationalizationPath = path.join(temp, "operationalization.json");
  const auditPath = path.join(temp, "audit.json");
  const sourcesPath = path.join(temp, "sources.json");
  const jsonPath = path.join(temp, "plan.json");
  const reportPath = path.join(temp, "plan.md");

  await Promise.all([
    fs.writeFile(operationalizationPath, JSON.stringify(operationalization), "utf8"),
    fs.writeFile(auditPath, JSON.stringify(audit), "utf8"),
    fs.writeFile(sourcesPath, JSON.stringify(sources), "utf8")
  ]);

  const plan = await generateCatalogPromotionCategoryMutationPlan({
    operationalizationPath,
    auditPath,
    sourcesPath,
    jsonPath,
    reportPath
  });

  assert.deepEqual(plan.summary, {
    sourceCategories: 2,
    proposedCategoryCreates: 1,
    proposedCategoryReuses: 1,
    blockedCategories: 0,
    seedAdoptionsCleared: 1,
    actualMutationsPerformed: 0
  });

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.summary.actualMutationsPerformed, 0);

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /zero database mutations/i);
  assert.match(report, /Canned Goods/);
  assert.match(report, /SEED_CATEGORY_EVIDENCE/);
});
