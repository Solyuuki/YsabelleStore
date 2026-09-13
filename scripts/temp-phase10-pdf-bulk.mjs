import fs from "node:fs";

function replaceOnce(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Expected contract not found: ${label}`);
  return source.replace(from, to);
}

function replaceRegexOnce(source, pattern, to, label) {
  const matches = source.match(pattern);
  if (!matches) throw new Error(`Expected regex contract not found: ${label}`);
  return source.replace(pattern, to);
}

const pdfService = String.raw`import path from "node:path";

import { type Prisma } from "@prisma/client";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeCode, normalizeWhitespace } from "../utils/normalizers.js";
import type { InventoryImportError, InventoryImportPreview } from "./inventoryImportService.js";

const MAX_PDF_BYTES = 20 * 1024 * 1024;
const ROW_TOLERANCE = 3;
const NO_EXPIRY_VALUES = new Set(["NA", "N/A", "NONE", "NO EXPIRY", "NO EXPIRATION", "NON EXPIRING"]);

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
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
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

  const read = (column: CanonicalColumn) => normalizeWhitespace((cells.get(column) ?? []).join(" "));
  const populatedColumns = [...cells.values()].filter((values) => values.join("").trim().length > 0).length;

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
    isEvalSupported: false,
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
    await document.destroy();
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

  const iso = /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(normalized)
    ? normalized.replaceAll("/", "-")
    : null;
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
  const names = new Set(parsedRows.map((row) => normalizeWhitespace(row.productName)).filter(Boolean));
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
        errors.push(issue(rowNumber, "sku", "PRODUCT_NOT_FOUND", "The PDF SKU does not match an existing Product.", sku));
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

    if (!product && errors.every((entry) => entry.code !== "PRODUCT_NOT_FOUND") && errors.every((entry) => entry.code !== "AMBIGUOUS_PRODUCT_NAME")) {
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
      productName: product?.name ?? productName || null,
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
`;

fs.writeFileSync("backend/src/services/pdfDeliveryImportService.ts", pdfService);

let inventoryImport = fs.readFileSync("backend/src/services/inventoryImportService.ts", "utf8");
inventoryImport = replaceOnce(
  inventoryImport,
  'fileType: "csv" | "xlsx";',
  'fileType: "csv" | "xlsx" | "pdf";',
  "backend preview fileType union"
);
inventoryImport = replaceOnce(
  inventoryImport,
  '    expirationDate: string | null;\n    reason: string;',
  '    expirationDate: string | null;\n    noExpiration?: boolean;\n    reason: string;',
  "backend delivery noExpiration field"
);
inventoryImport = replaceOnce(
  inventoryImport,
  '          expirationDate: row.normalizedData.expirationDate?.toISOString() ?? null,\n          reason: row.normalizedData.reason',
  '          expirationDate: row.normalizedData.expirationDate?.toISOString() ?? null,\n          noExpiration: row.normalizedData.expirationDate === null,\n          reason: row.normalizedData.reason',
  "spreadsheet explicit no-expiry projection"
);
fs.writeFileSync("backend/src/services/inventoryImportService.ts", inventoryImport);

let controller = fs.readFileSync("backend/src/controllers/bulkDeliveryController.ts", "utf8");
controller = replaceOnce(
  controller,
  'import { completeBulkDeliverySession } from "../services/bulkDeliveryService.js";\n',
  'import { completeBulkDeliverySession } from "../services/bulkDeliveryService.js";\nimport { previewPdfDeliveryImport } from "../services/pdfDeliveryImportService.js";\nimport { HttpError } from "../utils/httpError.js";\n',
  "PDF preview controller imports"
);
controller += String.raw`

type RequestWithFile = Parameters<RequestHandler>[0] & {
  file?: Express.Multer.File;
};

export const previewBulkDeliveryPdfController: RequestHandler = async (request, response, next) => {
  try {
    const uploaded = (request as RequestWithFile).file;
    if (!uploaded) {
      throw new HttpError(400, "A PDF delivery document is required.", {
        code: "DELIVERY_PDF_REQUIRED"
      });
    }
    const result = await previewPdfDeliveryImport({
      originalname: uploaded.originalname,
      mimetype: uploaded.mimetype,
      buffer: uploaded.buffer
    });
    response
      .status(200)
      .json(createSuccessResponse("PDF delivery preview generated successfully.", result));
  } catch (error) {
    next(error);
  }
};
`;
fs.writeFileSync("backend/src/controllers/bulkDeliveryController.ts", controller);

let routes = fs.readFileSync("backend/src/routes/inventory.routes.ts", "utf8");
routes = replaceOnce(
  routes,
  'import { completeBulkDeliveryController } from "../controllers/bulkDeliveryController.js";',
  'import {\n  completeBulkDeliveryController,\n  previewBulkDeliveryPdfController\n} from "../controllers/bulkDeliveryController.js";',
  "bulk controller route imports"
);
routes = replaceOnce(
  routes,
  'inventoryRouter.post(\n  "/delivery-sessions/complete",',
  'inventoryRouter.post(\n  "/delivery-sessions/pdf/preview",\n  requireRole("OWNER"),\n  productImportUpload.single("file"),\n  previewBulkDeliveryPdfController\n);\ninventoryRouter.post(\n  "/delivery-sessions/complete",',
  "PDF preview route"
);
fs.writeFileSync("backend/src/routes/inventory.routes.ts", routes);

let bulkApi = fs.readFileSync("frontend/src/services/bulkDeliveryApi.ts", "utf8");
bulkApi = replaceOnce(
  bulkApi,
  'import { apiClient } from "@/services/apiClient";\n',
  'import { apiClient } from "@/services/apiClient";\nimport type { InventoryImportPreview } from "@/services/catalogApi";\n',
  "bulk API preview type import"
);
bulkApi += String.raw`

export async function previewBulkDeliveryPdf(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return apiClient.request<InventoryImportPreview, { code?: string; details?: unknown }>(
    "/api/inventory/delivery-sessions/pdf/preview",
    {
      method: "POST",
      formData
    }
  );
}
`;
fs.writeFileSync("frontend/src/services/bulkDeliveryApi.ts", bulkApi);

let catalogApi = fs.readFileSync("frontend/src/services/catalogApi.ts", "utf8");
catalogApi = replaceOnce(
  catalogApi,
  '  fileType: "csv" | "xlsx";\n  totalRows: number;',
  '  fileType: "csv" | "xlsx" | "pdf";\n  totalRows: number;',
  "frontend preview fileType union"
);
catalogApi = replaceOnce(
  catalogApi,
  '    expirationDate: string | null;\n    reason: string;',
  '    expirationDate: string | null;\n    noExpiration?: boolean;\n    reason: string;',
  "frontend delivery noExpiration field"
);
fs.writeFileSync("frontend/src/services/catalogApi.ts", catalogApi);

let dialog = fs.readFileSync("frontend/src/components/inventory/InventoryImportDialog.tsx", "utf8");
dialog = dialog.replace("  PackageSearch,\n", "").replace("  Search,\n", "");
dialog = replaceRegexOnce(
  dialog,
  /import \{\n  fetchProducts,\n  lookupInventoryByBarcode,\n  previewInventoryStockImport,\n  type InventoryImportPreview\n\} from "@\/services\/catalogApi";/,
  'import { previewInventoryStockImport, type InventoryImportPreview } from "@/services/catalogApi";',
  "dialog catalog imports"
);
dialog = replaceOnce(
  dialog,
  'import {\n  completeBulkDeliverySession,\n  type BulkDeliverySessionResult\n} from "@/services/bulkDeliveryApi";',
  'import {\n  completeBulkDeliverySession,\n  previewBulkDeliveryPdf,\n  type BulkDeliverySessionResult\n} from "@/services/bulkDeliveryApi";',
  "dialog bulk PDF API import"
);
dialog = replaceRegexOnce(
  dialog,
  /function optionFromProduct\([\s\S]*?\n\}\n\nfunction acceptedForRow/,
  "function acceptedForRow",
  "manual product option mapper"
);
dialog = replaceOnce(
  dialog,
  '        noExpiration: row.deliveryData.expirationDate === null,',
  '        noExpiration:\n          row.deliveryData.noExpiration ?? row.deliveryData.expirationDate === null,',
  "standalone no-expiry projection"
);
dialog = replaceOnce(
  dialog,
  '      noExpiration: source.deliveryData.expirationDate === null,',
  '      noExpiration:\n        source.deliveryData.noExpiration ?? source.deliveryData.expirationDate === null,',
  "restock merge no-expiry projection"
);
dialog = replaceOnce(
  dialog,
  '  const [file, setFile] = useState<File | null>(null);\n  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);',
  '  const [file, setFile] = useState<File | null>(null);\n  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);\n  const [showPdfPreview, setShowPdfPreview] = useState(false);\n  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);',
  "PDF inline preview states"
);
dialog = replaceRegexOnce(
  dialog,
  /  const \[productSearch, setProductSearch\][\s\S]*?  const \[productError, setProductError\] = useState<string \| null>\(null\);\n/,
  "",
  "manual PDF search states"
);
dialog = replaceOnce(
  dialog,
  '  const hasSpreadsheetPreview = mode === "SPREADSHEET" && phase === "preview-ready" && preview;',
  '  const hasImportPreview = phase === "preview-ready" && preview;',
  "generic import preview state"
);
dialog = replaceOnce(
  dialog,
  '  useEffect(() => {\n    if (!open) return;\n    resetAll();\n  }, [open]);\n',
  '  useEffect(() => {\n    if (!open) return;\n    resetAll();\n  }, [open]);\n\n  useEffect(() => {\n    if (mode !== "PDF" || !file) {\n      setPdfPreviewUrl(null);\n      setShowPdfPreview(false);\n      return;\n    }\n    const objectUrl = URL.createObjectURL(file);\n    setPdfPreviewUrl(objectUrl);\n    return () => URL.revokeObjectURL(objectUrl);\n  }, [file, mode]);\n',
  "inline PDF object URL lifecycle"
);
for (const line of [
  '    setProductSearch("");\n',
  '    setProductResults([]);\n',
  '    setProductError(null);\n'
]) {
  dialog = dialog.replaceAll(line, "");
}
dialog = dialog.replaceAll('    setSearchingProducts(false);\n', "");
dialog = replaceOnce(
  dialog,
  '    setPhase(validationError ? "error" : "file-ready");\n    setUnmatchedRows(0);\n    setPage(1);\n    if (mode === "SPREADSHEET") {\n      setRows(selectedOrder ? makeRestockRows(selectedOrder) : []);\n    }',
  '    setPhase(validationError ? "error" : "file-ready");\n    setShowPdfPreview(false);\n    setUnmatchedRows(0);\n    setPage(1);\n    if (mode === "SPREADSHEET") {\n      setRows(selectedOrder ? makeRestockRows(selectedOrder) : []);\n    } else if (!validationError) {\n      setRows(selectedOrder ? makeRestockRows(selectedOrder) : []);\n      void previewPdfDelivery(nextFile);\n    }',
  "PDF auto-preview on upload"
);
dialog = replaceOnce(
  dialog,
  '  async function searchRestockTickets() {',
  String.raw`  async function previewPdfDelivery(sourceFile: File) {
    const sessionId = ++requestRef.current;
    setPhase("previewing");
    setError(null);
    try {
      const response = await waitForMinimumDuration(
        previewBulkDeliveryPdf(sourceFile),
        PREVIEW_MINIMUM_MS
      );
      if (sessionId !== requestRef.current) return;
      if (!response.success || !response.data) {
        setPhase("file-ready");
        setError(response.message || "PDF delivery extraction failed.");
        return;
      }
      setPreview(response.data);
      if (selectedOrder) {
        const merged = mergePreviewIntoRestock(selectedOrder, response.data);
        setRows(merged.rows);
        setUnmatchedRows(merged.unmatchedRows);
      } else {
        setRows(makeStandalonePreviewRows(response.data));
        setUnmatchedRows(0);
      }
      setPage(1);
      setPhase("preview-ready");
    } catch (previewError) {
      if (sessionId !== requestRef.current) return;
      setPhase("file-ready");
      setError(
        previewError instanceof Error ? previewError.message : "PDF delivery extraction failed."
      );
    }
  }

  async function searchRestockTickets() {`,
  "PDF auto-preview function"
);
dialog = dialog.replaceAll('if (preview && mode === "SPREADSHEET") {', "if (preview) {");
dialog = replaceOnce(
  dialog,
  '    if (preview && mode === "SPREADSHEET") setRows(makeStandalonePreviewRows(preview));',
  '    if (preview) setRows(makeStandalonePreviewRows(preview));',
  "clear restock keeps parsed PDF rows"
);
dialog = replaceRegexOnce(
  dialog,
  /  async function searchProducts\(\) \{[\s\S]*?\n  function updateRow/,
  "  function updateRow",
  "manual PDF builder functions"
);
dialog = replaceRegexOnce(
  dialog,
  /  function previewPdfDocument\(\) \{[\s\S]*?\n  \}\n\n  async function completeReceipt/,
  '  function previewPdfDocument() {\n    if (!file || mode !== "PDF") return;\n    setShowPdfPreview((current) => !current);\n  }\n\n  async function completeReceipt',
  "popup PDF preview"
);
dialog = replaceOnce(
  dialog,
  '      setPhase(mode === "SPREADSHEET" && preview ? "preview-ready" : "file-ready");',
  '      setPhase(preview ? "preview-ready" : "file-ready");',
  "receipt error preview phase"
);
dialog = replaceOnce(
  dialog,
  '    !isBusy &&\n    (mode === "PDF" || phase === "preview-ready")',
  '    !isBusy &&\n    phase === "preview-ready"',
  "completion requires parsed preview"
);
dialog = replaceOnce(
  dialog,
  '                        Preview PDF\n',
  '                        {showPdfPreview ? "Hide PDF" : "Preview PDF"}\n',
  "inline PDF preview button label"
);
dialog = replaceOnce(
  dialog,
  '            {file && phase !== "success" ? (\n              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">\n                <div className="flex flex-wrap items-start justify-between gap-3">',
  '            {mode === "PDF" && file && pdfPreviewUrl && showPdfPreview && phase !== "success" ? (\n              <section className="rounded-2xl border border-slate-200 bg-white p-3">\n                <iframe\n                  className="h-[520px] w-full rounded-xl border border-slate-200"\n                  src={pdfPreviewUrl}\n                  title={`Preview ${file.name}`}\n                />\n              </section>\n            ) : null}\n\n            {file && phase !== "success" ? (\n              <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">\n                <div className="flex flex-wrap items-start justify-between gap-3">',
  "inline PDF preview surface"
);
dialog = dialog.replaceAll("hasSpreadsheetPreview", "hasImportPreview");
dialog = replaceOnce(
  dialog,
  '<p className="text-sm font-semibold text-rose-900">Unresolved spreadsheet rows</p>',
  '<p className="text-sm font-semibold text-rose-900">Unresolved delivery rows</p>',
  "generic unresolved heading"
);
dialog = replaceOnce(
  dialog,
  '                  Unknown products must be created in Products or corrected in the file before this\n                  receipt can complete.',
  '                  Unknown products must be corrected or created in Products before this receipt can\n                  complete. PDF lines are extracted automatically; manual bulk re-entry is not required.',
  "unresolved PDF guidance"
);
dialog = replaceRegexOnce(
  dialog,
  /\n            \{mode === "PDF" && file && !selectedOrder && phase !== "success" \? \([\s\S]*?\n            \) : null\}\n\n            \{file && rows\.length > 0/,
  '\n\n            {file && rows.length > 0',
  "Build delivery session JSX"
);
dialog = replaceOnce(
  dialog,
  '                helper="This may take a moment for larger spreadsheets."',
  '                helper={\n                  mode === "PDF"\n                    ? "Extracting the supplier table and matching existing Products."\n                    : "This may take a moment for larger spreadsheets."\n                }',
  "PDF extraction loading helper"
);
if (dialog.includes("Build delivery session") || dialog.includes("window.open(")) {
  throw new Error("Manual PDF builder or popup preview still exists after patch");
}
fs.writeFileSync("frontend/src/components/inventory/InventoryImportDialog.tsx", dialog);

let uiContract = fs.readFileSync("scripts/restock-phase10-ui-contract-test.ts", "utf8");
uiContract = uiContract
  .replace('assert.match(dialogSource, /Build delivery session/);\n', 'assert.doesNotMatch(dialogSource, /Build delivery session/);\n')
  .replace('assert.match(dialogSource, /Product name, SKU, barcode, or YSB label/);\n', '')
  .replace('assert.match(dialogSource, /lookupInventoryByBarcode/);\n', 'assert.doesNotMatch(dialogSource, /lookupInventoryByBarcode/);\n')
  .replace('assert.match(dialogSource, /fetchProducts/);\n', 'assert.doesNotMatch(dialogSource, /fetchProducts/);\n')
  .replace('assert.match(dialogSource, /No canonical Product matched/);\n', '')
  .replace('assert.match(dialogSource, /Open Products/);\n', 'assert.doesNotMatch(dialogSource, /window\\.open\\s*\\(/);\nassert.match(dialogSource, /previewBulkDeliveryPdf/);\nassert.match(dialogSource, /<iframe/);\nassert.match(dialogSource, /PDF lines are extracted automatically/);\n');
uiContract = replaceOnce(
  uiContract,
  'assert.match(apiSource, /\\/api\\/inventory\\/delivery-sessions\\/complete/);',
  'assert.match(apiSource, /\\/api\\/inventory\\/delivery-sessions\\/pdf\\/preview/);\nassert.match(apiSource, /\\/api\\/inventory\\/delivery-sessions\\/complete/);',
  "PDF preview API UI contract"
);
fs.writeFileSync("scripts/restock-phase10-ui-contract-test.ts", uiContract);

let backendContract = fs.readFileSync("backend/test/bulk-delivery-phase10-contract.test.ts", "utf8");
backendContract = replaceOnce(
  backendContract,
  'import { completeBulkDeliverySchema } from "../src/validators/bulkDelivery.validators.js";\n',
  'import { extractDeliveryRowsFromTextItems } from "../src/services/pdfDeliveryImportService.js";\nimport { completeBulkDeliverySchema } from "../src/validators/bulkDelivery.validators.js";\n',
  "PDF parser contract import"
);
backendContract += String.raw`

test("Phase 10 PDF delivery parser extracts structured supplier rows without manual rebuilding", () => {
  const rows = extractDeliveryRowsFromTextItems([
    { page: 1, x: 10, y: 100, text: "Product" },
    { page: 1, x: 90, y: 100, text: "SKU" },
    { page: 1, x: 140, y: 100, text: "Barcode" },
    { page: 1, x: 210, y: 100, text: "Qty" },
    { page: 1, x: 250, y: 100, text: "Batch / Lot" },
    { page: 1, x: 330, y: 100, text: "Expiry" },
    { page: 1, x: 10, y: 80, text: "555 Tuna Mechado" },
    { page: 1, x: 90, y: 80, text: "SARIMA-P010" },
    { page: 1, x: 140, y: 80, text: "748485700045" },
    { page: 1, x: 210, y: 80, text: "5" },
    { page: 1, x: 250, y: 80, text: "BULKQA-MECHADO-001" },
    { page: 1, x: 330, y: 80, text: "2029-03-31" }
  ]);

  assert.deepEqual(rows, [
    {
      productName: "555 Tuna Mechado",
      sku: "SARIMA-P010",
      barcode: "748485700045",
      quantity: "5",
      batchCode: "BULKQA-MECHADO-001",
      expirationDate: "2029-03-31"
    }
  ]);
});

test("Phase 10 PDF preview endpoint is Owner controlled", () => {
  assert.match(routeSource, /"\/delivery-sessions\/pdf\/preview"/);
  assert.match(
    routeSource,
    /"\/delivery-sessions\/pdf\/preview"[\s\S]*?requireRole\("OWNER"\)[\s\S]*?previewBulkDeliveryPdfController/
  );
});
`;
fs.writeFileSync("backend/test/bulk-delivery-phase10-contract.test.ts", backendContract);

console.log("Phase 10 automatic PDF bulk extraction patch staged.");
