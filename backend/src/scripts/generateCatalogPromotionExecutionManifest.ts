import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCatalogPromotionExecutionManifest,
  type CatalogPromotionExecutionManifest,
  type PromotionExecutionSource
} from "../modules/catalog/catalog-promotion-execution-manifest.js";
import type { OperationalCatalogAudit } from "../modules/catalog/catalog-operational-audit.js";
import type { CatalogPromotionPreview } from "../modules/catalog/catalog-promotion-preview.js";
import type { SarimaSourceIdentity } from "../modules/catalog/sarima-source-manifest.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_PREVIEW_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/catalog-promotion-preview.json"
);
const DEFAULT_AUDIT_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-operational-catalog-audit.json"
);
const DEFAULT_SOURCE_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/sarima-source-manifest.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-execution-manifest.json"
);
const DEFAULT_CSV_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-execution-manifest.csv"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-execution-manifest.md"
);

export type GenerateCatalogPromotionExecutionManifestOptions = {
  previewPath?: string;
  auditPath?: string;
  sourcePath?: string;
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

function csvCell(value: string | number | boolean | null) {
  const text = value === null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(manifest: CatalogPromotionExecutionManifest) {
  const header = [
    "productCode",
    "plannedSku",
    "plannedName",
    "plannedCategory",
    "plannedSellingPrice",
    "plannedUnit",
    "plannedInventoryQuantity",
    "plannedStorefrontVisible",
    "plannedDataQualityStatus",
    "plannedRecordSource",
    "imageStatus",
    "assetFileIds",
    "priceReadiness",
    "inventoryReadiness",
    "writeReadiness",
    "blockingFields"
  ];

  const lines = manifest.rows.map((row) =>
    [
      row.productCode,
      row.plannedSku,
      row.plannedName,
      row.plannedCategory,
      row.plannedSellingPrice,
      row.plannedUnit,
      row.plannedInventoryQuantity,
      row.plannedStorefrontVisible,
      row.plannedDataQualityStatus,
      row.plannedRecordSource,
      row.imageStatus,
      row.assetFileIds.join(";"),
      row.priceReadiness,
      row.inventoryReadiness,
      row.writeReadiness,
      row.blockingFields.join(";")
    ]
      .map(csvCell)
      .join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function toMarkdown(manifest: CatalogPromotionExecutionManifest) {
  const { summary } = manifest;
  return [
    "# Phase 9 Catalog Promotion Execution Manifest",
    "",
    "**READ-ONLY EXECUTION PLAN.** No Product, Inventory, InventoryBatch, mapping, price, or stock data was modified.",
    "",
    "## Summary",
    "",
    `- ${summary.promotionCandidates} total promotion candidates`,
    `- ${summary.newCandidates} NEW operational candidates included in this manifest`,
    `- ${summary.readyToCreate} ready to create`,
    `- ${summary.blockedForRequiredFields} blocked for required Product fields`,
    `- ${summary.excludedExisting} existing Products excluded`,
    `- ${summary.excludedDuplicateAliases} duplicate aliases excluded`,
    `- ${summary.excludedBlocked} blocked identities excluded`,
    "",
    "## Required-Field Gate",
    "",
    "Every NEW row currently keeps `sellingPrice` and `unit` unset because Phase 9 evidence does not verify a current selling price or Product unit for safe operational creation.",
    "",
    "No historical selling price is promoted as a current price. No default unit is invented. No Inventory or InventoryBatch row is planned, and storefront visibility remains false.",
    "",
    "## Planned Rows",
    "",
    "| Code | SKU | Name | Category | Image | Write readiness | Blocking fields |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...manifest.rows.map(
      (row) =>
        `| ${row.productCode} | ${row.plannedSku} | ${row.plannedName.replace(/\|/g, "\\|")} | ${row.plannedCategory.replace(/\|/g, "\\|")} | ${row.imageStatus} | ${row.writeReadiness} | ${row.blockingFields.join(", ")} |`
    ),
    ""
  ].join("\n");
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateCatalogPromotionExecutionManifest(
  options: GenerateCatalogPromotionExecutionManifestOptions = {}
): Promise<CatalogPromotionExecutionManifest> {
  const previewPath = options.previewPath ?? DEFAULT_PREVIEW_PATH;
  const auditPath = options.auditPath ?? DEFAULT_AUDIT_PATH;
  const sourcePath = options.sourcePath ?? DEFAULT_SOURCE_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const csvPath = options.csvPath ?? DEFAULT_CSV_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const [preview, audit, sources] = await Promise.all([
    readJson<CatalogPromotionPreview>(previewPath),
    readJson<OperationalCatalogAudit>(auditPath),
    readJson<SarimaSourceIdentity[]>(sourcePath)
  ]);

  const executionSources: PromotionExecutionSource[] = sources.map((source) => ({
    productCode: source.productCode,
    sourceName: source.sourceName,
    category: source.category
  }));

  const manifest = buildCatalogPromotionExecutionManifest({
    preview,
    audit,
    sources: executionSources
  });

  await Promise.all([
    writeText(jsonPath, `${JSON.stringify(manifest, null, 2)}\n`),
    writeText(csvPath, toCsv(manifest)),
    writeText(reportPath, toMarkdown(manifest))
  ]);

  return manifest;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return (
    Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url))
  );
}

if (isDirectExecution()) {
  const manifest = await generateCatalogPromotionExecutionManifest();
  console.log(JSON.stringify(manifest.summary, null, 2));
}
