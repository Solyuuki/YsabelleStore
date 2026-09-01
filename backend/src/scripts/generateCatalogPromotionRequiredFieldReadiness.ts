import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildCatalogPromotionRequiredFieldReadiness,
  type CatalogPromotionRequiredFieldReadiness,
  type PromotionRequiredFieldHistoricalProduct
} from "../modules/catalog/catalog-promotion-required-field-readiness.js";
import type { CatalogPromotionExecutionManifest } from "../modules/catalog/catalog-promotion-execution-manifest.js";
import { loadHistoricalSalesData } from "../modules/forecasting/historical-sales.service.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_EXECUTION_MANIFEST_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-execution-manifest.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-required-field-readiness.json"
);
const DEFAULT_CSV_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-required-field-readiness.csv"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-required-field-readiness.md"
);

export type GenerateCatalogPromotionRequiredFieldReadinessOptions = {
  executionManifestPath?: string;
  jsonPath?: string;
  csvPath?: string;
  reportPath?: string;
  historicalProducts?: PromotionRequiredFieldHistoricalProduct[];
};

async function readExecutionManifest(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as CatalogPromotionExecutionManifest;
  } catch (error) {
    throw new Error(`Invalid catalog promotion execution manifest JSON: ${filePath}.`, {
      cause: error
    });
  }
}

async function loadHistoricalPriceEvidence(): Promise<PromotionRequiredFieldHistoricalProduct[]> {
  const historical = await loadHistoricalSalesData();
  if (!historical.validation.valid) {
    throw new Error("Historical workbook validation must pass before price evidence is generated.");
  }

  return historical.products.map((product) => ({
    productCode: product.productId,
    historicalSellingPrice2025: product.sellingPrice
  }));
}

function csvCell(value: string | number | null) {
  const text = value === null ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function toCsv(readiness: CatalogPromotionRequiredFieldReadiness) {
  const header = [
    "productCode",
    "plannedSku",
    "plannedName",
    "historicalSellingPrice2025",
    "historicalPriceMeaning",
    "currentSellingPrice",
    "currentPriceReadiness",
    "proposedUnit",
    "unitEvidence",
    "writeReadiness"
  ];

  const lines = readiness.rows.map((row) =>
    [
      row.productCode,
      row.plannedSku,
      row.plannedName,
      row.historicalSellingPrice2025,
      row.historicalPriceMeaning,
      row.currentSellingPrice,
      row.currentPriceReadiness,
      row.proposedUnit,
      row.unitEvidence,
      row.writeReadiness
    ]
      .map(csvCell)
      .join(",")
  );

  return `${header.join(",")}\n${lines.join("\n")}\n`;
}

function toMarkdown(readiness: CatalogPromotionRequiredFieldReadiness) {
  const { summary } = readiness;
  return [
    "# Phase 9 Catalog Promotion Required-Field Readiness",
    "",
    "**READ-ONLY EVIDENCE REPORT.** No Product, Inventory, InventoryBatch, mapping, price, stock, or storefront data was modified.",
    "",
    "## Summary",
    "",
    `- Candidates: ${summary.candidates}`,
    `- Historical 2025 price evidence available: ${summary.historicalPriceEvidenceAvailable}`,
    `- Current prices verified: ${summary.currentPriceVerified}`,
    `- Explicit units resolved from source names: ${summary.explicitUnitResolved}`,
    `- Units still requiring review: ${summary.unitNeedsReview}`,
    `- Ready to create: ${summary.readyToCreate}`,
    "",
    "## Price Rule",
    "",
    "The workbook selling price is retained only as historical price evidence with meaning `LAST_RECORDED_HISTORICAL_PRICE_2025`. It is not a verified current selling price and does not unlock Product creation.",
    "",
    "## Unit Rule",
    "",
    "A Product unit is proposed only when an explicit packaging word is present in the source product name: Sachet, Bottle, Pack, or Box. Ambiguous rows remain `REVIEW_REQUIRED`; this report does not default them to PIECE.",
    "",
    "## Rows",
    "",
    "| Code | SKU | Name | Historical 2025 price | Proposed unit | Unit evidence | Write readiness |",
    "| --- | --- | --- | ---: | --- | --- | --- |",
    ...readiness.rows.map(
      (row) =>
        `| ${row.productCode} | ${row.plannedSku} | ${row.plannedName.replace(/\|/g, "\\|")} | ${row.historicalSellingPrice2025 ?? ""} | ${row.proposedUnit ?? ""} | ${row.unitEvidence} | ${row.writeReadiness} |`
    ),
    ""
  ].join("\n");
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateCatalogPromotionRequiredFieldReadiness(
  options: GenerateCatalogPromotionRequiredFieldReadinessOptions = {}
): Promise<CatalogPromotionRequiredFieldReadiness> {
  const executionManifestPath =
    options.executionManifestPath ?? DEFAULT_EXECUTION_MANIFEST_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const csvPath = options.csvPath ?? DEFAULT_CSV_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const [executionManifest, historicalProducts] = await Promise.all([
    readExecutionManifest(executionManifestPath),
    options.historicalProducts
      ? Promise.resolve(options.historicalProducts)
      : loadHistoricalPriceEvidence()
  ]);

  const readiness = buildCatalogPromotionRequiredFieldReadiness({
    executionRows: executionManifest.rows,
    historicalProducts
  });

  await Promise.all([
    writeText(jsonPath, `${JSON.stringify(readiness, null, 2)}\n`),
    writeText(csvPath, toCsv(readiness)),
    writeText(reportPath, toMarkdown(readiness))
  ]);

  return readiness;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const readiness = await generateCatalogPromotionRequiredFieldReadiness();
  console.log(JSON.stringify(readiness.summary, null, 2));
}
