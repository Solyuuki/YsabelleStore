import path from "node:path";

import { type Prisma } from "@prisma/client";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeCode, normalizeWhitespace } from "../utils/normalizers.js";
import type { InventoryImportError, InventoryImportPreview } from "./inventoryImportService.js";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ROW_TOLERANCE = 3;
const NO_EXPIRY_VALUES = new Set([
  "NA",
  "N/A",
  "NONE",
  "NO EXPIRY",
  "NO EXPIRATION",
  "NON EXPIRING"
]);

type UploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type CanonicalColumn =
  | "productName"
  | "sku"
  | "barcode"
  | "quantity"
  | "batchCode"
  | "expirationDate";

export type PdfDeliveryTextItem = {
  page: number;
  text: string;
  x: number;
  y: number;
};

export type ParsedPdfDeliveryRow = {
  productName: string;
  sku: string;
  barcode: string;
  quantity: string;
  batchCode: string;
  expirationDate: string;
};

type HeaderCell = {
  column: CanonicalColumn;
  x: number;
};

const HEADER_ALIASES = new Map<string, CanonicalColumn>([
  ["product", "productName"],
  ["productname", "productName"],
  ["item", "productName"],
  ["itemname", "productName"],
  ["sku", "sku"],
  ["productcode", "sku"],
  ["itemcode", "sku"],
  ["barcode", "barcode"],
  ["ean", "barcode"],
  ["upc", "barcode"],
  ["qty", "quantity"],
  ["quantity", "quantity"],
  ["received", "quantity"],
  ["receivedqty", "quantity"],
  ["batch", "batchCode"],
  ["batchcode", "batchCode"],
  ["lot", "batchCode"],
  ["batchlot", "batchCode"],
  ["batchlotcode", "batchCode"],
  ["expiry", "expirationDate"],
  ["expirydate", "expirationDate"],
  ["expiration", "expirationDate"],
  ["expirationdate", "expirationDate"],
  ["bestbefore", "expirationDate"]
]);

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function canonicalHeader(value: string) {
  return HEADER_ALIASES.get(normalizeHeader(value)) ?? null;
}

function groupPageRows(items: PdfDeliveryTextItem[]) {
  const sorted = [...items].sort((left, right) => right.y - left.y || left.x - right.x);
  const rows: PdfDeliveryTextItem[][] = [];

  for (const item of sorted) {
    const last = rows.at(-1);
    if (last && Math.abs((last[0]?.y ?? item.y) - item.y) <= ROW_TOLERANCE) {
      last.push(item);
      last.sort((left, right) => left.x - right.x);
    } else {
      rows.push([item]);
    }
  }

  return rows;
}

function detectHeader(row: PdfDeliveryTextItem[]) {
  const cells: HeaderCell[] = [];
  const seen = new Set<CanonicalColumn>();

  for (const item of row) {
    const column = canonicalHeader(item.text);
    if (!column || seen.has(column)) continue;
    seen.add(column);
    cells.push({ column, x: item.x });
  }

  const hasIdentifier = seen.has("sku") || seen.has("barcode") || seen.has("productName");
  if (!hasIdentifier || !seen.has("quantity") || cells.length < 4) return null;

  return cells.sort((left, right) => left.x - right.x);
}

function assignRowCells(row: PdfDeliveryTextItem[], headers: HeaderCell[]) {
  const cells = new Map<CanonicalColumn, string[]>();

  for (const item of row) {
    let nearest = headers[0];
    let distance = Number.POSITIVE_INFINITY;
    for (const header of headers) {
      const candidate = Math.abs(item.x - header.x);
      if (candidate < distance) {
        nearest = header;
        distance = candidate;
      }
    }
    if (!nearest) continue;
    const list = cells.get(nearest.column) ?? [];
    list.push(item.text.trim());
    cells.set(nearest.column, list);
  }

  const read = (column: CanonicalColumn) =>
    normalizeWhitespace((cells.get(column) ?? []).join(" "));
  const populatedColumns = [...cells.values()].filter(
    (values) => values.join("").trim().length > 0
  ).length;

  return {
    populatedColumns,
    row: {
      productName: read("productName"),
      sku: read("sku"),
      barcode: read("barcode"),
      quantity: read("quantity"),
      batchCode: read("batchCode"),
      expirationDate: read("expirationDate")
    } satisfies ParsedPdfDeliveryRow
  };
}

