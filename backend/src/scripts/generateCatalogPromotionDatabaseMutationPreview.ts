import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  buildCatalogPromotionDatabaseMutationPreview,
  type CatalogPromotionDatabaseMutationPreview,
  type DatabaseMutationPreviewCategory,
  type DatabaseMutationPreviewMapping,
  type DatabaseMutationPreviewProduct
} from "../modules/catalog/catalog-promotion-database-mutation-preview.js";
import type { CatalogPromotionInactiveStagingRow } from "../modules/catalog/catalog-promotion-inactive-staging-plan.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_STAGING_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-inactive-staging-plan.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-database-mutation-preview.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-database-mutation-preview.md"
);

type FindManyDelegate<T> = {
  findMany(args: unknown): Promise<T[]>;
};

export type CatalogPromotionDatabaseMutationPreviewPrismaClient = {
  category: FindManyDelegate<DatabaseMutationPreviewCategory>;
  product: FindManyDelegate<DatabaseMutationPreviewProduct>;
  sarimaSourceProductMapping: FindManyDelegate<DatabaseMutationPreviewMapping>;
};

export type GenerateCatalogPromotionDatabaseMutationPreviewOptions = {
  client?: CatalogPromotionDatabaseMutationPreviewPrismaClient;
  stagingPath?: string;
  jsonPath?: string;
  reportPath?: string;
};

type StagingArtifact = {
  stageableRows: CatalogPromotionInactiveStagingRow[];
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

function markdownCell(value: string) {
  return value.replace(/\|/g, "\\|");
}

function toMarkdown(preview: CatalogPromotionDatabaseMutationPreview) {
  const { summary } = preview;
  return [
    "# Phase 9 Catalog Promotion Database Mutation Preview",
    "",
    "**READ-ONLY PREVIEW.** This report does not execute Product, SARIMA mapping, Inventory, or InventoryBatch mutations.",
    "",
    "## Summary",
    "",
    `- ${summary.candidates} staged inactive identities reviewed`,
    `- ${summary.productCreateReady} Product create payloads are structurally ready`,
    `- ${summary.productCreateBlocked} Product create payloads remain blocked`,
    `- ${summary.missingCategories} rows reference an unresolved category`,
    `- ${summary.developmentSeedCategoryMatches} rows resolve only to a development-seed category and remain blocked`,
    `- ${summary.skuCollisions} rows collide with an existing Product SKU`,
    `- ${summary.sourceProductMappingCollisions} rows collide with an existing SARIMA source-product mapping`,
    `- ${summary.mappingMetadataPending} rows still require the full SARIMA mapping metadata contract`,
    `- ${summary.nullableCostPriceRows} ready Product payloads preserve costPrice as null rather than inferring a value`,
    `- ${summary.plannedInventoryRows} Inventory rows planned`,
    `- ${summary.plannedInventoryBatchRows} InventoryBatch rows planned`,
    "",
    "## Safety Boundary",
    "",
    "The Product schema permits nullable `costPrice`, so unavailable cost is represented as `null`; this preview never substitutes zero, selling price, or a guessed margin.",
    "",
    "Exact development-seed category identities are not accepted as operational taxonomy. Matching rows remain blocked until an operational category is proven or separately approved.",
    "",
    "The SARIMA mapping schema requires source identity and historical evidence metadata beyond the staging row. Therefore `plannedSarimaMappingCreate` remains null until that mapping metadata contract is assembled and reviewed.",
    "",
    "Every Product payload remains `INACTIVE`, `NEEDS_REVIEW`, and storefront-hidden. This preview plans no Inventory or InventoryBatch creation and does not execute any database write.",
    "",
    "## Rows",
    "",
    "| Code | SKU | Category | Product readiness | Mapping readiness | Product blockers | Mapping blockers |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...preview.rows.map(
      (row) =>
        `| ${row.productCode} | ${row.plannedSku} | ${markdownCell(row.plannedCategory)} | ${row.productMutationReadiness} | ${row.mappingMutationReadiness} | ${row.productBlockers.join(", ") || "—"} | ${row.mappingBlockers.join(", ") || "—"} |`
    ),
    ""
  ].join("\n");
}

export async function generateCatalogPromotionDatabaseMutationPreview(
  options: GenerateCatalogPromotionDatabaseMutationPreviewOptions = {}
): Promise<CatalogPromotionDatabaseMutationPreview> {
  const ownsClient = !options.client;
  const client =
    options.client ??
    (new PrismaClient() as unknown as CatalogPromotionDatabaseMutationPreviewPrismaClient);
  const stagingPath = options.stagingPath ?? DEFAULT_STAGING_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const staging = await readJson<StagingArtifact>(stagingPath);
  const categoryNames = uniqueSorted(staging.stageableRows.map((row) => row.plannedCategory));
  const skus = uniqueSorted(staging.stageableRows.map((row) => row.plannedSku));
  const sourceProductIds = uniqueSorted(staging.stageableRows.map((row) => row.productCode));

  try {
    const [categories, products, mappings] = await Promise.all([
      client.category.findMany({
        where: { name: { in: categoryNames } },
        select: { id: true, name: true, slug: true }
      }),
      client.product.findMany({
        where: { sku: { in: skus } },
        select: { id: true, sku: true }
      }),
      client.sarimaSourceProductMapping.findMany({
        where: { sourceProductId: { in: sourceProductIds } },
        select: { sourceKey: true, sourceProductId: true, canonicalProductId: true }
      })
    ]);

    const preview = buildCatalogPromotionDatabaseMutationPreview({
      stagingRows: staging.stageableRows,
      categories,
      products,
      mappings
    });

    await Promise.all([
      writeText(jsonPath, `${JSON.stringify(preview, null, 2)}\n`),
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
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const preview = await generateCatalogPromotionDatabaseMutationPreview();
  console.log(JSON.stringify(preview.summary, null, 2));
}
