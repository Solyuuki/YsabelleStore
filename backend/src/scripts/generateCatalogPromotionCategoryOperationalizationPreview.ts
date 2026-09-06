import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import type {
  CatalogPromotionCategoryGapPlan,
  CategoryGapDatabaseCategory
} from "../modules/catalog/catalog-promotion-category-gap-plan.js";
import {
  buildCatalogPromotionCategoryOperationalizationPreview,
  type CatalogPromotionCategoryOperationalizationPreview,
  type CategoryOperationalizationProduct
} from "../modules/catalog/catalog-promotion-category-operationalization-preview.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_GAP_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-gap-plan.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-operationalization-preview.json"
);
const DEFAULT_CSV_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-operationalization-preview.csv"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-category-operationalization-preview.md"
);

type FindManyDelegate<T> = {
  findMany(args: unknown): Promise<T[]>;
};

export type CatalogPromotionCategoryOperationalizationPreviewPrismaClient = {
  category: FindManyDelegate<CategoryGapDatabaseCategory>;
  product: FindManyDelegate<CategoryOperationalizationProduct>;
};

export type GenerateCatalogPromotionCategoryOperationalizationPreviewOptions = {
  client?: CatalogPromotionCategoryOperationalizationPreviewPrismaClient;
  gapPath?: string;
  jsonPath?: string;
  csvPath?: string;
  reportPath?: string;
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

function csvCell(value: string | number | null) {
  if (value === null) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(preview: CatalogPromotionCategoryOperationalizationPreview) {
  const header = [
    "sourceCategory",
    "candidateCount",
    "decision",
    "proposedName",
    "proposedSlug",
    "existingCategoryId",
    "seedCategoryProductReferences",
    "seedCategoryNonSeedProductReferences",
    "seedCategoryProducts"
  ];
  const lines = preview.rows.map((row) =>
    [
      row.sourceCategory,
      row.candidateCount,
      row.decision,
      row.proposedCategory?.name ?? null,
      row.proposedCategory?.slug ?? null,
      row.existingCategoryId,
      row.seedCategoryProductReferences,
      row.seedCategoryNonSeedProductReferences,
      row.seedCategoryProducts
        .map(
          (product) =>
            `${product.id}:${product.sku}:${product.isDevelopmentSeed ? "SEED" : "NON_SEED"}`
        )
        .join(";")
    ]
      .map(csvCell)
      .join(",")
  );
  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function markdownCell(value: string) {
  return value.replace(/\|/g, "\\|");
}

function toMarkdown(preview: CatalogPromotionCategoryOperationalizationPreview) {
  const { summary } = preview;
  return [
    "# Phase 9 Catalog Promotion Category Operationalization Preview",
    "",
    "**READ-ONLY CATEGORY OPERATIONALIZATION PREVIEW.** This report performs zero database mutations and does not create or update Category, Product, Inventory, InventoryBatch, or SARIMA mapping records.",
    "",
    "## Summary",
    "",
    `- ${summary.sourceCategories} source categories reviewed`,
    `- ${summary.proposeCreate} categories have PROPOSE_CREATE decisions`,
    `- ${summary.reuseExisting} categories reuse an existing staging-eligible category`,
    `- ${summary.reviewAdoptSeed} development-seed categories require adoption review`,
    `- ${summary.blockedNameCollision} proposed categories are blocked by name collision`,
    `- ${summary.blockedSlugCollision} proposed categories are blocked by slug collision`,
    `- ${summary.seedCategoryProductReferences} Product references exist under reviewed seed categories`,
    `- ${summary.seedCategoryNonSeedProductReferences} of those references are not exact development-seed Products`,
    `- ${summary.plannedCategoryCreates} Category creates planned`,
    `- ${summary.plannedCategoryUpdates} Category updates planned`,
    `- ${summary.actualMutationsPerformed} actual mutations performed`,
    "",
    "## Safety Boundary",
    "",
    "`PROPOSE_CREATE` is review evidence only. Proposed categories remain active but `IMPORT`, `NEEDS_REVIEW`, and storefront-hidden; this preview does not execute their creation.",
    "",
    "Existing categories are reused only when the prior Category Gap Plan classified them as staging-eligible. Development-seed categories are never auto-adopted; their current Product references are surfaced for review.",
    "",
    "Name or slug collisions remain blocking. No category rename, reassignment, deletion, merge, Product mutation, stock mutation, or mapping mutation occurs here.",
    "",
    "## Category Decisions",
    "",
    "| Source category | Candidates | Decision | Proposed slug | Existing category | Seed refs | Non-seed refs |",
    "| --- | ---: | --- | --- | --- | ---: | ---: |",
    ...preview.rows.map(
      (row) =>
        `| ${markdownCell(row.sourceCategory)} | ${row.candidateCount} | ${row.decision} | ${row.proposedCategory?.slug ?? "—"} | ${row.existingCategoryId ?? "—"} | ${row.seedCategoryProductReferences} | ${row.seedCategoryNonSeedProductReferences} |`
    ),
    ""
  ].join("\n");
}

export async function generateCatalogPromotionCategoryOperationalizationPreview(
  options: GenerateCatalogPromotionCategoryOperationalizationPreviewOptions = {}
): Promise<CatalogPromotionCategoryOperationalizationPreview> {
  const ownsClient = !options.client;
  const client =
    options.client ??
    (new PrismaClient() as unknown as CatalogPromotionCategoryOperationalizationPreviewPrismaClient);
  const gapPath = options.gapPath ?? DEFAULT_GAP_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const csvPath = options.csvPath ?? DEFAULT_CSV_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const gap = await readJson<CatalogPromotionCategoryGapPlan>(gapPath);
  const seedCategoryIds = uniqueSorted(
    gap.rows
      .filter(
        (row) =>
          row.resolutionStatus === "DEVELOPMENT_SEED_CATEGORY" && row.matchedCategory !== null
      )
      .map((row) => row.matchedCategory!.id)
  );

  try {
    const [categories, categoryProducts] = await Promise.all([
      client.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          recordSource: true,
          dataQualityStatus: true,
          isStorefrontVisible: true
        }
      }),
      client.product.findMany({
        where: { categoryId: { in: seedCategoryIds } },
        select: { id: true, sku: true, categoryId: true }
      })
    ]);

    const preview = buildCatalogPromotionCategoryOperationalizationPreview({
      gapRows: gap.rows,
      allCategories: categories,
      categoryProducts
    });

    await Promise.all([
      writeText(jsonPath, `${JSON.stringify(preview, null, 2)}\n`),
      writeText(csvPath, toCsv(preview)),
      writeText(reportPath, toMarkdown(preview))
    ]);

    return preview;
  } finally {
    if (ownsClient) {
      await (client as unknown as PrismaClient).$disconnect();
    }
  }
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return (
    Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url))
  );
}

if (isDirectExecution()) {
  const preview = await generateCatalogPromotionCategoryOperationalizationPreview();
  console.log(JSON.stringify(preview.summary, null, 2));
}
