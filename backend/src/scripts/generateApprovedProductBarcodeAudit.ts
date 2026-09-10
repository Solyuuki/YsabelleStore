import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import {
  buildApprovedProductBarcodeAudit,
  type ApprovedProductBarcodeAudit,
  type ApprovedProductBarcodeAuditInputRow
} from "../modules/catalog/catalog-approved-barcode-audit.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-approved-product-barcode-audit.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-approved-product-barcode-audit.md"
);

type RawApprovedProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: string;
  status: string;
  isStorefrontVisible: boolean;
  category: { name: string };
  sarimaSourceMapping: { sourceProductId: string } | null;
  inventory: { id: string } | null;
  _count: {
    inventoryBatches: number;
    inventoryMovements: number;
    saleItems: number;
    forecastRecords: number;
    recommendationRecords: number;
    historicalMonthlySales: number;
    historicalSalesImportRows: number;
    customerOrderItems: number;
    reviews: number;
    imageAssets: number;
  };
};

export type ApprovedBarcodeAuditPrismaClient = {
  product: {
    findMany(args: unknown): Promise<RawApprovedProductRow[]>;
  };
};

export type GenerateApprovedProductBarcodeAuditOptions = {
  client?: ApprovedBarcodeAuditPrismaClient;
  jsonPath?: string;
  reportPath?: string;
};

function toAuditInput(row: RawApprovedProductRow): ApprovedProductBarcodeAuditInputRow {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    categoryName: row.category.name,
    recordSource: row.recordSource,
    status: row.status,
    isStorefrontVisible: row.isStorefrontVisible,
    sarimaSourceProductId: row.sarimaSourceMapping?.sourceProductId ?? null,
    hasInventoryRecord: Boolean(row.inventory),
    relationshipCounts: {
      inventoryBatches: row._count.inventoryBatches,
      inventoryMovements: row._count.inventoryMovements,
      saleItems: row._count.saleItems,
      forecastRecords: row._count.forecastRecords,
      recommendationRecords: row._count.recommendationRecords,
      historicalMonthlySales: row._count.historicalMonthlySales,
      historicalSalesImportRows: row._count.historicalSalesImportRows,
      customerOrderItems: row._count.customerOrderItems,
      productReviews: row._count.reviews,
      imageAssets: row._count.imageAssets
    }
  };
}

function markdownCell(value: string | null) {
  return (value ?? "-").replaceAll("|", "\\|");
}

function toMarkdown(audit: ApprovedProductBarcodeAudit) {
  return [
    "# Phase 9 Approved Product Barcode Audit",
    "",
    "**READ-ONLY AUDIT.** No Product, barcode, quality status, storefront flag, mapping, inventory, or historical data was modified.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Approved products | ${audit.summary.approvedProducts} |`,
    `| Approved with barcode | ${audit.summary.approvedWithBarcode} |`,
    `| Approved missing barcode | ${audit.summary.approvedMissingBarcode} |`,
    `| Active approved missing barcode | ${audit.summary.activeApprovedMissingBarcode} |`,
    `| Storefront-approved missing barcode | ${audit.summary.storefrontApprovedMissingBarcode} |`,
    `| SARIMA-mapped approved products | ${audit.summary.sarimaMappedApproved} |`,
    `| SARIMA-mapped approved missing barcode | ${audit.summary.sarimaMappedApprovedMissingBarcode} |`,
    "",
    "## Approved Products",
    "",
    "| SKU | Product | Barcode | Barcode status | Category | Source | Status | Storefront | SARIMA source | Protected refs |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: |",
    ...audit.rows.map(
      (row) =>
        `| ${markdownCell(row.sku)} | ${markdownCell(row.name)} | ${markdownCell(row.barcode)} | ${row.barcodeStatus} | ${markdownCell(row.categoryName)} | ${markdownCell(row.recordSource)} | ${markdownCell(row.status)} | ${row.isStorefrontVisible ? "YES" : "NO"} | ${markdownCell(row.sarimaSourceProductId)} | ${row.protectedReferenceCount} |`
    ),
    "",
    "Barcode presence is reported as evidence only. This audit does not claim that an existing barcode is physically verified, and it does not classify a row as development/test data without provenance evidence.",
    ""
  ].join("\n");
}

async function writeTextFile(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateApprovedProductBarcodeAudit(
  options: GenerateApprovedProductBarcodeAuditOptions = {}
): Promise<ApprovedProductBarcodeAudit> {
  const client = options.client ?? (prisma as unknown as ApprovedBarcodeAuditPrismaClient);
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const rows = await client.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    where: { dataQualityStatus: "APPROVED" },
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      recordSource: true,
      status: true,
      isStorefrontVisible: true,
      category: { select: { name: true } },
      sarimaSourceMapping: { select: { sourceProductId: true } },
      inventory: { select: { id: true } },
      _count: {
        select: {
          inventoryBatches: true,
          inventoryMovements: true,
          saleItems: true,
          forecastRecords: true,
          recommendationRecords: true,
          historicalMonthlySales: true,
          historicalSalesImportRows: true,
          customerOrderItems: true,
          reviews: true,
          imageAssets: true
        }
      }
    }
  });

  const audit = buildApprovedProductBarcodeAudit(rows.map(toAuditInput));

  await Promise.all([
    writeTextFile(jsonPath, `${JSON.stringify(audit, null, 2)}\n`),
    writeTextFile(reportPath, toMarkdown(audit))
  ]);

  return audit;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;
  return path.resolve(entryPoint) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const audit = await generateApprovedProductBarcodeAudit();
    console.log(JSON.stringify(audit, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
