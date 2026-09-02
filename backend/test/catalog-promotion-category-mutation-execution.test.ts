import assert from "node:assert/strict";
import test from "node:test";

import { executeCatalogPromotionCategoryMutationPlan } from "../src/modules/catalog/catalog-promotion-category-mutation-execution.js";
import type { CatalogPromotionCategoryMutationPlan } from "../src/modules/catalog/catalog-promotion-category-mutation-plan.js";

const plan: CatalogPromotionCategoryMutationPlan = {
  summary: {
    sourceCategories: 3,
    proposedCategoryCreates: 2,
    proposedCategoryReuses: 1,
    blockedCategories: 0,
    seedAdoptionsCleared: 0,
    actualMutationsPerformed: 0
  },
  rows: [
    {
      sourceCategory: "Snacks / Biscuits & Confectionery",
      candidateCount: 10,
      decision: "CREATE_CATEGORY",
      proposedCategoryCreate: {
        name: "Snacks / Biscuits & Confectionery",
        slug: "snacks-biscuits-confectionery",
        isActive: true,
        recordSource: "IMPORT",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      },
      existingCategoryId: null,
      reuseBasis: null,
      blockers: [],
      seedAdoptionEvidence: []
    },
    {
      sourceCategory: "Personal Care / Hygiene",
      candidateCount: 5,
      decision: "CREATE_CATEGORY",
      proposedCategoryCreate: {
        name: "Personal Care / Hygiene",
        slug: "personal-care-hygiene",
        isActive: true,
        recordSource: "IMPORT",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      },
      existingCategoryId: null,
      reuseBasis: null,
      blockers: [],
      seedAdoptionEvidence: []
    },
    {
      sourceCategory: "Bread & Bakery",
      candidateCount: 4,
      decision: "REUSE_EXISTING",
      proposedCategoryCreate: null,
      existingCategoryId: "cat_bread",
      reuseBasis: "EXACT_NAME",
      blockers: [],
      seedAdoptionEvidence: []
    }
  ]
};

test("authorized category execution creates only planned categories inside one transaction", async () => {
  const created: Array<Record<string, unknown>> = [];
  let transactionCalls = 0;
  const client = {
    async $transaction<T>(callback: (tx: any) => Promise<T>) {
      transactionCalls += 1;
      return callback({
        category: {
          async findMany() {
            return [];
          },
          async create(args: { data: Record<string, unknown> }) {
            created.push(args.data);
            return { id: `cat_${created.length}`, ...args.data };
          }
        }
      });
    }
  };

  const result = await executeCatalogPromotionCategoryMutationPlan({
    client,
    plan,
    authorization: {
      expectedSourceCategories: 3,
      expectedCategoryCreates: 2,
      expectedCategoryReuses: 1
    }
  });

  assert.equal(transactionCalls, 1);
  assert.deepEqual(created, [
    {
      name: "Snacks / Biscuits & Confectionery",
      slug: "snacks-biscuits-confectionery",
      isActive: true,
      recordSource: "IMPORT",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    },
    {
      name: "Personal Care / Hygiene",
      slug: "personal-care-hygiene",
      isActive: true,
      recordSource: "IMPORT",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    }
  ]);
  assert.deepEqual(result.summary, {
    authorizedCategoryCreates: 2,
    createdCategories: 2,
    alreadyPresentCategories: 0,
    actualMutationsPerformed: 2
  });
});
