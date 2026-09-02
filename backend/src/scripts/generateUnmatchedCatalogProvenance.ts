import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_AUDIT_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-operational-catalog-audit.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-unmatched-catalog-provenance.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-unmatched-catalog-provenance.md"
);

type DecimalLike = string | number | { toString(): string };

type RawProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  variant: string | null;
  status: string;
  recordSource: string;
  dataQualityStatus: string;
  costPrice: DecimalLike | null;
  sellingPrice: DecimalLike;
  createdAt: Date;
  updatedAt: Date;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  inventory: {
    quantityOnHand: number;
    lastStockUpdatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  inventoryBatches: Array<{
    id: string;
    batchCode: string;
    quantityReceived: number;
    quantityRemaining: number;
    unitCost: DecimalLike;
    receivedAt: Date;
    expiresAt: Date | null;
    status: string;
    createdAt: Date;
  }>;
  inventoryMovements: Array<{
    id: string;
    type: string;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    reason: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: Date;
  }>;
  saleItems: Array<{
    id: string;
    quantity: number;
    unitPrice: DecimalLike;
    totalAmount: DecimalLike;
    createdAt: Date;
    sale: {
      id: string;
      saleNumber: string;
      saleDate: Date;
      status: string;
      notes: string | null;
      createdAt: Date;
    };
  }>;
};

export type UnmatchedCatalogProvenancePrismaClient = {
  product: {
    findMany(args: unknown): Promise<RawProductRow[]>;
  };
};

export type GenerateUnmatchedCatalogProvenanceOptions = {
  client?: UnmatchedCatalogProvenancePrismaClient;
  auditPath?: string;
  jsonPath?: string;
  reportPath?: string;
};

type UnmatchedAuditInput = {
  unmatchedOperationalProducts?: Array<{ productId?: unknown }>;
};

function decimalToString(value: DecimalLike | null): string | null {
  if (value === null) return null;
  return String(value);
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

async function readUnmatchedProductIds(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  let parsed: UnmatchedAuditInput;

  try {
    parsed = JSON.parse(raw) as UnmatchedAuditInput;
  } catch (error) {
    throw new Error(`Invalid operational catalog audit JSON: ${filePath}.`, { cause: error });
  }

  if (!Array.isArray(parsed.unmatchedOperationalProducts)) {
    throw new Error(`Operational catalog audit is missing unmatchedOperationalProducts: ${filePath}.`);
  }

  const ids = parsed.unmatchedOperationalProducts
    .map((row) => row?.productId)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  return [...new Set(ids)].sort();
}

function toEvidenceRow(row: RawProductRow) {
  return {
    productId: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    description: row.description,
    brand: row.brand,
    variant: row.variant,
    status: row.status,
    recordSource: row.recordSource,
    dataQualityStatus: row.dataQualityStatus,
    costPrice: decimalToString(row.costPrice),
    sellingPrice: decimalToString(row.sellingPrice),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    category: row.category,
    inventory: row.inventory
      ? {
          quantityOnHand: row.inventory.quantityOnHand,
          lastStockUpdatedAt: iso(row.inventory.lastStockUpdatedAt),
          createdAt: iso(row.inventory.createdAt),
          updatedAt: iso(row.inventory.updatedAt)
        }
      : null,
    inventoryBatches: row.inventoryBatches.map((batch) => ({
      id: batch.id,
      batchCode: batch.batchCode,
      quantityReceived: batch.quantityReceived,
      quantityRemaining: batch.quantityRemaining,
      unitCost: decimalToString(batch.unitCost),
      receivedAt: iso(batch.receivedAt),
      expiresAt: iso(batch.expiresAt),
      status: batch.status,
      createdAt: iso(batch.createdAt)
    })),
    inventoryMovements: row.inventoryMovements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      quantityBefore: movement.quantityBefore,
      quantityAfter: movement.quantityAfter,
      reason: movement.reason,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      createdAt: iso(movement.createdAt)
    })),
    saleItems: row.saleItems.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      unitPrice: decimalToString(item.unitPrice),
      totalAmount: decimalToString(item.totalAmount),
      createdAt: iso(item.createdAt),
      sale: {
        id: item.sale.id,
        saleNumber: item.sale.saleNumber,
        saleDate: iso(item.sale.saleDate),
        status: item.sale.status,
        notes: item.sale.notes,
        createdAt: iso(item.sale.createdAt)
      }
    }))
  };
}

export type UnmatchedCatalogProvenance = ReturnType<typeof buildResult>;

function buildResult(requestedProductIds: string[], rows: RawProductRow[]) {
  const foundIds = new Set(rows.map((row) => row.id));
  const missingProductIds = requestedProductIds.filter((id) => !foundIds.has(id));

  return {
    readOnly: true,
    requestedProductCount: requestedProductIds.length,
    resolvedProductCount: rows.length,
    missingProductCount: missingProductIds.length,
    missingProductIds,
    products: rows
      .map(toEvidenceRow)
      .sort((left, right) => left.productId.localeCompare(right.productId))
  };
}

