import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

import { Prisma, type HistoricalSalesRowStatus } from "@prisma/client";
import { readSheet } from "read-excel-file/node";

import { prisma } from "../database/prismaClient.js";
import {
  assessSarimaEligibility,
  getEffectiveMonthlySeries,
  SARIMA_MINIMUM_OBSERVATIONS
} from "../modules/forecasting/effective-sales.service.js";
import { invalidateForecastCache } from "../modules/forecasting/forecast.service.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeCode, normalizeWhitespace } from "../utils/normalizers.js";
import { operationalProductWhere } from "./catalogQualityPolicy.js";

export const HISTORICAL_SALES_TEMPLATE_HEADERS = [
  "sku",
  "barcode",
  "productName",
  "period",
  "quantitySold",
  "unitPrice",
  "salesAmount"
] as const;

export const HISTORICAL_SALES_IMPORT_MODES = [
  "APPEND_ONLY",
  "REJECT_ON_OVERLAP",
  "REPLACE_IMPORTED_OVERLAPS"
] as const;

export const HISTORICAL_SALES_PREVIEW_EXPIRATION_MS = 24 * 60 * 60 * 1000;
export const HISTORICAL_SALES_PREVIEW_EXPIRED_MESSAGE =
  "This historical sales preview expired after 24 hours. Preview the file again before confirming.";
export const ACTIVE_HISTORICAL_SALES_DUPLICATE_STATUSES = [
  "COMPLETED",
  "COMPLETED_WITH_SKIPS"
] as const;

export type HistoricalSalesImportMode = (typeof HISTORICAL_SALES_IMPORT_MODES)[number];

export async function runHistoricalSalesMutationWithForecastInvalidation<T>(
  mutation: () => Promise<T>,
  invalidate: (result: T) => void = () => invalidateForecastCache()
) {
  const result = await mutation();
  invalidate(result);
  return result;
}

function affectedProductIdsFromMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const productIds = metadata.affectedProductIds;
  return Array.isArray(productIds)
    ? productIds.filter((value): value is string => typeof value === "string")
    : [];
}

type UploadFile = { originalname: string; mimetype: string; buffer: Buffer };
type RowStatus = "VALID" | "WARNING" | "INVALID" | "UNMATCHED" | "DUPLICATE" | "OVERLAP";
type ConfirmablePreview = {
  createdAt: Date;
  errorMessage?: string | null;
  importedByUserId: string;
  status: string;
};
type PreviewExpirationClient = {
  historicalSalesImportBatch: {
    updateMany(args: {
      data: { errorMessage: string; failedAt: Date; status: "FAILED" };
      where: { createdAt: { lte: Date }; status: "PREVIEWED" };
    }): Promise<{ count: number }>;
  };
};

type Issue = { code: string; message: string };

export type HistoricalSalesPreviewRow = {
  rowNumber: number;
  sku: string | null;
  barcode: string | null;
  productName: string | null;
  matchedProduct: { id: string; sku: string; barcode: string | null; name: string } | null;
  period: string | null;
  quantitySold: number | null;
  unitPrice: string | null;
  salesAmount: string | null;
  status: RowStatus;
  errors: Issue[];
  warnings: Issue[];
  importedOverlap: boolean;
  posActualOverlap: boolean;
  rawData: Record<string, string>;
};

const SUPPORTED_EXTENSIONS = new Set([".csv", ".xlsx"]);
const SUPPORTED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream"
]);
const MAX_ROWS = 10_000;
const AMOUNT_ROUNDING_TOLERANCE = new Prisma.Decimal("0.01");
const AMOUNT_WARNING_PERCENT = new Prisma.Decimal("0.01");

export function isHistoricalSalesPreviewExpired(createdAt: Date, now = new Date()) {
  return now.getTime() - createdAt.getTime() >= HISTORICAL_SALES_PREVIEW_EXPIRATION_MS;
}

export function assertHistoricalSalesPreviewConfirmable<TBatch extends ConfirmablePreview>(
  batch: TBatch | null,
  actorId: string,
  now = new Date()
): asserts batch is TBatch {
  if (!batch || batch.importedByUserId !== actorId) {
    throw new HttpError(409, "The historical sales preview is unavailable or stale.", {
      code: "STALE_HISTORICAL_SALES_PREVIEW"
    });
  }

  if (
    isHistoricalSalesPreviewExpired(batch.createdAt, now) ||
    (batch.status === "FAILED" && batch.errorMessage === HISTORICAL_SALES_PREVIEW_EXPIRED_MESSAGE)
  ) {
    throw new HttpError(409, HISTORICAL_SALES_PREVIEW_EXPIRED_MESSAGE, {
      code: "EXPIRED_HISTORICAL_SALES_PREVIEW"
    });
  }

  if (batch.status !== "PREVIEWED") {
    throw new HttpError(409, "The historical sales preview is unavailable or stale.", {
      code: "STALE_HISTORICAL_SALES_PREVIEW"
    });
  }
}

