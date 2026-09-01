import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCatalogPromotionInactiveStagingPlan,
  type CatalogPromotionInactiveStagingPlan,
  type InactiveStagingExecutionRow,
  type InactiveStagingReadinessRow
} from "../modules/catalog/catalog-promotion-inactive-staging-plan.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_EXECUTION_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-execution-manifest.json"
);
const DEFAULT_READINESS_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-required-field-readiness.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-inactive-staging-plan.json"
);
const DEFAULT_CSV_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-inactive-staging-plan.csv"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-inactive-staging-plan.md"
);

export type GenerateCatalogPromotionInactiveStagingPlanOptions = {
  executionPath?: string;
  readinessPath?: string;
  jsonPath?: string;
  csvPath?: string;
  reportPath?: string;
};

type ExecutionArtifact = { rows: InactiveStagingExecutionRow[] };
type ReadinessArtifact = { rows: InactiveStagingReadinessRow[] };

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

function toCsv(plan: CatalogPromotionInactiveStagingPlan) {
  const header = [
    "productCode",
    "plannedSku",
    "plannedName",
    "plannedCategory",
    "plannedSellingPrice",
    "sellingPriceProvenance",
    "sellingPriceUsage",
    "plannedUnit",
    "unitEvidence",
    "plannedStatus",
    "plannedDataQualityStatus",
    "plannedRecordSource",
    "plannedStorefrontVisible",
    "plannedCreateInventory",
    "plannedCreateInventoryBatch",
    "plannedCreateSarimaMapping",
    "imageStatus",
    "assetFileIds",
    "activationBlockers"
  ];

  const lines = plan.stageableRows.map((row) =>
    [
      row.productCode,
      row.plannedSku,
      row.plannedName,
      row.plannedCategory,
      row.plannedSellingPrice,
      row.sellingPriceProvenance,
      row.sellingPriceUsage,
      row.plannedUnit,
      row.unitEvidence,
      row.plannedStatus,
      row.plannedDataQualityStatus,
      row.plannedRecordSource,
      row.plannedStorefrontVisible,
      row.plannedCreateInventory,
      row.plannedCreateInventoryBatch,
      row.plannedCreateSarimaMapping,
      row.imageStatus,
      row.assetFileIds.join(";"),
      row.activationBlockers.join(";")
    ]
      .map(csvCell)
      .join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function toMarkdown(plan: CatalogPromotionInactiveStagingPlan) {
  const { summary } = plan;
  return [
    "# Phase 9 Catalog Promotion Inactive Staging Plan",
    "",
    "**READ-ONLY STAGING PLAN.** No Product, Inventory, InventoryBatch, or mapping data was modified.",
    "",
    "## Summary",
    "",
    `- ${summary.candidates} promotion candidates reviewed`,
    `- ${summary.stageableInactiveIdentities} identities can be staged as INACTIVE`,
    `- ${summary.blockedUnitReview} remain blocked for unit review`,
    `- ${summary.blockedHistoricalPriceEvidence} remain blocked because positive historical price evidence is unavailable`,
    `- ${summary.currentPriceVerified} current selling prices verified`,
    `- ${summary.plannedInventoryRows} Inventory rows planned`,
    `- ${summary.plannedStorefrontVisible} storefront-visible rows planned`,
    "",
    "## Safety Boundary",
    "",
    "Historical 2025 selling price is used only as provisional persistence data required by the current Product schema. It is not treated as a verified current selling price.",
    "",
    "Every stageable row remains `INACTIVE`, `NEEDS_REVIEW`, and storefront-hidden. No Inventory or InventoryBatch row is planned. Activation remains blocked until current selling price, physical stock, and quality approval are independently verified.",
    "",
    "## Stageable Rows",
    "",
    "| Code | SKU | Name | Unit | Historical price | Image | Activation blockers |",
    "| --- | --- | --- | --- | ---: | --- | --- |",
    ...plan.stageableRows.map(
      (row) =>
        `| ${row.productCode} | ${row.plannedSku} | ${row.plannedName.replace(/\|/g, "\\|")} | ${row.plannedUnit} | ${row.plannedSellingPrice} | ${row.imageStatus} | ${row.activationBlockers.join(", ")} |`
    ),
    ""
  ].join("\n");
}

async function writeText(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function generateCatalogPromotionInactiveStagingPlan(
  options: GenerateCatalogPromotionInactiveStagingPlanOptions = {}
): Promise<CatalogPromotionInactiveStagingPlan> {
  const executionPath = options.executionPath ?? DEFAULT_EXECUTION_PATH;
  const readinessPath = options.readinessPath ?? DEFAULT_READINESS_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const csvPath = options.csvPath ?? DEFAULT_CSV_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const [execution, readiness] = await Promise.all([
    readJson<ExecutionArtifact>(executionPath),
    readJson<ReadinessArtifact>(readinessPath)
  ]);

  const plan = buildCatalogPromotionInactiveStagingPlan({
    executionRows: execution.rows,
    readinessRows: readiness.rows
  });

  await Promise.all([
    writeText(jsonPath, `${JSON.stringify(plan, null, 2)}\n`),
    writeText(csvPath, toCsv(plan)),
    writeText(reportPath, toMarkdown(plan))
  ]);

  return plan;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const plan = await generateCatalogPromotionInactiveStagingPlan();
  console.log(JSON.stringify(plan.summary, null, 2));
}
