import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateCatalogPromotionCategoryGapPlan,
  type CatalogPromotionCategoryGapPlanPrismaClient
} from "../src/scripts/generateCatalogPromotionCategoryGapPlan.js";

type CategoryFindManyArgs = {
  where: { name: { in: string[] } };
  select: Record<string, boolean>;
};

const executionArtifact = {
  rows: [
    { productCode: "P001", plannedCategory: "Personal Care / Hygiene" },
    { productCode: "P002", plannedCategory: "Personal Care / Hygiene" },
    { productCode: "P003", plannedCategory: "Beverages / Coffee & Milk" }
  ]
};

test("category gap generator performs one constrained category read and writes review-only artifacts", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-category-gap-"));
  const executionPath = path.join(temp, "execution.json");
  const jsonPath = path.join(temp, "category-gap.json");
  const csvPath = path.join(temp, "category-gap.csv");
  const reportPath = path.join(temp, "category-gap.md");
  await fs.writeFile(executionPath, JSON.stringify(executionArtifact), "utf8");

  const calls: unknown[] = [];
  const client: CatalogPromotionCategoryGapPlanPrismaClient = {
    category: {
      async findMany(args) {
        calls.push(args);
        return [
          {
            id: "cat_personal_care",
            name: "Personal Care / Hygiene",
            slug: "personal-care-hygiene",
            isActive: true,
            recordSource: "IMPORT",
            dataQualityStatus: "NEEDS_REVIEW",
            isStorefrontVisible: false
          }
        ];
      }
    }
  };

  const result = await generateCatalogPromotionCategoryGapPlan({
    client,
    executionPath,
    jsonPath,
    csvPath,
    reportPath
  });

  assert.equal(calls.length, 1);
  assert.deepEqual((calls[0] as CategoryFindManyArgs).where.name.in, [
    "Beverages / Coffee & Milk",
    "Personal Care / Hygiene"
  ]);
  assert.deepEqual((calls[0] as CategoryFindManyArgs).select, {
    id: true,
    name: true,
    slug: true,
    isActive: true,
    recordSource: true,
    dataQualityStatus: true,
    isStorefrontVisible: true
  });

  assert.deepEqual(result.summary, {
    candidateRows: 3,
    distinctSourceCategories: 2,
    existingStagingEligible: 1,
    missingCategories: 1,
    developmentSeedCategories: 0,
    testFixtureCategories: 0,
    inactiveCategories: 0,
    rejectedCategories: 0,
    ambiguousCategories: 0,
    plannedCategoryCreates: 0,
    plannedCategoryUpdates: 0
  });

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.summary.plannedCategoryCreates, 0);
  assert.equal(json.summary.plannedCategoryUpdates, 0);

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /sourceCategory,candidateCount,resolutionStatus,recommendedAction/);
  assert.match(csv, /Personal Care \/ Hygiene,2,EXISTING_STAGING_ELIGIBLE,REUSE_EXISTING/);

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /does not create or update categories/i);
  assert.match(report, /review_create_or_map/i);
});