export async function expireAbandonedHistoricalSalesPreviews(
  now = new Date(),
  client: PreviewExpirationClient = prisma as unknown as PreviewExpirationClient
) {
  const expiresBefore = new Date(now.getTime() - HISTORICAL_SALES_PREVIEW_EXPIRATION_MS);

  return await client.historicalSalesImportBatch.updateMany({
    data: {
      errorMessage: HISTORICAL_SALES_PREVIEW_EXPIRED_MESSAGE,
      failedAt: now,
      status: "FAILED"
    },
    where: {
      createdAt: { lte: expiresBefore },
      status: "PREVIEWED"
    }
  });
}

const aliasEntries: Array<[string, string]> = [
  ["sku", "sku"],
  ["productsku", "sku"],
  ["barcode", "barcode"],
  ["productname", "productName"],
  ["name", "productName"],
  ["period", "period"],
  ["month", "period"],
  ["salesmonth", "period"],
  ["quantitysold", "quantitySold"],
  ["quantity", "quantitySold"],
  ["unitprice", "unitPrice"],
  ["salesamount", "salesAmount"],
  ["amount", "salesAmount"]
];
const aliases = new Map<string, string>(
  aliasEntries.map(([key, value]) => [normalizeHeader(key), value] as [string, string])
);

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function safeCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? value.toLocaleString("en-US", { maximumFractionDigits: 0, useGrouping: false })
      : value.toLocaleString("en-US", { maximumFractionDigits: 20, useGrouping: false });
  }
  return String(value).trim().slice(0, 500);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const char = input.charAt(index);
    const next = input.charAt(index + 1);
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      if (char === "\r" && next === "\n") index += 1;
    } else cell += char;
  }

  if (quoted) {
    throw new HttpError(400, "The CSV contains an unterminated quoted field.", {
      code: "INVALID_HISTORICAL_SALES_CSV"
    });
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

async function readRows(file: UploadFile) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new HttpError(400, "Historical sales files must be CSV or XLSX.", {
      code: "UNSUPPORTED_HISTORICAL_SALES_FILE_TYPE"
    });
  }
  if (file.mimetype && !SUPPORTED_MIME_TYPES.has(file.mimetype)) {
    throw new HttpError(400, "The uploaded file MIME type is not supported.", {
      code: "UNSUPPORTED_HISTORICAL_SALES_MIME"
    });
  }

  let rows: unknown[][];
  try {
    rows =
      extension === ".csv"
        ? parseCsv(file.buffer.toString("utf8"))
        : await readSheet(file.buffer, { trim: false });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "The historical sales spreadsheet could not be read.", {
      code: "INVALID_HISTORICAL_SALES_FILE"
    });
  }

  if (
    rows.length < 2 ||
    rows.slice(1).every((sourceRow) => sourceRow.every((value) => !safeCell(value)))
  ) {
    throw new HttpError(400, "The historical sales file has no data rows.", {
      code: "EMPTY_HISTORICAL_SALES_FILE"
    });
  }
  if (rows.length - 1 > MAX_ROWS) {
    throw new HttpError(400, `Historical sales imports are limited to ${MAX_ROWS} rows.`, {
      code: "HISTORICAL_SALES_ROW_LIMIT"
    });
  }
  return rows;
}

function mapHeaders(sourceHeaders: unknown[]) {
  const map = new Map<string, number>();
  const duplicates: string[] = [];
  sourceHeaders.forEach((value, index) => {
    const original = safeCell(value);
    const canonical = aliases.get(normalizeHeader(original));
    if (!canonical) return;
    if (map.has(canonical)) duplicates.push(original);
    else map.set(canonical, index);
  });
  if (duplicates.length) {
    throw new HttpError(400, `Duplicate historical sales headers: ${duplicates.join(", ")}.`, {
      code: "DUPLICATE_HISTORICAL_SALES_HEADERS"
    });
  }
  const missing = ["period", "quantitySold"].filter((header) => !map.has(header));
  if (!map.has("sku") && !map.has("barcode")) missing.push("sku or barcode");
  if (missing.length) {
    throw new HttpError(400, `Missing required historical sales headers: ${missing.join(", ")}.`, {
      code: "MISSING_HISTORICAL_SALES_HEADERS",
      details: { missing }
    });
  }
  return map;
}

export function normalizeHistoricalSalesPeriod(value: string) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:T.*)?$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 1;
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day !== 1) return null;
  return {
    date: new Date(Date.UTC(year, month - 1, 1)),
    key: `${year}-${String(month).padStart(2, "0")}`
  };
}

function parseMoney(value: string, field: string, errors: Issue[]) {
  if (!value) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    errors.push({
      code: `INVALID_${field.toUpperCase()}`,
      message: `${field} must be a non-negative amount with up to two decimals.`
    });
    return null;
  }
  return new Prisma.Decimal(value);
}

function firstErrorStatus(errors: Issue[]): RowStatus {
  if (errors.some((issue) => issue.code === "UNMATCHED_PRODUCT")) return "UNMATCHED";
  if (errors.some((issue) => issue.code.includes("DUPLICATE"))) return "DUPLICATE";
  return "INVALID";
}

