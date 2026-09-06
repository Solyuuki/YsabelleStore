import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runCatalogPromotionCategoryMutationExecution } from "../src/scripts/executeCatalogPromotionCategoryMutationPlan.js";
import type { CatalogPromotionCategoryMutationPlan } from "../src/modules/catalog/catalog-promotion-category-mutation-plan.js";
import type { CategoryMutationClient } from "../src/modules/catalog/catalog-promotion-category-mutation-execution.js";

function buildPlan(): CatalogPromotionCategoryMutationPlan {
  const createRows = Array.from({ length: 12 }, (_, index) => ({
    sourceCategory: `Category ${index + 1}`,
    candidateCount: 1,
    decision: "CREATE_CATEGORY" as const,
    proposedCategoryCreate: {
      name: `Category ${index + 1}`,
      slug: `category-${index + 1}`,
      isActive: true as const,
      recordSource: "IMPORT" as const,
      dataQualityStatus: "NEEDS_REVIEW" as const,
      isStorefrontVisible: false as const
    },
    existingCategoryId: null,
    reuseBasis: null,
    blockers: [],
    seedAdoptionEvidence: []
  }));
  const reuseRows = Array.from({ length: 3 }, (_, index) => ({
    sourceCategory: `Existing ${index + 1}`,
    candidateCount: 1,
    decision: "REUSE_EXISTING" as const,
    proposedCategoryCreate: null,
    existingCategoryId: `cat_existing_${index + 1}`,
    reuseBasis: "EXACT_NAME" as const,
    blockers: [],
    seedAdoptionEvidence: []
  }));

  return {
    summary: {
      sourceCategories: 15,
      proposedCategoryCreates: 12,
      proposedCategoryReuses: 3,
      blockedCategories: 0,
      seedAdoptionsCleared: 1,
      actualMutationsPerformed: 0
    },
    rows: [...createRows, ...reuseRows]
  };
}

test("guarded category mutation CLI applies exactly the approved 12-create plan", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "category-mutation-"));
  const planPath = path.join(tempDir, "plan.json");
  await fs.writeFile(planPath, JSON.stringify(buildPlan()), "utf8");

  const created: string[] = [];
  const client: CategoryMutationClient = {
    async $transaction(callback) {
      return callback({
        category: {
          async findMany() {
            return Array.from({ length: 3 }, (_, index) => ({
              id: `cat_existing_${index + 1}`,
              name: `Existing ${index + 1}`,
              slug: `existing-${index + 1}`,
              isActive: true,
              recordSource: "INTERNAL",
              dataQualityStatus: "APPROVED",
              isStorefrontVisible: true
            }));
          },
          async create(args: { data: { name: string } }) {
            created.push(args.data.name);
            return { id: `created_${created.length}`, ...args.data };
          }
        }
      });
    }
  };

  const result = await runCatalogPromotionCategoryMutationExecution({
    client,
    planPath,
    applyApproved12Categories: true
  });

  assert.equal(created.length, 12);
  assert.deepEqual(result.summary, {
    authorizedCategoryCreates: 12,
    createdCategories: 12,
    alreadyPresentCategories: 0,
    actualMutationsPerformed: 12
  });
});

test("guarded category mutation CLI refuses execution without the explicit apply flag", async () => {
  const client: CategoryMutationClient = {
    async $transaction<T>(): Promise<T> {
      throw new Error("transaction must not open");
    }
  };

  await assert.rejects(
    runCatalogPromotionCategoryMutationExecution({
      client,
      planPath: "unused.json",
      applyApproved12Categories: false
    }),
    /CATEGORY_MUTATION_EXPLICIT_APPLY_REQUIRED/
  );
});
