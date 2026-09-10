import assert from "node:assert/strict";
import test from "node:test";

import {
  executeCatalogPromotionCategoryMutationPlan,
  type CategoryMutationClient
} from "../src/modules/catalog/catalog-promotion-category-mutation-execution.js";
import type { CatalogPromotionCategoryMutationPlan } from "../src/modules/catalog/catalog-promotion-category-mutation-plan.js";

type CategoryMutationTransaction = Parameters<
  Parameters<CategoryMutationClient["$transaction"]>[0]
>[0];
type CategorySnapshot = Awaited<
  ReturnType<CategoryMutationTransaction["category"]["findMany"]>
>[number];

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

const breadCategory = {
  id: "cat_bread",
  name: "Bread & Bakery",
  slug: "bread-bakery",
  isActive: true,
  recordSource: "INTERNAL",
  dataQualityStatus: "NEEDS_REVIEW",
  isStorefrontVisible: false
} as const;

function authorization() {
  return {
    expectedSourceCategories: 3,
    expectedCategoryCreates: 2,
    expectedCategoryReuses: 1
  } as const;
}

test("authorized category execution creates only planned categories inside one transaction", async () => {
  const created: Array<Record<string, unknown>> = [];
  let transactionCalls = 0;
  const client: CategoryMutationClient = {
    async $transaction(callback) {
      transactionCalls += 1;
      return callback({
        category: {
          async findMany() {
            return [breadCategory];
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
    authorization: authorization()
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

test("authorized category execution is idempotent when planned create categories already exist exactly", async () => {
  const existing: CategorySnapshot[] = [
    breadCategory,
    {
      id: "cat_snacks_import",
      name: "Snacks / Biscuits & Confectionery",
      slug: "snacks-biscuits-confectionery",
      isActive: true,
      recordSource: "IMPORT",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    },
    {
      id: "cat_hygiene_import",
      name: "Personal Care / Hygiene",
      slug: "personal-care-hygiene",
      isActive: true,
      recordSource: "IMPORT",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    }
  ];
  let createCalls = 0;
  const client: CategoryMutationClient = {
    async $transaction(callback) {
      return callback({
        category: {
          async findMany() {
            return existing;
          },
          async create() {
            createCalls += 1;
            throw new Error("should not create");
          }
        }
      });
    }
  };

  const result = await executeCatalogPromotionCategoryMutationPlan({
    client,
    plan,
    authorization: authorization()
  });

  assert.equal(createCalls, 0);
  assert.deepEqual(result.summary, {
    authorizedCategoryCreates: 2,
    createdCategories: 0,
    alreadyPresentCategories: 2,
    actualMutationsPerformed: 0
  });
});

test("authorized category execution aborts on category drift before any create", async () => {
  let createCalls = 0;
  const client: CategoryMutationClient = {
    async $transaction(callback) {
      return callback({
        category: {
          async findMany() {
            return [
              breadCategory,
              {
                id: "cat_conflict",
                name: "Different Name",
                slug: "snacks-biscuits-confectionery",
                isActive: true,
                recordSource: "INTERNAL",
                dataQualityStatus: "APPROVED",
                isStorefrontVisible: true
              }
            ];
          },
          async create() {
            createCalls += 1;
            return {};
          }
        }
      });
    }
  };

  await assert.rejects(
    executeCatalogPromotionCategoryMutationPlan({
      client,
      plan,
      authorization: authorization()
    }),
    /CATEGORY_MUTATION_DATABASE_DRIFT/
  );
  assert.equal(createCalls, 0);
});

test("authorized category execution rejects plan count drift before opening a transaction", async () => {
  let transactionCalls = 0;
  const client: CategoryMutationClient = {
    async $transaction<T>(): Promise<T> {
      transactionCalls += 1;
      throw new Error("should not run");
    }
  };

  await assert.rejects(
    executeCatalogPromotionCategoryMutationPlan({
      client,
      plan,
      authorization: {
        expectedSourceCategories: 3,
        expectedCategoryCreates: 12,
        expectedCategoryReuses: 1
      }
    }),
    /CATEGORY_MUTATION_AUTHORIZATION_MISMATCH/
  );
  assert.equal(transactionCalls, 0);
});