function summarize(rows: HistoricalSalesPreviewRow[]) {
  const validStatuses = new Set<RowStatus>(["VALID", "WARNING", "OVERLAP"]);
  const matched = rows.filter((row) => row.matchedProduct).length;
  return {
    duplicateRows: rows.filter((row) => row.status === "DUPLICATE").length,
    invalidRows: rows.filter((row) => !validStatuses.has(row.status)).length,
    matchedRows: matched,
    overlapRows: rows.filter((row) => row.importedOverlap || row.posActualOverlap).length,
    posOverlapRows: rows.filter((row) => row.posActualOverlap).length,
    productsAffected: new Set(
      rows.flatMap((row) => (row.matchedProduct ? [row.matchedProduct.id] : []))
    ).size,
    totalRows: rows.length,
    unmatchedRows: rows.filter((row) => row.status === "UNMATCHED").length,
    validRows: rows.filter((row) => validStatuses.has(row.status)).length
  };
}

async function buildPreview(file: UploadFile) {
  const sourceRows = await readRows(file);
  const headerMap = mapHeaders(sourceRows[0] ?? []);
  const read = (row: unknown[], field: string) => {
    const index = headerMap.get(field);
    return index === undefined ? "" : safeCell(row[index]);
  };
  const baseRows = sourceRows.slice(1).flatMap((sourceRow, index) => {
    if (sourceRow.every((value) => !safeCell(value))) return [];
    const rawData = Object.fromEntries(
      HISTORICAL_SALES_TEMPLATE_HEADERS.map((header) => [header, read(sourceRow, header)])
    );
    return [{ rowNumber: index + 2, sourceRow, rawData }];
  });
  const skuValues = [
    ...new Set(
      baseRows.map(({ sourceRow }) => normalizeCode(read(sourceRow, "sku"))).filter(Boolean)
    )
  ];
  const barcodeValues = [
    ...new Set(
      baseRows
        .map(({ sourceRow }) => normalizeWhitespace(read(sourceRow, "barcode")))
        .filter(Boolean)
    )
  ];
  const [products, aliases] = await Promise.all([
    prisma.product.findMany({
      select: {
        barcode: true,
        id: true,
        name: true,
        sku: true,
        sourceMapping: {
          select: {
            canonicalProduct: {
              select: { barcode: true, id: true, name: true, sku: true }
            }
          }
        }
      },
      where: {
        AND: [
          { OR: [{ sku: { in: skuValues } }, { barcode: { in: barcodeValues } }] },
          {
            OR: [operationalProductWhere(), { sourceMapping: { isNot: null } }]
          }
        ]
      }
    }),
    prisma.productAlias.findMany({
      select: {
        normalizedValue: true,
        type: true,
        canonicalProduct: {
          select: { barcode: true, id: true, name: true, sku: true }
        }
      },
      where: {
        canonicalProduct: { is: operationalProductWhere() },
        OR: [
          { type: "SKU", normalizedValue: { in: skuValues } },
          { type: "BARCODE", normalizedValue: { in: barcodeValues } }
        ]
      }
    })
  ]);
  const bySku = new Map(
    products.map((product) => [
      normalizeCode(product.sku),
      product.sourceMapping?.canonicalProduct ?? product
    ])
  );
  const byBarcode = new Map(
    products.flatMap((product) =>
      product.barcode
        ? [[product.barcode, product.sourceMapping?.canonicalProduct ?? product] as const]
        : []
    )
  );
  for (const alias of aliases) {
    if (alias.type === "SKU" && !bySku.has(alias.normalizedValue)) {
      bySku.set(alias.normalizedValue, alias.canonicalProduct);
    }
    if (alias.type === "BARCODE" && !byBarcode.has(alias.normalizedValue)) {
      byBarcode.set(alias.normalizedValue, alias.canonicalProduct);
    }
  }

  const rows: HistoricalSalesPreviewRow[] = baseRows.map(({ rowNumber, sourceRow, rawData }) => {
    const errors: Issue[] = [];
    const warnings: Issue[] = [];
    const sku = normalizeCode(read(sourceRow, "sku")) || null;
    const barcode = normalizeWhitespace(read(sourceRow, "barcode")) || null;
    const productName = normalizeWhitespace(read(sourceRow, "productName")) || null;
    const period = normalizeHistoricalSalesPeriod(read(sourceRow, "period"));
    const quantityRaw = read(sourceRow, "quantitySold");
    const quantitySold = /^-?\d+$/.test(quantityRaw) ? Number(quantityRaw) : null;
    const unitPrice = parseMoney(read(sourceRow, "unitPrice"), "unit price", errors);
    const salesAmount = parseMoney(read(sourceRow, "salesAmount"), "sales amount", errors);
    const skuProduct = sku ? bySku.get(sku) : undefined;
    const barcodeProduct = barcode ? byBarcode.get(barcode) : undefined;
    let matchedProduct = skuProduct ?? barcodeProduct ?? null;

    if (!sku && !barcode)
      errors.push({ code: "MISSING_PRODUCT_IDENTIFIER", message: "SKU or barcode is required." });
    if (skuProduct && barcodeProduct && skuProduct.id !== barcodeProduct.id) {
      matchedProduct = null;
      errors.push({
        code: "SKU_BARCODE_CONFLICT",
        message: "SKU and barcode match different catalog products."
      });
    } else if (!matchedProduct) {
      errors.push({
        code: "UNMATCHED_PRODUCT",
        message: "Add this product through Products before importing its history."
      });
    }
    if (
      productName &&
      matchedProduct &&
      normalizeWhitespace(productName).toLowerCase() !==
        normalizeWhitespace(matchedProduct.name).toLowerCase()
    ) {
      warnings.push({
        code: "PRODUCT_NAME_MISMATCH",
        message: "The file product name differs from the matched catalog product."
      });
    }
    if (!period)
      errors.push({
        code: "INVALID_PERIOD",
        message: "Period must be YYYY-MM or the first day of a month."
      });
    if (quantitySold === null || !Number.isSafeInteger(quantitySold))
      errors.push({ code: "INVALID_QUANTITY", message: "Quantity sold must be a whole number." });
    else if (quantitySold <= 0)
      errors.push({
        code: quantitySold === 0 ? "ZERO_QUANTITY" : "NEGATIVE_QUANTITY",
        message: "Quantity sold must be greater than zero."
      });
    if ([sku, barcode, productName].some((value) => value && /^[=+@]/.test(value))) {
      errors.push({
        code: "DANGEROUS_CELL_VALUE",
        message: "Formula-like cell values are not allowed."
      });
    }
    if (quantitySold && unitPrice && salesAmount) {
      const expected = unitPrice.mul(quantitySold);
      const difference = expected.sub(salesAmount).abs();
      if (difference.gt(AMOUNT_ROUNDING_TOLERANCE)) {
        const ratio = expected.isZero() ? difference : difference.div(expected);
        const issue = {
          code: "SALES_AMOUNT_MISMATCH",
          message: `Sales amount does not match quantity x unit price (${expected.toFixed(2)} expected).`
        };
        if (ratio.gt(AMOUNT_WARNING_PERCENT)) errors.push(issue);
        else warnings.push(issue);
      }
    }

    return {
      barcode,
      errors,
      importedOverlap: false,
      matchedProduct,
      period: period?.key ?? null,
      posActualOverlap: false,
      productName,
      quantitySold,
      rawData,
      rowNumber,
      salesAmount: salesAmount?.toFixed(2) ?? null,
      sku,
      status: errors.length ? firstErrorStatus(errors) : warnings.length ? "WARNING" : "VALID",
      unitPrice: unitPrice?.toFixed(2) ?? null,
      warnings
    };
  });

  const rowsByProductPeriod = new Map<string, HistoricalSalesPreviewRow[]>();
  for (const row of rows) {
    if (!row.matchedProduct || !row.period || row.errors.length) continue;
    const key = `${row.matchedProduct.id}:${row.period}`;
    const matchingRows = rowsByProductPeriod.get(key) ?? [];
    matchingRows.push(row);
    rowsByProductPeriod.set(key, matchingRows);
  }
  for (const matchingRows of rowsByProductPeriod.values()) {
    if (matchingRows.length < 2) continue;
    for (const row of matchingRows) {
      row.errors.push({
        code: "DUPLICATE_PRODUCT_PERIOD",
        message:
          "This product-month appears more than once in the file; none of its duplicates will be imported."
      });
      row.status = "DUPLICATE";
    }
  }

  const candidateRows = rows.filter(
    (row) => row.matchedProduct && row.period && !row.errors.length
  );
  const productIds = [
    ...new Set(candidateRows.flatMap((row) => (row.matchedProduct ? [row.matchedProduct.id] : [])))
  ];
  const periods = [
    ...new Set(
      candidateRows.flatMap((row) =>
        row.period ? [new Date(`${row.period}-01T00:00:00.000Z`)] : []
      )
    )
  ];
  const imported =
    productIds.length && periods.length
      ? await prisma.historicalMonthlySales.findMany({
          select: { period: true, productId: true },
          where: {
            isActive: true,
            productId: { in: productIds },
            period: { in: periods },
            source: "IMPORTED_HISTORICAL"
          }
        })
      : [];
  const actualItems =
    productIds.length && periods.length
      ? await prisma.saleItem.findMany({
          select: { productId: true, sale: { select: { saleDate: true } } },
          where: {
            productId: { in: productIds },
            sale: {
              saleDate: {
                gte: new Date(Math.min(...periods.map(Number))),
                lt: new Date(
                  Date.UTC(Math.max(...periods.map((date) => date.getUTCFullYear())) + 1, 0, 1)
                )
              },
              status: "COMPLETED"
            }
          }
        })
      : [];
  const importedKeys = new Set(
    imported.map((record) => `${record.productId}:${record.period.toISOString().slice(0, 7)}`)
  );
  const actualKeys = new Set(
    actualItems.map((item) => `${item.productId}:${item.sale.saleDate.toISOString().slice(0, 7)}`)
  );
  for (const row of candidateRows) {
    const key = `${row.matchedProduct?.id}:${row.period}`;
    row.importedOverlap = importedKeys.has(key);
    row.posActualOverlap = actualKeys.has(key);
    if (row.importedOverlap || row.posActualOverlap) {
      row.status = "OVERLAP";
      row.warnings.push({
        code: row.posActualOverlap ? "POS_ACTUAL_OVERLAP" : "IMPORTED_OVERLAP",
        message: row.posActualOverlap
          ? "Completed POS sales already exist for this month and remain authoritative."
          : "Active imported history already exists for this product-month."
      });
    }
  }

  return { rows, summary: summarize(rows) };
}

