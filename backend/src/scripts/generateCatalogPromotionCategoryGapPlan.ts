import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  buildCatalogPromotionCategoryGapPlan,
  type CatalogPromotionCategoryGapPlan,
  type CategoryGapDatabaseCategory,
  type CategoryGapExecutionRow
} from "../modules/catalog/catalog-promotion-category-gap-plan.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_EXECUTION_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-execution-manifest.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-gap-plan.json"
);
const DEFAULT_CSV_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-gap-plan.csv"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-category-gap-plan.md"
);

type FindManyDelegate<T> = {
  findMany(args: unknown): Promise<T[]>;
};

export type CatalogPromotionCategoryGapPlanPrismaClient = {
  category: FindManyDelegate<CategoryGapDatabaseCategory>;
};

export type GenerateCatalogPromotionCategoryGapPlanOptions = {
  client?: CatalogPromotionCategoryGapPlanPrismaClient;
  executionPath?: string;
  jsonPath?: string;
  csvPath?: string;
  reportPath?: string;
};

type ExecutionArtifact = {
  rows: CategoryGapExecutionRow[];
};

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Invalid JSON: ${filePath}.`, { cause: error });
  }
}

async function writeText(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function csvCell(value: string | number | boolean | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(plan: CatalogPromotionCategoryGapPlan) {
  const header = [
    "sourceCategory",
    "candidateCount",
    "resolutionStatus",
    "recommendedAction",
    "matchedCategoryId",
    "matchedCategorySlug",
    "matchedRecordSource",
    "matchedDataQualityStatus",
    "matchedIsActive",
    "matchedStorefrontVisible",
    "productCodes"
  ];
  const lines = plan.rows.map((row) =>
    [
      row.sourceCategory,
      row.candidateCount,
      row.resolutionStatus,
      row.recommendedAction,
      row.matchedCategory?.id ?? null,
      row.matchedCategory?.slug ?? null,
      row.matchedCategory?.recordSource ?? null,
      row.matchedCategory?.dataQualityStatus ?? null,
      row.matchedCategory?.isActive ?? null,
      row.matchedCategory?.isStorefrontVisible ?? null,
      row.productCodes.join(";")
    ]
      .map(csvCell)
      .join(",")
  );
  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function markdownCell(value: string) {
  return value.replace(/\|/g, "\\|");
}

function toMarkdown(plan: CatalogPromotionCategoryGapPlan) {
  const { summary } = plan;
  return [
    "# Phase 9 Catalog Promotion Category Gap Plan",
    "",
    "**READ-ONLY TAXONOMY PLAN.** This report does not create or update categories and performs no Product, Inventory, InventoryBatch, or SARIMA mapping mutation.",
    "",
    "## Summary",
    "",
    `- ${summary.candidateRows} NEW source identities reviewed`,
    `- ${summary.distinctSourceCategories} distinct source category labels`,
    `- ${summary.existingStagingEligible} existing categories are staging-eligible`,
    `- ${summary.missingCategories} categories are missing and remain REVIEW_CREATE_OR_MAP`,
    `- ${summary.developmentSeedCategories} exact development-seed category identities remain review-only`,
    `- ${summary.testFixtureCategories} test-fixture categories remain review-only`,
    `- ${summary.inactiveCategories} inactive categories remain review-only`,
    `- ${summary.rejectedCategories} rejected categories remain review-only`,
    `- ${summary.ambiguousCategories} category-name resolutions are ambiguous`,
    `- ${summary.plannedCategoryCreates} Category creates planned`,
    `- ${summary.plannedCategoryUpdates} Category updates planned`,
    "",
    "## Safety Boundary",
    "",
    "Exact name agreement alone is not enough to promote a category. Existing category provenance, lifecycle state, and quality state are preserved in this report so development/test/inactive/rejected taxonomy cannot silently become operational.",
    "",
    "Missing labels are intentionally marked `REVIEW_CREATE_OR_MAP`; this generator does not infer parent/child taxonomy, rename categories, create aliases, or write any database record.",
    "",
    "## Category Rows",
    "",
    "| Source category | Candidates | Resolution | Recommended action | Matched ID | Record source | Quality | Active | Storefront |",
    "| --- | ---: | --- | --- | --- | --- | --- | --- | --- |",
    ...plan.rows.map((row) => {
      const matched = row.matchedCategory;
      return `| ${markdownCell(row.sourceCategory)} | ${row.candidateCount} | ${row.resolutionStatus} | ${row.recommendedAction} | ${matched?.id ?? "—"} | ${matched?.recordSource ?? "—"} | ${matched?.dataQualityStatus ?? "—"} | ${matched?.isActive ?? "—"} | ${matched?.isStorefrontVisible ?? "—"} |`;
    }),
    ""
  ].join("\n");
}

export async function generateCatalogPromotionCategoryGapPlan(
  options: GenerateCatalogPromotionCategoryGapPlanOptions = {}
): Promise<CatalogPromotionCategoryGapPlan> {
  const ownsClient = !options.client;
  const client =
    options.client ?? (new PrismaClient() as unknown as CatalogPromotionCategoryGapPlanPrismaClient);
  const executionPath = options.executionPath ?? DEFAULT_EXECUTION_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const csvPath = options.csvPath ?? DEFAULT_CSV_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const execution = await readJson<ExecutionArtifact>(executionPath);
  const categoryNames = uniqueSorted(execution.rows.map((row) => row.plannedCategory.trim()));

  try {
    const categories = await client.category.findMany({
      where: { name: { in: categoryNames } },
      select: {
        id: true,
        name: true,
        slug: true,
        isActive: true,
        recordSource: true,
        dataQualityStatus: true,
        isStorefrontVisible: true
      }
    });

    const plan = buildCatalogPromotionCategoryGapPlan({
      executionRows: execution.rows,
      categories
    });

    await Promise.all([
      writeText(jsonPath, `${JSON.stringify(plan, null, 2)}\n`),
      writeText(csvPath, toCsv(plan)),
      writeText(reportPath, toMarkdown(plan))
    ]);

    return plan;
  } finally {
    if (ownsClient) {
      await (client as unknown as PrismaClient).$disconnect();
    }
  }
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const plan = await generateCatalogPromotionCategoryGapPlan();
  console.log(JSON.stringify(plan.summary, null, 2));
}