export function extractDeliveryRowsFromTextItems(items: PdfDeliveryTextItem[]) {
  const byPage = new Map<number, PdfDeliveryTextItem[]>();
  for (const item of items) {
    const pageItems = byPage.get(item.page) ?? [];
    pageItems.push(item);
    byPage.set(item.page, pageItems);
  }

  const result: ParsedPdfDeliveryRow[] = [];
  for (const pageNumber of [...byPage.keys()].sort((a, b) => a - b)) {
    const rows = groupPageRows(byPage.get(pageNumber) ?? []);
    const headerIndex = rows.findIndex((row) => detectHeader(row) !== null);
    if (headerIndex < 0) continue;
    const headers = detectHeader(rows[headerIndex] ?? []);
    if (!headers) continue;

    for (const row of rows.slice(headerIndex + 1)) {
      if (detectHeader(row)) continue;
      const assigned = assignRowCells(row, headers);
      if (assigned.populatedColumns < 2) continue;
      const value = assigned.row;
      if (!value.productName && !value.sku && !value.barcode && !value.quantity) continue;
      result.push(value);
    }
  }

  return result;
}

async function extractPdfText(file: UploadFile) {
  const loadingTask = getDocument({
    data: new Uint8Array(file.buffer),
    useSystemFonts: true
  });
  const document = await loadingTask.promise;
  const items: PdfDeliveryTextItem[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const transform = item.transform;
        items.push({
          page: pageNumber,
          text: item.str,
          x: Number(transform[4] ?? 0),
          y: Number(transform[5] ?? 0)
        });
      }
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return items;
}

function issue(
  rowNumber: number,
  field: string,
  code: string,
  message: string,
  value?: string | null,
  productId?: string,
  productName?: string
): InventoryImportError {
  return { rowNumber, field, code, message, value, productId, productName };
}

function parseQuantity(value: string, rowNumber: number, errors: InventoryImportError[]) {
  const normalized = normalizeWhitespace(value);
  if (!/^\d+$/.test(normalized) || Number.parseInt(normalized, 10) < 1) {
    errors.push(
      issue(
        rowNumber,
        "quantity",
        "INVALID_QUANTITY",
        "PDF quantity must be a positive whole number.",
        value
      )
    );
    return null;
  }
  return Number.parseInt(normalized, 10);
}

function parseExpiration(
  value: string,
  rowNumber: number,
  errors: InventoryImportError[],
  warnings: InventoryImportError[]
) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    warnings.push(
      issue(
        rowNumber,
        "expirationDate",
        "MISSING_EXPIRATION_DATE",
        "Expiry is missing. Enter a date or explicitly mark No expiry before completing the receipt."
      )
    );
    return { expirationDate: null, noExpiration: false };
  }

  if (NO_EXPIRY_VALUES.has(normalized.toUpperCase())) {
    return { expirationDate: null, noExpiration: true };
  }

  const iso = /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(normalized) ? normalized.replaceAll("/", "-") : null;
  if (!iso) {
    errors.push(
      issue(
        rowNumber,
        "expirationDate",
        "INVALID_EXPIRATION_DATE",
        "PDF expiry must resolve to YYYY-MM-DD, or explicitly state No expiry.",
        value
      )
    );
    return { expirationDate: null, noExpiration: false };
  }

  const parsed = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) {
    errors.push(
      issue(
        rowNumber,
        "expirationDate",
        "INVALID_EXPIRATION_DATE",
        "PDF expiry is not a valid calendar date.",
        value
      )
    );
    return { expirationDate: null, noExpiration: false };
  }

  const today = new Date().toISOString().slice(0, 10);
  if (iso < today) {
    errors.push(
      issue(
        rowNumber,
        "expirationDate",
        "PAST_EXPIRATION_DATE",
        "Expired stock cannot be received as sellable inventory.",
        value
      )
    );
    return { expirationDate: null, noExpiration: false };
  }

  return { expirationDate: iso, noExpiration: false };
}

