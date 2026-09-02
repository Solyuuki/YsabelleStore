import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  generateCatalogPromotionCategoryOperationalizationPreview,
  type CatalogPromotionCategoryOperationalizationPreviewPrismaClient
} from "../src/scripts/generateCatalogPromotionCategoryOperationalizationPreview.js";

const gapArtifact = {
  summary: {
    candidateRows: 205,
    distinctSourceCategories: 3,
    existingStagingEligible: 1,
    missingCategories: 1,
    developmentSeedCategories: 1,
    testFixtureCategories: 0,
    inactiveCategories: 0,
    rejectedCategories: 0,
    ambiguousCategories: 0,
    plannedCategoryCreates: 0,
    plannedCategoryUpdates: 0
  },
  rows: [
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
  ]
};

test("operationalization preview generator reads categories and seed-category Product references only and writes review artifacts", async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-category-operationalization-"));
  const gapPath = path.join(temp, "gap.json");
  const jsonPath = path.join(temp, "preview.json");
  const csvPath = path.join(temp, "preview.csv");
  const reportPath = path.join(temp, "preview.md");
  await fs.writeFile(gapPath, JSON.stringify(gapArtifact), "utf8");

  const calls: Array<{ model: string; args: unknown }> = [];
  const client: CatalogPromotionCategoryOperationalizationPreviewPrismaClient = {
    category: {
      async findMany(args) {
        calls.push({ model: "category", args });
        return [
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
        ];
      }
    },
    product: {
      async findMany(args) {
        calls.push({ model: "product", args });
        return [
          { id: "prd_sardines_155g", sku: "CAN-SARD-001", categoryId: "cat_canned_goods" }
        ];
      }
    }
  };

  const preview = await generateCatalogPromotionCategoryOperationalizationPreview({
    client,
    gapPath,
    jsonPath,
    csvPath,
    reportPath
  });

  assert.deepEqual(calls.map((call) => call.model), ["category", "product"]);
  assert.deepEqual((calls[0]!.args as any).select, {
    id: true,
    name: true,
    slug: true,
    isActive: true,
    recordSource: true,
    dataQualityStatus: true,
    isStorefrontVisible: true
  });
  assert.deepEqual((calls[1]!.args as any).where.categoryId.in, ["cat_canned_goods"]);
  assert.deepEqual((calls[1]!.args as any).select, { id: true, sku: true, categoryId: true });

  assert.equal(preview.summary.proposeCreate, 1);
  assert.equal(preview.summary.reuseExisting, 1);
  assert.equal(preview.summary.reviewAdoptSeed, 1);
  assert.equal(preview.summary.seedCategoryProductReferences, 1);
  assert.equal(preview.summary.seedCategoryNonSeedProductReferences, 0);
  assert.equal(preview.summary.plannedCategoryCreates, 0);
  assert.equal(preview.summary.plannedCategoryUpdates, 0);
  assert.equal(preview.summary.actualMutationsPerformed, 0);

  const json = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  assert.equal(json.summary.actualMutationsPerformed, 0);

  const csv = await fs.readFile(csvPath, "utf8");
  assert.match(csv, /PROPOSE_CREATE/);
  assert.match(csv, /REVIEW_ADOPT_SEED/);

  const report = await fs.readFile(reportPath, "utf8");
  assert.match(report, /READ-ONLY/i);
  assert.match(report, /13|propose/i);
  assert.match(report, /zero|0.*mutation/i);
});
