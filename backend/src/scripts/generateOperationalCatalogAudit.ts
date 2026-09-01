import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildOperationalCatalogAudit,
  type OperationalCatalogAudit,
  type OperationalProductQualityStatus,
  type OperationalProductRecordSource,
  type OperationalProductSnapshot
} from "../modules/catalog/catalog-operational-audit.js";
import type { CatalogPromotionPreview } from "../modules/catalog/catalog-promotion-preview.js";
import { prisma } from "../database/prismaClient.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_PREVIEW_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/catalog-promotion-preview.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-operational-catalog-audit.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-operational-catalog-audit.md"
);

type RawOperationalProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: OperationalProductRecordSource;
  dataQualityStatus: OperationalProductQualityStatus;
  sarimaSourceMapping: { sourceProductId: string } | null;
  aliases: Array<{ value: string }>;
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

export type OperationalAuditPrismaClient = {
  product: {
    findMany(args: unknown): Promise<RawOperationalProductRow[]>;
  };
};

export type GenerateOperationalCatalogAuditOptions = {
  client?: OperationalAuditPrismaClient;
  previewPath?: string;
  jsonPath?: string;
  reportPath?: string;
};

async function readPreview(filePath: string): Promise<CatalogPromotionPreview> {
  const raw = await fs.readFile(filePath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid catalog promotion preview JSON: ${filePath}.`, { cause: error });
  }

  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as CatalogPromotionPreview).rows)) {
    throw new Error(`Catalog promotion preview is malformed: ${filePath}.`);
  }

  return parsed as CatalogPromotionPreview;
}

function toSnapshot(row: RawOperationalProductRow): OperationalProductSnapshot {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    recordSource: row.recordSource,
    dataQualityStatus: row.dataQualityStatus,
    sarimaSourceProductId: row.sarimaSourceMapping?.sourceProductId ?? null,
    rawNameAliases: row.aliases.map((alias) => alias.value),
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

function toMarkdown(audit: OperationalCatalogAudit) {
  const blocked = audit.candidateRows.filter((row) => row.status === "BLOCKED");
  const fixtures = audit.testFixtures;
  const developmentSeeds = audit.developmentSeedProducts;
  const legacyRuntimeQaProducts = audit.legacyRuntimeQaProducts;
  const unmatched = audit.unmatchedOperationalProducts;

  return [
    "# Phase 9 Operational Catalog Audit",
    "",
    "**READ-ONLY AUDIT.** No Product, Inventory, InventoryBatch, price, stock, mapping, or fixture data was modified.",
    "",
    "## Summary",
    "",
    "| Classification | Count |",
    "| --- | ---: |",
    `| Promotion candidates | ${audit.summary.promotionCandidates} |`,
    `| Existing operational products | ${audit.summary.existing} |`,
    `| New product candidates | ${audit.summary.new} |`,
    `| Historical duplicate aliases | ${audit.summary.duplicateAliases} |`,
    `| Blocked candidates | ${audit.summary.blocked} |`,
    `| Test fixture products | ${audit.summary.testFixtures} |`,
    `| Test fixtures with protected references | ${audit.summary.testFixturesWithProtectedReferences} |`,
    `| Development seed products | ${audit.summary.developmentSeedProducts} |`,
    `| Development seeds with protected references | ${audit.summary.developmentSeedProductsWithProtectedReferences} |`,
    `| Legacy runtime QA products | ${audit.summary.legacyRuntimeQaProducts} |`,
    `| Legacy runtime QA products with protected references | ${audit.summary.legacyRuntimeQaProductsWithProtectedReferences} |`,
    `| Unmatched non-fixture operational products | ${audit.summary.unmatchedOperationalProducts} |`,
    "",
    "## Blocked Promotion Candidates",
    "",
    ...(blocked.length > 0
      ? blocked.map(
          (row) =>
            `- ${row.productCode} — ${row.sourceName} — ${row.reason}`
        )
      : ["- None"]),
    "",
    "## Test Fixtures",
    "",
    ...(fixtures.length > 0
      ? fixtures.map(
          (row) =>
            `- ${row.sku} — ${row.name} — protected references: ${row.protectedReferenceCount}`
        )
      : ["- None"]),
    "",
    "## Development Seed Products",
    "",
    ...(developmentSeeds.length > 0
      ? developmentSeeds.map(
          (row) =>
            `- ${row.sku} — ${row.name} — protected references: ${row.protectedReferenceCount}`
        )
      : ["- None"]),
    "",
    "Development seeds are exact repository-seeded sample identities. They are quarantined from operational unmatched results but are not deleted, detached, merged, or rewritten by this audit.",
    "",
    "## Legacy Runtime QA Products",
    "",
    ...(legacyRuntimeQaProducts.length > 0
      ? legacyRuntimeQaProducts.map(
          (row) =>
            `- ${row.sku} — ${row.name} — protected references: ${row.protectedReferenceCount}`
        )
      : ["- None"]),
    "",
    "Legacy runtime QA products are exact provenance-reviewed identities keyed by Product ID, SKU, and barcode. They are quarantined from operational unmatched results but their inventory and transaction history is preserved.",
    "",
    "Test fixtures are audit findings only. This report does not delete, detach, merge, or rewrite them.",
    "",
    "## Unmatched Operational Products",
    "",
    ...(unmatched.length > 0
      ? unmatched.map(
          (row) =>
            `- ${row.sku} — ${row.name} — quality: ${row.dataQualityStatus}`
        )
      : ["- None"]),
    "",
    "Any destructive fixture cleanup, development-seed cleanup, legacy-runtime-QA cleanup, or operational catalog promotion remains a separate reviewed step.",
    ""
  ].join("\n");
}

async function writeTextFile(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateOperationalCatalogAudit(
  options: GenerateOperationalCatalogAuditOptions = {}
): Promise<OperationalCatalogAudit> {
  const client = options.client ?? (prisma as unknown as OperationalAuditPrismaClient);
  const previewPath = options.previewPath ?? DEFAULT_PREVIEW_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const preview = await readPreview(previewPath);
  const rows = await client.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      recordSource: true,
      dataQualityStatus: true,
      sarimaSourceMapping: {
        select: { sourceProductId: true }
      },
      aliases: {
        where: { type: "RAW_NAME" },
        select: { value: true }
      },
      inventory: {
        select: { id: true }
      },
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

  const audit = buildOperationalCatalogAudit(preview, rows.map(toSnapshot));

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
    const audit = await generateOperationalCatalogAudit();
    console.log(JSON.stringify(audit.summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