function auditData(
  batchId: string,
  row: HistoricalSalesPreviewRow,
  finalStatus?: HistoricalSalesRowStatus
) {
  const primary = row.errors[0] ?? row.warnings[0];
  return {
    errorCode: primary?.code ?? null,
    errorMessage: primary?.message ?? null,
    importBatchId: batchId,
    matchedProductId: row.matchedProduct?.id ?? null,
    normalizedBarcode: row.barcode,
    normalizedPeriod: row.period ? new Date(`${row.period}-01T00:00:00.000Z`) : null,
    normalizedSku: row.sku,
    quantitySold: row.quantitySold && row.quantitySold > 0 ? row.quantitySold : null,
    rawData: row.rawData,
    rowNumber: row.rowNumber,
    salesAmount: row.salesAmount,
    status: (finalStatus ?? row.status) as HistoricalSalesRowStatus,
    unitPrice: row.unitPrice,
    warningCodes: row.warnings.map((warning) => warning.code)
  };
}

function fileMetadata(file: UploadFile) {
  return {
    fileHash: hashHistoricalSalesFile(file.buffer),
    fileSize: file.buffer.byteLength,
    fileType: path.extname(file.originalname).slice(1).toLowerCase()
  };
}

export function hashHistoricalSalesFile(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function batchCode() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return `HSI-${stamp}-${randomUUID().slice(0, 6).toUpperCase()}`;
}

