import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  executeCatalogPromotionCategoryMutationPlan,
  type CategoryMutationClient,
  type CategoryMutationExecutionResult
} from "../modules/catalog/catalog-promotion-category-mutation-execution.js";
import type { CatalogPromotionCategoryMutationPlan } from "../modules/catalog/catalog-promotion-category-mutation-plan.js";
import { prisma } from "../database/prismaClient.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_PLAN_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-mutation-plan.json"
);
const APPLY_FLAG = "--apply-approved-12-categories";

export type RunCatalogPromotionCategoryMutationExecutionOptions = {
  client?: CategoryMutationClient;
  planPath?: string;
  applyApproved12Categories: boolean;
};

async function readPlan(filePath: string): Promise<CatalogPromotionCategoryMutationPlan> {
  const raw = await fs.readFile(filePath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid category mutation plan JSON: ${filePath}.`, { cause: error });
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !Array.isArray((parsed as CatalogPromotionCategoryMutationPlan).rows) ||
    !(parsed as CatalogPromotionCategoryMutationPlan).summary
  ) {
    throw new Error(`Category mutation plan is malformed: ${filePath}.`);
  }

  return parsed as CatalogPromotionCategoryMutationPlan;
}

export async function runCatalogPromotionCategoryMutationExecution(
  options: RunCatalogPromotionCategoryMutationExecutionOptions
): Promise<CategoryMutationExecutionResult> {
  if (!options.applyApproved12Categories) {
    throw new Error(
      `CATEGORY_MUTATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG} only after explicit approval.`
    );
  }

  const planPath = options.planPath ?? DEFAULT_PLAN_PATH;
  const plan = await readPlan(planPath);
  const client = options.client ?? (prisma as unknown as CategoryMutationClient);

  return executeCatalogPromotionCategoryMutationPlan({
    client,
    plan,
    authorization: {
      expectedSourceCategories: 15,
      expectedCategoryCreates: 12,
      expectedCategoryReuses: 3
    }
  });
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const result = await runCatalogPromotionCategoryMutationExecution({
      applyApproved12Categories: process.argv.includes(APPLY_FLAG)
    });
    console.log(JSON.stringify(result.summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