function toMarkdown(result: UnmatchedCatalogProvenance) {
  const lines = [
    "# Phase 9 Unmatched Catalog Provenance Audit",
    "",
    "**READ-ONLY AUDIT.** This report does not create, update, delete, merge, remap, or quarantine Product, Inventory, InventoryBatch, movement, or sales data.",
    "",
    `Requested unresolved products: ${result.requestedProductCount}`,
    `Resolved from database: ${result.resolvedProductCount}`,
    `Missing from database: ${result.missingProductCount}`,
    ""
  ];

  if (result.missingProductIds.length > 0) {
    lines.push("## Missing Product IDs", "", ...result.missingProductIds.map((id) => `- ${id}`), "");
  }

  for (const product of result.products) {
    lines.push(
      `## ${product.sku} — ${product.name}`,
      "",
      `- Product ID: ${product.productId}`,
      `- Barcode: ${product.barcode ?? "None"}`,
      `- Record source: ${product.recordSource}`,
      `- Quality: ${product.dataQualityStatus}`,
      `- Status: ${product.status}`,
      `- Category: ${product.category.name}`,
      `- Description: ${product.description ?? "None"}`,
      `- Brand: ${product.brand ?? "None"}`,
      `- Variant: ${product.variant ?? "None"}`,
      `- Cost price: ${product.costPrice ?? "None"}`,
      `- Selling price: ${product.sellingPrice ?? "None"}`,
      `- Created: ${product.createdAt}`,
      `- Updated: ${product.updatedAt}`,
      `- Inventory quantity on hand: ${product.inventory?.quantityOnHand ?? "None"}`,
      "",
      "### Inventory Batches",
      ""
    );

    if (product.inventoryBatches.length === 0) {
      lines.push("- None");
    } else {
      for (const batch of product.inventoryBatches) {
        lines.push(
          `- ${batch.batchCode}: received=${batch.quantityReceived}, remaining=${batch.quantityRemaining}, unitCost=${batch.unitCost}, status=${batch.status}, receivedAt=${batch.receivedAt}, expiresAt=${batch.expiresAt ?? "None"}`
        );
      }
    }

    lines.push("", "### Inventory Movements", "");
    if (product.inventoryMovements.length === 0) {
      lines.push("- None");
    } else {
      for (const movement of product.inventoryMovements) {
        lines.push(
          `- ${movement.type}: qty=${movement.quantity}, ${movement.quantityBefore}->${movement.quantityAfter}, reason=${movement.reason ?? "None"}, reference=${movement.referenceType ?? "None"}/${movement.referenceId ?? "None"}, createdAt=${movement.createdAt}`
        );
      }
    }

    lines.push("", "### Sale Items", "");
    if (product.saleItems.length === 0) {
      lines.push("- None");
    } else {
      for (const item of product.saleItems) {
        lines.push(
          `- ${item.sale.saleNumber}: status=${item.sale.status}, saleDate=${item.sale.saleDate}, qty=${item.quantity}, unitPrice=${item.unitPrice}, total=${item.totalAmount}, notes=${item.sale.notes ?? "None"}`
        );
      }
    }

    lines.push("");
  }

  lines.push(
    "No provenance row in this report is sufficient by itself to authorize destructive cleanup or canonical remapping.",
    ""
  );

  return lines.join("\n");
}

async function writeTextFile(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateUnmatchedCatalogProvenance(
  options: GenerateUnmatchedCatalogProvenanceOptions = {}
): Promise<UnmatchedCatalogProvenance> {
  const client = options.client ?? (prisma as unknown as UnmatchedCatalogProvenancePrismaClient);
  const auditPath = options.auditPath ?? DEFAULT_AUDIT_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;
  const productIds = await readUnmatchedProductIds(auditPath);

  const rows = productIds.length === 0
    ? []
    : await client.product.findMany({
        where: { id: { in: productIds } },
        orderBy: [{ id: "asc" }],
        select: {
          id: true,
          sku: true,
          barcode: true,
          name: true,
          description: true,
          brand: true,
          variant: true,
          status: true,
          recordSource: true,
          dataQualityStatus: true,
          costPrice: true,
          sellingPrice: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { id: true, name: true, slug: true } },
          inventory: {
            select: {
              quantityOnHand: true,
              lastStockUpdatedAt: true,
              createdAt: true,
              updatedAt: true
            }
          },
          inventoryBatches: {
            orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              batchCode: true,
              quantityReceived: true,
              quantityRemaining: true,
              unitCost: true,
              receivedAt: true,
              expiresAt: true,
              status: true,
              createdAt: true
            }
          },
          inventoryMovements: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              type: true,
              quantity: true,
              quantityBefore: true,
              quantityAfter: true,
              reason: true,
              referenceType: true,
              referenceId: true,
              createdAt: true
            }
          },
          saleItems: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              quantity: true,
              unitPrice: true,
              totalAmount: true,
              createdAt: true,
              sale: {
                select: {
                  id: true,
                  saleNumber: true,
                  saleDate: true,
                  status: true,
                  notes: true,
                  createdAt: true
                }
              }
            }
          }
        }
      });

  const result = buildResult(productIds, rows);

  await Promise.all([
    writeTextFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`),
    writeTextFile(reportPath, toMarkdown(result))
  ]);

  return result;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  if (!entryPoint) return false;
  return path.resolve(entryPoint) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  try {
    const result = await generateUnmatchedCatalogProvenance();
    console.log(
      JSON.stringify(
        {
          requestedProductCount: result.requestedProductCount,
          resolvedProductCount: result.resolvedProductCount,
          missingProductCount: result.missingProductCount
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}