async function assertNoCompletedDuplicate(fileHash: string, excludeId?: string) {
  const duplicate = await prisma.historicalSalesImportBatch.findFirst({
    orderBy: { completedAt: "desc" },
    select: { batchCode: true, completedAt: true, id: true },
    where: {
      fileHash,
      id: excludeId ? { not: excludeId } : undefined,
      monthlySales: { some: { isActive: true } },
      status: { in: [...ACTIVE_HISTORICAL_SALES_DUPLICATE_STATUSES] }
    }
  });
  if (duplicate) {
    throw new HttpError(409, `This exact file is already active in batch ${duplicate.batchCode}.`, {
      code: "DUPLICATE_HISTORICAL_SALES_FILE",
      details: duplicate
    });
  }
}

export function getHistoricalSalesTemplateCsv() {
  return `${HISTORICAL_SALES_TEMPLATE_HEADERS.join(",")}\nSKU-001,0001234567890,Sample product,2024-01,25,10.00,250.00`;
}

export async function previewHistoricalSalesImport(file: UploadFile, actorId: string) {
  await expireAbandonedHistoricalSalesPreviews();
  const metadata = fileMetadata(file);
  await assertNoCompletedDuplicate(metadata.fileHash);
  const preview = await buildPreview(file);
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.historicalSalesImportBatch.create({
      data: {
        ...metadata,
        ...preview.summary,
        batchCode: batchCode(),
        importedByUserId: actorId,
        originalFileName: file.originalname.slice(0, 255),
        metadata: { sarimaMinimumObservations: SARIMA_MINIMUM_OBSERVATIONS }
      }
    });
    await tx.historicalSalesImportRow.createMany({
      data: preview.rows.map((row) => auditData(created.id, row))
    });
    return created;
  });
  const affectedIds = [
    ...new Set(preview.rows.flatMap((row) => (row.matchedProduct ? [row.matchedProduct.id] : [])))
  ];
  const effectiveSeries = await getEffectiveMonthlySeries(affectedIds);
  const projectedEligibility = effectiveSeries.map((product) => {
    const projected = new Map(product.points.map((point) => [point.period, point]));
    preview.rows
      .filter(
        (row) =>
          row.matchedProduct?.id === product.productId &&
          row.period &&
          row.quantitySold !== null &&
          row.errors.length === 0 &&
          !row.importedOverlap &&
          !row.posActualOverlap
      )
      .forEach((row) => {
        projected.set(row.period!, {
          period: row.period!,
          quantitySold: row.quantitySold!,
          source: "IMPORTED_HISTORICAL"
        });
      });
    return assessSarimaEligibility(
      product.productId,
      product.productName,
      [...projected.values()].sort((left, right) => left.period.localeCompare(right.period))
    );
  });
  return {
    ...metadata,
    ...preview.summary,
    batchCode: batch.batchCode,
    previewBatchId: batch.id,
    fileName: file.originalname,
    rows: preview.rows,
    sarimaEligibleProducts: projectedEligibility.filter((item) => item.status === "ELIGIBLE")
      .length,
    productsBelowThreshold: projectedEligibility.filter((item) => item.status !== "ELIGIBLE").length
  };
}