function validatePdfFile(file: UploadFile) {
  if (path.extname(file.originalname).toLowerCase() !== ".pdf") {
    throw new HttpError(400, "A PDF delivery document is required.", {
      code: "INVALID_DELIVERY_PDF_EXTENSION"
    });
  }
  if (file.buffer.length === 0) {
    throw new HttpError(400, "The uploaded PDF is empty.", { code: "EMPTY_DELIVERY_PDF" });
  }
  if (file.buffer.length > MAX_PDF_BYTES) {
    throw new HttpError(413, "The delivery PDF exceeds the 20 MB limit.", {
      code: "DELIVERY_PDF_TOO_LARGE"
    });
  }
  if (file.mimetype && !["application/pdf", "application/octet-stream"].includes(file.mimetype)) {
    throw new HttpError(400, "Unsupported delivery PDF MIME type.", {
      code: "INVALID_DELIVERY_PDF_MIME"
    });
  }
  if (!file.buffer.subarray(0, 5).toString("ascii").startsWith("%PDF-")) {
    throw new HttpError(400, "The uploaded file is not a valid PDF document.", {
      code: "INVALID_DELIVERY_PDF"
    });
  }
}

export async function previewPdfDeliveryImport(file: UploadFile): Promise<InventoryImportPreview> {
  validatePdfFile(file);

  let textItems: PdfDeliveryTextItem[];
  try {
    textItems = await extractPdfText(file);
  } catch {
    throw new HttpError(422, "The PDF could not be read as a delivery document.", {
      code: "UNREADABLE_DELIVERY_PDF"
    });
  }

  if (textItems.length === 0) {
    throw new HttpError(
      422,
      "No extractable text was found. Scanned or image-only PDFs are not supported by automatic bulk extraction yet.",
      { code: "IMAGE_ONLY_DELIVERY_PDF" }
    );
  }

  const parsedRows = extractDeliveryRowsFromTextItems(textItems);
  if (parsedRows.length === 0) {
    throw new HttpError(
      422,
      "No structured delivery table was found. Include Product/SKU/Barcode, Qty, Batch/Lot, and Expiry columns.",
      { code: "PDF_DELIVERY_TABLE_NOT_FOUND" }
    );
  }

  const skus = new Set(parsedRows.map((row) => normalizeCode(row.sku)).filter(Boolean));
  const barcodes = new Set(parsedRows.map((row) => normalizeCode(row.barcode)).filter(Boolean));
  const names = new Set(
    parsedRows.map((row) => normalizeWhitespace(row.productName)).filter(Boolean)
  );
  const where: Prisma.ProductWhereInput[] = [];
  if (skus.size > 0) where.push({ sku: { in: [...skus] } });
  if (barcodes.size > 0) {
    where.push({ barcode: { in: [...barcodes] } });
    where.push({ barcodes: { some: { barcode: { in: [...barcodes] } } } });
  }
  if (names.size > 0) where.push({ name: { in: [...names] } });

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      barcodes: { select: { barcode: true } }
    },
    where: where.length > 0 ? { OR: where } : { id: "__no_pdf_product_identity__" }
  });

  const bySku = new Map<string, (typeof products)[number]>();
  const byBarcode = new Map<string, (typeof products)[number]>();
  const byName = new Map<string, Array<(typeof products)[number]>>();
  for (const product of products) {
    bySku.set(normalizeCode(product.sku), product);
    if (product.barcode) byBarcode.set(normalizeCode(product.barcode), product);
    for (const registered of product.barcodes) {
      byBarcode.set(normalizeCode(registered.barcode), product);
    }
    const nameKey = normalizeWhitespace(product.name).toLowerCase();
    byName.set(nameKey, [...(byName.get(nameKey) ?? []), product]);
  }

  const rows = parsedRows.map((raw, index) => {
    const rowNumber = index + 1;
    const errors: InventoryImportError[] = [];
    const warnings: InventoryImportError[] = [];
    const sku = normalizeCode(raw.sku);
    const barcode = normalizeCode(raw.barcode);
    const productName = normalizeWhitespace(raw.productName);
    const quantity = parseQuantity(raw.quantity, rowNumber, errors);
    const batchCode = normalizeWhitespace(raw.batchCode);
    if (!batchCode) {
      warnings.push(
        issue(
          rowNumber,
          "batchCode",
          "MISSING_BATCH_CODE",
          "Batch / lot is missing. Enter it before completing the receipt."
        )
      );
    }
    const expiry = parseExpiration(raw.expirationDate, rowNumber, errors, warnings);

    const skuProduct = sku ? (bySku.get(sku) ?? null) : null;
    const barcodeProduct = barcode ? (byBarcode.get(barcode) ?? null) : null;
    let product = skuProduct ?? barcodeProduct;

    if (sku && barcode && (!skuProduct || !barcodeProduct)) {
      if (!skuProduct) {
        errors.push(
          issue(
            rowNumber,
            "sku",
            "PRODUCT_NOT_FOUND",
            "The PDF SKU does not match an existing Product.",
            sku
          )
        );
      }
      if (!barcodeProduct) {
        errors.push(
          issue(
            rowNumber,
            "barcode",
            "PRODUCT_NOT_FOUND",
            "The PDF barcode does not match an existing Product.",
            barcode
          )
        );
      }
      product = null;
    } else if (skuProduct && barcodeProduct && skuProduct.id !== barcodeProduct.id) {
      errors.push(
        issue(
          rowNumber,
          "barcode",
          "SKU_BARCODE_MISMATCH",
          "PDF SKU and barcode resolve to different Products.",
          barcode
        )
      );
      product = null;
    }

    if (!product && !sku && !barcode && productName) {
      const candidates = byName.get(productName.toLowerCase()) ?? [];
      if (candidates.length === 1) product = candidates[0] ?? null;
      else if (candidates.length > 1) {
        errors.push(
          issue(
            rowNumber,
            "productName",
            "AMBIGUOUS_PRODUCT_NAME",
            "The PDF product name matches multiple Products. Add SKU or barcode to the supplier document.",
            productName
          )
        );
      }
    }

    if (
      !product &&
      errors.every((entry) => entry.code !== "PRODUCT_NOT_FOUND") &&
      errors.every((entry) => entry.code !== "AMBIGUOUS_PRODUCT_NAME")
    ) {
      errors.push(
        issue(
          rowNumber,
          sku ? "sku" : barcode ? "barcode" : "productName",
          "PRODUCT_NOT_FOUND",
          "This PDF line does not resolve to an existing Product. Create or correct it in Products first.",
          sku || barcode || productName
        )
      );
    }

    const valid = Boolean(product && quantity !== null && errors.length === 0);
    return {
      rowNumber,
      productId: product?.id ?? null,
      productName: (product?.name ?? productName) || null,
      valid,
      deliveryData:
        product && quantity !== null
          ? {
              sku: sku || null,
              barcode: barcode || null,
              quantity,
              batchCode,
              expirationDate: expiry.expirationDate,
              noExpiration: expiry.noExpiration,
              reason: "Bulk delivery receipt from supplier PDF"
            }
          : null,
      errors,
      warnings
    };
  });

  const errors = rows.flatMap((row) => row.errors);
  const warnings = rows.flatMap((row) => row.warnings);
  const validRows = rows.filter((row) => row.valid).length;

  return {
    fileName: file.originalname,
    fileType: "pdf",
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
    rows,
    errors,
    warnings
  };
}