export async function confirmHistoricalSalesImport(
  file: UploadFile,
  previewBatchId: string,
  importMode: HistoricalSalesImportMode,
  actorId: string
) {
  if (!HISTORICAL_SALES_IMPORT_MODES.includes(importMode)) {
    throw new HttpError(400, "Historical sales import mode is invalid.", {
      code: "INVALID_HISTORICAL_SALES_IMPORT_MODE"
    });
  }
  await expireAbandonedHistoricalSalesPreviews();
  const metadata = fileMetadata(file);
  const batch = await prisma.historicalSalesImportBatch.findUnique({
    where: { id: previewBatchId }
  });
  assertHistoricalSalesPreviewConfirmable(batch, actorId);
  if (batch.fileHash !== metadata.fileHash) {
    throw new HttpError(409, "The confirmation file does not match the previewed file.", {
      code: "HISTORICAL_SALES_FILE_HASH_MISMATCH"
    });
  }
  await assertNoCompletedDuplicate(metadata.fileHash, batch.id);
  const preview = await buildPreview(file);
  const overlaps = preview.rows.filter((row) => row.importedOverlap || row.posActualOverlap);
  if (importMode === "REJECT_ON_OVERLAP" && overlaps.length) {
    throw new HttpError(
      409,
      "REJECT_ON_OVERLAP blocked confirmation because overlapping months were found.",
      {
        code: "HISTORICAL_SALES_OVERLAP_REJECTED",
        details: { overlapRows: overlaps.length }
      }
    );
  }

  try {
    return await runHistoricalSalesMutationWithForecastInvalidation(
      () =>
        prisma.$transaction(
          async (tx) => {
            const current = await tx.historicalSalesImportBatch.findUnique({
              where: { id: batch.id }
            });
            assertHistoricalSalesPreviewConfirmable(current, actorId);
            await tx.historicalSalesImportBatch.update({
              data: { importMode, status: "PROCESSING", confirmedAt: new Date() },
              where: { id: batch.id }
            });
            const finalRows: Array<{
              row: HistoricalSalesPreviewRow;
              status: "IMPORTED" | "SKIPPED" | "REPLACED";
            }> = [];
            let replacedRows = 0;
            const affected = new Set<string>();
            const candidates = preview.rows.filter(
              (row) => row.matchedProduct && row.period && row.errors.length === 0
            );
            const candidateProductIds = [
              ...new Set(
                candidates.flatMap((row) => (row.matchedProduct ? [row.matchedProduct.id] : []))
              )
            ];
            const candidatePeriods = candidates.flatMap((row) =>
              row.period ? [new Date(`${row.period}-01T00:00:00.000Z`)] : []
            );
            const minimumPeriod = candidatePeriods.length
              ? new Date(Math.min(...candidatePeriods.map(Number)))
              : new Date(0);
            const maximumPeriod = candidatePeriods.length
              ? new Date(Math.max(...candidatePeriods.map(Number)))
              : new Date(0);
            const afterMaximumPeriod = new Date(
              Date.UTC(maximumPeriod.getUTCFullYear(), maximumPeriod.getUTCMonth() + 1, 1)
            );
            const [liveImported, liveActual] = candidateProductIds.length
              ? await Promise.all([
                  tx.historicalMonthlySales.findMany({
                    where: {
                      isActive: true,
                      period: { in: candidatePeriods },
                      productId: { in: candidateProductIds },
                      source: "IMPORTED_HISTORICAL"
                    }
                  }),
                  tx.saleItem.findMany({
                    select: { productId: true, sale: { select: { saleDate: true } } },
                    where: {
                      productId: { in: candidateProductIds },
                      sale: {
                        saleDate: { gte: minimumPeriod, lt: afterMaximumPeriod },
                        status: "COMPLETED"
                      }
                    }
                  })
                ])
              : [[], []];
            const liveImportedByKey = new Map(
              liveImported.map((record) => [
                `${record.productId}:${record.period.toISOString().slice(0, 7)}`,
                record
              ])
            );
            const liveActualKeys = new Set(
              liveActual.map(
                (item) => `${item.productId}:${item.sale.saleDate.toISOString().slice(0, 7)}`
              )
            );

            if (
              importMode === "REJECT_ON_OVERLAP" &&
              candidates.some((row) => {
                const key = `${row.matchedProduct?.id}:${row.period}`;
                return liveImportedByKey.has(key) || liveActualKeys.has(key);
              })
            ) {
              throw new HttpError(
                409,
                "Database state changed after preview and now contains overlapping sales months.",
                { code: "STALE_HISTORICAL_SALES_OVERLAP" }
              );
            }

            for (const row of preview.rows) {
              const rowKey = `${row.matchedProduct?.id}:${row.period}`;
              const hasPosActual = liveActualKeys.has(rowKey);
              const existing = liveImportedByKey.get(rowKey);
              if (
                !row.matchedProduct ||
                !row.period ||
                row.errors.length ||
                hasPosActual ||
                (existing && importMode === "APPEND_ONLY")
              ) {
                finalRows.push({ row, status: "SKIPPED" });
                continue;
              }
              const period = new Date(`${row.period}-01T00:00:00.000Z`);
              const activeKey = `${row.matchedProduct.id}:${row.period}:IMPORTED_HISTORICAL`;
              if (existing && importMode !== "REPLACE_IMPORTED_OVERLAPS") {
                finalRows.push({ row, status: "SKIPPED" });
                continue;
              }
              if (existing) {
                await tx.historicalMonthlySales.update({
                  data: {
                    activeKey: null,
                    invalidatedAt: new Date(),
                    invalidatedByUserId: actorId,
                    invalidationReason: `Replaced by historical sales import ${batch.batchCode}.`,
                    isActive: false
                  },
                  where: { id: existing.id }
                });
                replacedRows += 1;
              }
              await tx.historicalMonthlySales.create({
                data: {
                  activeKey,
                  importBatchId: batch.id,
                  period,
                  productId: row.matchedProduct.id,
                  quantitySold: row.quantitySold!,
                  replacesRecordId: existing?.id ?? null,
                  salesAmount: row.salesAmount,
                  source: "IMPORTED_HISTORICAL",
                  unitPrice: row.unitPrice
                }
              });
              affected.add(row.matchedProduct.id);
              finalRows.push({ row, status: existing ? "REPLACED" : "IMPORTED" });
            }

            await tx.historicalSalesImportRow.deleteMany({ where: { importBatchId: batch.id } });
            await tx.historicalSalesImportRow.createMany({
              data: finalRows.map(({ row, status }) => auditData(batch.id, row, status))
            });
            const importedRows = finalRows.filter(({ status }) => status !== "SKIPPED").length;
            const skippedRows = finalRows.length - importedRows;
            const completed = await tx.historicalSalesImportBatch.update({
              data: {
                ...preview.summary,
                completedAt: new Date(),
                forecastRefreshStatus: affected.size ? "PENDING" : "NOT_REQUIRED",
                importedRows,
                metadata: {
                  affectedProductIds: [...affected],
                  sarimaMinimumObservations: SARIMA_MINIMUM_OBSERVATIONS
                },
                productsAffected: affected.size,
                replacedRows,
                skippedRows,
                status: skippedRows ? "COMPLETED_WITH_SKIPS" : "COMPLETED"
              },
              where: { id: batch.id }
            });
            return completed;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        ),
      (completed) => invalidateForecastCache(affectedProductIdsFromMetadata(completed.metadata))
    );
  } catch (error) {
    await prisma.historicalSalesImportBatch.updateMany({
      data: {
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Historical sales confirmation failed.",
        failedAt: new Date(),
        status: "FAILED"
      },
      where: { id: batch.id, status: "PREVIEWED" }
    });
    throw error;
  }
}

export async function listHistoricalSalesBatches(page: number, pageSize: number) {
  await expireAbandonedHistoricalSalesPreviews();
  const [items, totalItems] = await prisma.$transaction([
    prisma.historicalSalesImportBatch.findMany({
      include: {
        importedBy: { select: { id: true, name: true } },
        rolledBackBy: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.historicalSalesImportBatch.count()
  ]);
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
  };
}

export async function getHistoricalSalesBatch(batchId: string) {
  const batch = await prisma.historicalSalesImportBatch.findUnique({
    include: {
      importedBy: { select: { id: true, name: true } },
      rolledBackBy: { select: { id: true, name: true } },
      monthlySales: {
        include: { product: { select: { id: true, name: true, sku: true } } },
        orderBy: [{ period: "asc" }, { productId: "asc" }]
      }
    },
    where: { id: batchId }
  });
  if (!batch)
    throw new HttpError(404, "Historical sales import batch was not found.", {
      code: "HISTORICAL_SALES_BATCH_NOT_FOUND"
    });
  return batch;
}

export async function listHistoricalSalesBatchRows(
  batchId: string,
  page: number,
  pageSize: number,
  status?: string
) {
  const where = { importBatchId: batchId, status: status ? (status as never) : undefined };
  const [items, totalItems] = await prisma.$transaction([
    prisma.historicalSalesImportRow.findMany({
      include: { matchedProduct: { select: { id: true, name: true, sku: true } } },
      orderBy: { rowNumber: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      where
    }),
    prisma.historicalSalesImportRow.count({ where })
  ]);
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
  };
}

export async function previewHistoricalSalesRollback(batchId: string) {
  const batch = await getHistoricalSalesBatch(batchId);
  if (!["COMPLETED", "COMPLETED_WITH_SKIPS"].includes(batch.status)) {
    throw new HttpError(409, "Only a completed historical sales batch can be rolled back.", {
      code: "HISTORICAL_SALES_ROLLBACK_NOT_ALLOWED"
    });
  }
  const activeRecords = batch.monthlySales.filter((record) => record.isActive);
  if (!activeRecords.length) {
    throw new HttpError(
      409,
      "This batch has no active records to roll back; it may have been superseded.",
      { code: "HISTORICAL_SALES_ROLLBACK_SUPERSEDED" }
    );
  }
  const productIds = [...new Set(activeRecords.map((record) => record.productId))];
  const periods = new Set(
    activeRecords.map((record) => `${record.productId}:${record.period.toISOString().slice(0, 7)}`)
  );
  const actual = await prisma.saleItem.findMany({
    select: { productId: true, sale: { select: { saleDate: true } } },
    where: { productId: { in: productIds }, sale: { status: "COMPLETED" } }
  });
  const actualCoveredPeriods = new Set(
    actual.map((item) => `${item.productId}:${item.sale.saleDate.toISOString().slice(0, 7)}`)
  );
  return {
    batchId,
    batchCode: batch.batchCode,
    forecastsAffected: productIds.length,
    periodsAffected: periods.size,
    posCoveredPeriods: [...periods].filter((key) => actualCoveredPeriods.has(key)).length,
    productsAffected: productIds.length,
    recordsToInvalidate: activeRecords.length,
    recordsToRestore: activeRecords.filter((record) => record.replacesRecordId).length
  };
}

export async function rollbackHistoricalSalesBatch(
  batchId: string,
  actorId: string,
  reason: string
) {
  const normalizedReason = normalizeWhitespace(reason);
  if (normalizedReason.length < 5 || normalizedReason.length > 500) {
    throw new HttpError(400, "A rollback reason between 5 and 500 characters is required.", {
      code: "HISTORICAL_SALES_ROLLBACK_REASON_REQUIRED"
    });
  }
  await previewHistoricalSalesRollback(batchId);
  return await runHistoricalSalesMutationWithForecastInvalidation(
    () =>
      prisma.$transaction(
        async (tx) => {
          const batch = await tx.historicalSalesImportBatch.findUnique({ where: { id: batchId } });
          if (!batch || !["COMPLETED", "COMPLETED_WITH_SKIPS"].includes(batch.status)) {
            throw new HttpError(409, "The batch is no longer eligible for rollback.", {
              code: "HISTORICAL_SALES_ROLLBACK_STALE"
            });
          }
          const records = await tx.historicalMonthlySales.findMany({
            where: { importBatchId: batchId, isActive: true }
          });
          if (!records.length)
            throw new HttpError(409, "The batch has already been superseded.", {
              code: "HISTORICAL_SALES_ROLLBACK_SUPERSEDED"
            });
          const affected = new Set(records.map((record) => record.productId));
          for (const record of records) {
            await tx.historicalMonthlySales.update({
              data: {
                activeKey: null,
                invalidatedAt: new Date(),
                invalidatedByUserId: actorId,
                invalidationReason: `Batch rollback: ${normalizedReason}`,
                isActive: false
              },
              where: { id: record.id }
            });
            if (record.replacesRecordId) {
              const previous = await tx.historicalMonthlySales.findUnique({
                include: { importBatch: { select: { status: true } } },
                where: { id: record.replacesRecordId }
              });
              if (previous && previous.importBatch?.status !== "ROLLED_BACK") {
                const key = `${previous.productId}:${previous.period.toISOString().slice(0, 7)}:IMPORTED_HISTORICAL`;
                await tx.historicalMonthlySales.update({
                  data: {
                    activeKey: key,
                    invalidatedAt: null,
                    invalidatedByUserId: null,
                    invalidationReason: null,
                    isActive: true
                  },
                  where: { id: previous.id }
                });
              }
            }
          }
          return await tx.historicalSalesImportBatch.update({
            data: {
              forecastRefreshStatus: "PENDING",
              metadata: {
                affectedProductIds: [...affected],
                rollbackRestoredPreviousVersions: true
              },
              rollbackReason: normalizedReason,
              rolledBackAt: new Date(),
              rolledBackByUserId: actorId,
              status: "ROLLED_BACK"
            },
            where: { id: batchId }
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      ),
    (completed) => invalidateForecastCache(affectedProductIdsFromMetadata(completed.metadata))
  );
}

export async function getHistoricalSalesEligibilitySummary(page: number, pageSize: number) {
  const series = await getEffectiveMonthlySeries();
  const start = (page - 1) * pageSize;
  const counts = Object.fromEntries(
    ["ELIGIBLE", "LIMITED_HISTORY", "INSUFFICIENT_HISTORY", "DATA_QUALITY_ISSUE"].map((status) => [
      status,
      series.filter((item) => item.eligibility.status === status).length
    ])
  );
  return {
    counts,
    items: series.slice(start, start + pageSize).map((item) => item.eligibility),
    page,
    pageSize,
    totalItems: series.length,
    totalPages: Math.max(1, Math.ceil(series.length / pageSize))
  };
}
