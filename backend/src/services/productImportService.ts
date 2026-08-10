import path from "node:path";
import { randomUUID } from "node:crypto";

import { Prisma, type ProductStatus, type ProductUnit } from "@prisma/client";
import { readSheet } from "read-excel-file/node";

import { prisma } from "../database/prismaClient.js";
import { isSupportedCatalogImageUrl, normalizeCatalogImageUrl } from "../utils/catalogImage.js";
import {
  extractCanonicalProductSize,
  normalizeCanonicalProductName,
  normalizeProductIdentity
} from "../utils/catalogIdentity.js";
import { HttpError } from "../utils/httpError.js";
import { normalizeCode, normalizeWhitespace } from "../utils/normalizers.js";
import { createOpeningStockBatch, assertStockInvariant } from "./stockDomainService.js";
import { operationalProductWhere } from "./catalogQualityPolicy.js";

const PRODUCT_IMPORT_TEMPLATE_HEADERS = [
  "name",
  "sku",
  "barcode",
  "category",
  "unit",
  "costPrice",
  "sellingPrice",
  "reorderLevel",
  "targetStockLevel",
  "initialStock",
  "status",
  "description",
  "imageUrl"
] as const;

const REQUIRED_IMPORT_HEADERS = [
  "name",
  "sku",
  "category",
  "unit",
  "costPrice",
  "sellingPrice",
  "reorderLevel",
  "initialStock"
] as const;

const SUPPORTED_EXTENSIONS = new Set([".csv", ".xlsx"]);
const SUPPORTED_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream"
]);

const ALLOWED_STATUSES = new Set<ProductStatus>(["ACTIVE", "INACTIVE", "DISCONTINUED"]);
const ALLOWED_UNITS = new Set<ProductUnit>([
  "PIECE",
  "PACK",
  "BOX",
  "BOTTLE",
  "SACHET",
  "KILOGRAM",
  "GRAM",
  "LITER",
  "MILLILITER"
]);

type UploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type ImportIssue = {
  rowNumber?: number;
  field?: string;
  code: string;
  message: string;
  value?: string | null;
  existingProductId?: string;
};

type NormalizedImportRow = {
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  categoryId: string;
  unit: ProductUnit;
  costPrice: string;
  sellingPrice: string;
  reorderLevel: number;
  targetStockLevel: number;
  initialStock: number;
  status: ProductStatus;
  description: string | null;
  imageUrl: string | null;
};

type PreviewRow = {
  rowNumber: number;
  normalizedData: NormalizedImportRow | null;
  valid: boolean;
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export type ProductImportPreview = {
  fileName: string;
  fileType: "csv" | "xlsx";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  ignoredColumns: string[];
  detectedColumns: string[];
  rows: PreviewRow[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export type ProductImportSummary = {
  importId: string;
  fileName: string;
  fileType: "csv" | "xlsx";
  totalRows: number;
  importedRows: number;
  failedRows: number;
  skippedRows: number;
  productsCreated: number;
  inventoryRowsCreated: number;
  initialMovementsCreated: number;
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

type SpreadsheetCell = {
  text: string;
  hasFormula: boolean;
};

type SpreadsheetRow = {
  rowNumber: number;
  cells: SpreadsheetCell[];
  isBlank: boolean;
};

type SpreadsheetTable = {
  headers: string[];
  rows: SpreadsheetRow[];
  sourceRows: number;
};

const headerAliasEntries: Array<[string, string]> = [
  ["name", "name"],
  ["productname", "name"],
  ["product name", "name"],
  ["product_name", "name"],
  ["sku", "sku"],
  ["productsku", "sku"],
  ["product code", "sku"],
  ["productcode", "sku"],
  ["product_code", "sku"],
  ["barcode", "barcode"],
  ["barcode number", "barcode"],
  ["barcodenumber", "barcode"],
  ["category", "category"],
  ["category name", "category"],
  ["categoryname", "category"],
  ["unit", "unit"],
  ["costprice", "costPrice"],
  ["cost price", "costPrice"],
  ["cost_price", "costPrice"],
  ["sellingprice", "sellingPrice"],
  ["selling price", "sellingPrice"],
  ["selling_price", "sellingPrice"],
  ["reorderlevel", "reorderLevel"],
  ["reorder level", "reorderLevel"],
  ["reorder_level", "reorderLevel"],
  ["targetstocklevel", "targetStockLevel"],
  ["target stock", "targetStockLevel"],
  ["target stock level", "targetStockLevel"],
  ["target_stock_level", "targetStockLevel"],
  ["initialstock", "initialStock"],
  ["initial stock", "initialStock"],
  ["initial_stock", "initialStock"],
  ["status", "status"],
  ["description", "description"],
  ["imageurl", "imageUrl"],
  ["image url", "imageUrl"],
  ["image_url", "imageUrl"],
  ["productimage", "imageUrl"],
  ["product image", "imageUrl"]
];

const headerAliasMap = new Map<string, string>(
  headerAliasEntries.map(([key, value]) => [normalizeHeaderKey(key), value] as [string, string])
);

function normalizeHeaderKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function isBlank(value: string) {
  return value.trim().length === 0;
}

function isFormulaInjectionValue(value: string) {
  return /^[=+@]/.test(value.trim());
}

function normalizeParsedCellValue(value: unknown): SpreadsheetCell {
  if (value === null || value === undefined) {
    return {
      text: "",
      hasFormula: false
    };
  }

  if (value instanceof Date) {
    return {
      text: value.toISOString(),
      hasFormula: false
    };
  }

  if (typeof value === "string") {
    return {
      text: value,
      hasFormula: false
    };
  }

  if (typeof value === "number") {
    return {
      text: Number.isInteger(value)
        ? value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 })
        : value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 }),
      hasFormula: false
    };
  }

  if (typeof value === "boolean") {
    return {
      text: value ? "TRUE" : "FALSE",
      hasFormula: false
    };
  }

  return {
    text: String(value),
    hasFormula: false
  };
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  const normalizedText = text.replace(/^\uFEFF/, "");
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < normalizedText.length; index += 1) {
    const char = normalizedText[index];
    const nextChar = normalizedText[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === '"') {
      if (currentCell.length === 0) {
        inQuotes = true;
      } else {
        currentCell += char;
      }
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";

      if (nextChar === "\n") {
        index += 1;
      }

      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (inQuotes) {
    throw new HttpError(400, "The uploaded CSV file contains an unterminated quoted field.", {
      code: "INVALID_IMPORT_CSV"
    });
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows;
}

function buildSpreadsheetTableFromRows(rawRows: Array<Array<unknown>>): SpreadsheetTable {
  if (rawRows.length === 0) {
    throw new HttpError(400, "The uploaded file does not contain any worksheets.", {
      code: "EMPTY_IMPORT_WORKBOOK"
    });
  }

  const columnCount = rawRows.reduce((maximum, row) => Math.max(maximum, row.length), 0);

  if (columnCount === 0) {
    throw new HttpError(400, "The uploaded file does not contain any rows.", {
      code: "EMPTY_IMPORT_WORKSHEET"
    });
  }

  const headers = Array.from(
    { length: columnCount },
    (_value, columnIndex) => normalizeParsedCellValue(rawRows[0]?.[columnIndex]).text
  );

  if (headers.every((header) => isBlank(header))) {
    throw new HttpError(400, "The uploaded file does not contain any rows.", {
      code: "EMPTY_IMPORT_WORKSHEET"
    });
  }

  const rows = rawRows.slice(1).map((rawRow, index) => {
    const cells = Array.from({ length: columnCount }, (_value, columnIndex) =>
      normalizeParsedCellValue(rawRow?.[columnIndex])
    );

    return {
      rowNumber: index + 2,
      cells,
      isBlank: cells.every((cell) => isBlank(cell.text))
    };
  });

  return {
    headers,
    rows,
    sourceRows: rows.filter((row) => !row.isBlank).length
  };
}

async function readExcelTable(file: UploadFile): Promise<SpreadsheetTable> {
  let rows: Array<Array<unknown>>;

  try {
    rows = await readSheet(file.buffer, {
      trim: false
    });
  } catch {
    throw new HttpError(400, "The uploaded Excel file could not be read.", {
      code: "INVALID_IMPORT_WORKBOOK"
    });
  }

  return buildSpreadsheetTableFromRows(rows);
}

function readCsvTable(file: UploadFile): SpreadsheetTable {
  const text = file.buffer.toString("utf8");
  const rows = parseCsvRows(text);

  return buildSpreadsheetTableFromRows(rows);
}

async function readSpreadsheetTable(
  file: UploadFile,
  fileType: "csv" | "xlsx"
): Promise<SpreadsheetTable> {
  if (fileType === "csv") {
    return readCsvTable(file);
  }

  return readExcelTable(file);
}

function detectFileType(file: UploadFile): "csv" | "xlsx" {
  const extension = path.extname(file.originalname).toLowerCase();

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new HttpError(400, "Unsupported product import file type.", {
      code: "UNSUPPORTED_IMPORT_FILE_TYPE",
      details: {
        extension
      }
    });
  }

  if (file.mimetype && !SUPPORTED_MIME_TYPES.has(file.mimetype)) {
    throw new HttpError(400, "Unsupported product import MIME type.", {
      code: "UNSUPPORTED_IMPORT_FILE_MIME",
      details: {
        mimetype: file.mimetype
      }
    });
  }

  return extension.slice(1) as "csv" | "xlsx";
}

function mapHeaders(headers: string[]) {
  const detectedColumns: string[] = [];
  const ignoredColumns: string[] = [];
  const columnIndexByCanonical = new Map<string, number>();
  const duplicateHeaders: string[] = [];

  headers.forEach((header, index) => {
    const trimmedHeader = header.trim();

    if (trimmedHeader.length === 0) {
      return;
    }

    const canonical = headerAliasMap.get(normalizeHeaderKey(trimmedHeader));

    if (!canonical) {
      ignoredColumns.push(trimmedHeader);
      return;
    }

    if (columnIndexByCanonical.has(canonical)) {
      duplicateHeaders.push(trimmedHeader);
      return;
    }

    columnIndexByCanonical.set(canonical, index);
    detectedColumns.push(canonical);
  });

  const missingRequiredHeaders = REQUIRED_IMPORT_HEADERS.filter(
    (requiredHeader) => !columnIndexByCanonical.has(requiredHeader)
  );

  return {
    columnIndexByCanonical,
    detectedColumns,
    duplicateHeaders,
    ignoredColumns,
    missingRequiredHeaders
  };
}

function normalizeTextCell(value: string | undefined) {
  const normalized = value === undefined ? "" : normalizeWhitespace(value);

  return normalized.length > 0 ? normalized : "";
}

function parseMoney(value: string, field: string, rowNumber: number, errors: ImportIssue[]) {
  if (isBlank(value)) {
    errors.push({
      code: "MISSING_REQUIRED_FIELD",
      field,
      message: `${field} is required.`,
      rowNumber,
      value
    });
    return null;
  }

  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    errors.push({
      code: "INVALID_MONEY_VALUE",
      field,
      message: `${field} must be a non-negative amount with up to two decimal places.`,
      rowNumber,
      value
    });
    return null;
  }

  try {
    return new Prisma.Decimal(value).toFixed(2);
  } catch {
    errors.push({
      code: "INVALID_MONEY_VALUE",
      field,
      message: `${field} is not a valid decimal amount.`,
      rowNumber,
      value
    });
    return null;
  }
}

function parseWholeNumber(value: string, field: string, rowNumber: number, errors: ImportIssue[]) {
  if (isBlank(value)) {
    errors.push({
      code: "MISSING_REQUIRED_FIELD",
      field,
      message: `${field} is required.`,
      rowNumber,
      value
    });
    return null;
  }

  if (!/^\d+$/.test(value)) {
    errors.push({
      code: "INVALID_INTEGER_VALUE",
      field,
      message: `${field} must be a whole number.`,
      rowNumber,
      value
    });
    return null;
  }

  return Number.parseInt(value, 10);
}

function parseOptionalText(value: string) {
  const normalized = normalizeTextCell(value);

  if (normalized.length === 0) {
    return null;
  }

  return normalized;
}

function resolveStatus(value: string, rowNumber: number, errors: ImportIssue[]) {
  if (isBlank(value)) {
    return "ACTIVE" satisfies ProductStatus;
  }

  const normalized = value.trim().toUpperCase();

  if (!ALLOWED_STATUSES.has(normalized as ProductStatus)) {
    errors.push({
      code: "INVALID_STATUS",
      field: "status",
      message: "Status must be ACTIVE, INACTIVE, or DISCONTINUED.",
      rowNumber,
      value
    });
    return null;
  }

  return normalized as ProductStatus;
}

function resolveUnit(value: string, rowNumber: number, errors: ImportIssue[]) {
  const normalized = value.trim().toUpperCase();

  if (!ALLOWED_UNITS.has(normalized as ProductUnit)) {
    errors.push({
      code: "INVALID_UNIT",
      field: "unit",
      message:
        "Unit must be one of PIECE, PACK, BOX, BOTTLE, SACHET, KILOGRAM, GRAM, LITER, or MILLILITER.",
      rowNumber,
      value
    });
    return null;
  }

  return normalized as ProductUnit;
}

function buildImportIssue(
  rowNumber: number,
  field: string,
  code: string,
  message: string,
  value?: string | null,
  existingProductId?: string
): ImportIssue {
  return {
    rowNumber,
    field,
    code,
    message,
    value,
    existingProductId
  };
}

function summarizeWarnings(ignoredColumns: string[]): ImportIssue[] {
  return ignoredColumns.map((column) =>
    buildImportIssue(
      0,
      "column",
      "IGNORED_COLUMN",
      `Ignored column "${column}" because it is not part of the product import contract.`,
      column
    )
  );
}

function buildTemplateCsv() {
  return PRODUCT_IMPORT_TEMPLATE_HEADERS.join(",");
}

function validateFormulaCells(
  row: SpreadsheetRow,
  canonicalHeaders: string[],
  rowErrors: ImportIssue[]
) {
  row.cells.forEach((cell, index) => {
    const header = canonicalHeaders[index];

    if (cell.hasFormula) {
      rowErrors.push(
        buildImportIssue(
          row.rowNumber,
          header ?? `column-${index + 1}`,
          "FORMULA_NOT_ALLOWED",
          "Spreadsheet formulas are not allowed in product import files.",
          cell.text
        )
      );
    }
  });
}

async function resolveCategoryLookup() {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      slug: true
    }
  });

  const lookup = new Map<string, string>();

  categories.forEach((category) => {
    lookup.set(normalizeWhitespace(category.name).toLowerCase(), category.id);
    lookup.set(normalizeWhitespace(category.slug).toLowerCase(), category.id);
  });

  return lookup;
}

function resolveCellValue(
  row: SpreadsheetRow,
  columnIndexByCanonical: Map<string, number>,
  field: string
) {
  const index = columnIndexByCanonical.get(field);

  return index === undefined ? "" : (row.cells[index]?.text ?? "");
}

function normalizeImportRow(
  row: SpreadsheetRow,
  columnIndexByCanonical: Map<string, number>,
  categoryLookup: Map<string, string>
) {
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];

  const name = normalizeWhitespace(resolveCellValue(row, columnIndexByCanonical, "name"));
  const sku = normalizeCode(resolveCellValue(row, columnIndexByCanonical, "sku"));
  const barcodeRaw = normalizeTextCell(resolveCellValue(row, columnIndexByCanonical, "barcode"));
  const category = normalizeWhitespace(resolveCellValue(row, columnIndexByCanonical, "category"));
  const unitRaw = normalizeTextCell(resolveCellValue(row, columnIndexByCanonical, "unit"));
  const costPriceRaw = normalizeTextCell(
    resolveCellValue(row, columnIndexByCanonical, "costPrice")
  );
  const sellingPriceRaw = normalizeTextCell(
    resolveCellValue(row, columnIndexByCanonical, "sellingPrice")
  );
  const reorderLevelRaw = normalizeTextCell(
    resolveCellValue(row, columnIndexByCanonical, "reorderLevel")
  );
  const targetStockLevelRaw = normalizeTextCell(
    resolveCellValue(row, columnIndexByCanonical, "targetStockLevel")
  );
  const initialStockRaw = normalizeTextCell(
    resolveCellValue(row, columnIndexByCanonical, "initialStock")
  );
  const statusRaw = normalizeTextCell(resolveCellValue(row, columnIndexByCanonical, "status"));
  const descriptionRaw = normalizeTextCell(
    resolveCellValue(row, columnIndexByCanonical, "description")
  );
  const imageUrlRaw = normalizeTextCell(resolveCellValue(row, columnIndexByCanonical, "imageUrl"));

  if (!name) {
    errors.push(
      buildImportIssue(row.rowNumber, "name", "MISSING_REQUIRED_FIELD", "Product name is required.")
    );
  } else if (name.length > 160) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "name",
        "NAME_TOO_LONG",
        "Product name must be 160 characters or fewer.",
        name
      )
    );
  } else if (isFormulaInjectionValue(name)) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "name",
        "DANGEROUS_CELL_VALUE",
        "Product name cannot begin with a spreadsheet formula marker.",
        name
      )
    );
  }

  if (!sku) {
    errors.push(
      buildImportIssue(row.rowNumber, "sku", "MISSING_REQUIRED_FIELD", "SKU is required.")
    );
  } else if (sku.length > 80) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "sku",
        "SKU_TOO_LONG",
        "SKU must be 80 characters or fewer.",
        sku
      )
    );
  } else if (isFormulaInjectionValue(sku)) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "sku",
        "DANGEROUS_CELL_VALUE",
        "SKU cannot begin with a spreadsheet formula marker.",
        sku
      )
    );
  }

  if (barcodeRaw && barcodeRaw.length > 80) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "barcode",
        "BARCODE_TOO_LONG",
        "Barcode must be 80 characters or fewer.",
        barcodeRaw
      )
    );
  }

  if (barcodeRaw && isFormulaInjectionValue(barcodeRaw)) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "barcode",
        "DANGEROUS_CELL_VALUE",
        "Barcode cannot begin with a spreadsheet formula marker.",
        barcodeRaw
      )
    );
  }

  if (!category) {
    errors.push(
      buildImportIssue(row.rowNumber, "category", "MISSING_REQUIRED_FIELD", "Category is required.")
    );
  } else if (category.length > 140) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "category",
        "CATEGORY_TOO_LONG",
        "Category must be 140 characters or fewer.",
        category
      )
    );
  }

  if (unitRaw && isFormulaInjectionValue(unitRaw)) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "unit",
        "DANGEROUS_CELL_VALUE",
        "Unit cannot begin with a spreadsheet formula marker.",
        unitRaw
      )
    );
  }

  if (costPriceRaw && isFormulaInjectionValue(costPriceRaw)) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "costPrice",
        "DANGEROUS_CELL_VALUE",
        "Cost price cannot begin with a spreadsheet formula marker.",
        costPriceRaw
      )
    );
  }

  if (sellingPriceRaw && isFormulaInjectionValue(sellingPriceRaw)) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "sellingPrice",
        "DANGEROUS_CELL_VALUE",
        "Selling price cannot begin with a spreadsheet formula marker.",
        sellingPriceRaw
      )
    );
  }

  const costPrice = parseMoney(costPriceRaw, "costPrice", row.rowNumber, errors);
  const sellingPrice = parseMoney(sellingPriceRaw, "sellingPrice", row.rowNumber, errors);
  const reorderLevel = parseWholeNumber(reorderLevelRaw, "reorderLevel", row.rowNumber, errors);
  const initialStock = parseWholeNumber(initialStockRaw, "initialStock", row.rowNumber, errors);

  let targetStockLevel = parseWholeNumber(
    targetStockLevelRaw.length > 0 ? targetStockLevelRaw : reorderLevelRaw,
    "targetStockLevel",
    row.rowNumber,
    errors
  );

  if (targetStockLevel === null && reorderLevel !== null && isBlank(targetStockLevelRaw)) {
    targetStockLevel = reorderLevel;
  }

  const status = resolveStatus(statusRaw, row.rowNumber, errors);
  const unit = resolveUnit(unitRaw, row.rowNumber, errors);
  const description = parseOptionalText(descriptionRaw);
  const imageUrl = normalizeCatalogImageUrl(imageUrlRaw);
  const barcode = parseOptionalText(barcodeRaw);

  if (barcodeRaw.length > 0 && barcode === null) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "barcode",
        "INVALID_BARCODE",
        "Barcode must not be blank after trimming.",
        barcodeRaw
      )
    );
  }

  if (descriptionRaw.length > 255) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "description",
        "DESCRIPTION_TOO_LONG",
        "Description must be 255 characters or fewer.",
        descriptionRaw
      )
    );
  }

  if (descriptionRaw.length > 0 && description === null) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "description",
        "INVALID_DESCRIPTION",
        "Description must not be blank after trimming.",
        descriptionRaw
      )
    );
  }

  if (imageUrlRaw.length > 2048) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "imageUrl",
        "IMAGE_URL_TOO_LONG",
        "Product image URL must be 2,048 characters or fewer.",
        imageUrlRaw
      )
    );
  } else if (imageUrl && !isSupportedCatalogImageUrl(imageUrl)) {
    errors.push(
      buildImportIssue(
        row.rowNumber,
        "imageUrl",
        "INVALID_IMAGE_URL",
        "Product image must use an HTTPS URL or a root-relative local asset path.",
        imageUrlRaw
      )
    );
  }

  if (category) {
    const categoryId = categoryLookup.get(category.toLowerCase());

    if (!categoryId) {
      errors.push(
        buildImportIssue(
          row.rowNumber,
          "category",
          "UNKNOWN_CATEGORY",
          `Category "${category}" was not found.`,
          category
        )
      );
    }

    if (
      name &&
      sku &&
      costPrice !== null &&
      sellingPrice !== null &&
      reorderLevel !== null &&
      initialStock !== null &&
      targetStockLevel !== null &&
      status !== null &&
      unit !== null &&
      categoryId
    ) {
      return {
        errors,
        warnings,
        normalized: {
          name,
          sku,
          barcode,
          category,
          categoryId,
          unit,
          costPrice,
          sellingPrice,
          reorderLevel,
          targetStockLevel,
          initialStock,
          status,
          description,
          imageUrl
        } satisfies NormalizedImportRow
      };
    }
  }

  return {
    errors,
    warnings,
    normalized: null
  };
}

function addConflictIssues(
  previewRows: PreviewRow[],
  conflicts: Array<{ id: string; sku: string; barcode: string | null }>
) {
  const skuConflictMap = new Map(conflicts.map((conflict) => [conflict.sku, conflict.id]));
  const barcodeConflictMap = new Map(
    conflicts
      .filter((conflict) => conflict.barcode)
      .map((conflict) => [conflict.barcode as string, conflict.id])
  );

  previewRows.forEach((row) => {
    if (!row.normalizedData) {
      return;
    }

    const skuConflict = skuConflictMap.get(row.normalizedData.sku);

    if (skuConflict) {
      row.errors.push(
        buildImportIssue(
          row.rowNumber,
          "sku",
          "SKU_ALREADY_EXISTS",
          "This SKU already exists in the database.",
          row.normalizedData.sku,
          skuConflict
        )
      );
    }

    if (row.normalizedData.barcode) {
      const barcodeConflict = barcodeConflictMap.get(row.normalizedData.barcode);

      if (barcodeConflict) {
        row.errors.push(
          buildImportIssue(
            row.rowNumber,
            "barcode",
            "BARCODE_ALREADY_EXISTS",
            "This barcode already exists in the database.",
            row.normalizedData.barcode,
            barcodeConflict
          )
        );
      }
    }
  });
}

function addWithinFileDuplicates(previewRows: PreviewRow[]) {
  const skuCounts = new Map<string, PreviewRow[]>();
  const barcodeCounts = new Map<string, PreviewRow[]>();

  previewRows.forEach((row) => {
    if (!row.normalizedData) {
      return;
    }

    const skuRows = skuCounts.get(row.normalizedData.sku) ?? [];
    skuRows.push(row);
    skuCounts.set(row.normalizedData.sku, skuRows);

    if (row.normalizedData.barcode) {
      const barcodeRows = barcodeCounts.get(row.normalizedData.barcode) ?? [];
      barcodeRows.push(row);
      barcodeCounts.set(row.normalizedData.barcode, barcodeRows);
    }
  });

  for (const [sku, rows] of skuCounts.entries()) {
    if (rows.length <= 1) {
      continue;
    }

    rows.forEach((row) =>
      row.errors.push(
        buildImportIssue(
          row.rowNumber,
          "sku",
          "DUPLICATE_SKU_IN_FILE",
          "This SKU appears more than once in the uploaded file.",
          sku
        )
      )
    );
  }

  for (const [barcode, rows] of barcodeCounts.entries()) {
    if (rows.length <= 1) {
      continue;
    }

    rows.forEach((row) =>
      row.errors.push(
        buildImportIssue(
          row.rowNumber,
          "barcode",
          "DUPLICATE_BARCODE_IN_FILE",
          "This barcode appears more than once in the uploaded file.",
          barcode
        )
      )
    );
  }
}

async function validateSpreadsheetImport(file: UploadFile): Promise<ProductImportPreview> {
  const fileType = detectFileType(file);

  if (file.buffer.length === 0) {
    throw new HttpError(400, "The uploaded file is empty.", {
      code: "EMPTY_IMPORT_FILE"
    });
  }

  const table = await readSpreadsheetTable(file, fileType);
  const {
    columnIndexByCanonical,
    detectedColumns,
    duplicateHeaders,
    ignoredColumns,
    missingRequiredHeaders
  } = mapHeaders(table.headers);

  const fileErrors: ImportIssue[] = [];

  if (duplicateHeaders.length > 0) {
    fileErrors.push(
      ...duplicateHeaders.map((header) =>
        buildImportIssue(
          0,
          "header",
          "DUPLICATE_HEADER",
          `Duplicate header "${header}" was found in the import file.`,
          header
        )
      )
    );
  }

  if (missingRequiredHeaders.length > 0) {
    fileErrors.push(
      ...missingRequiredHeaders.map((header) =>
        buildImportIssue(
          0,
          "header",
          "MISSING_REQUIRED_HEADER",
          `Required column "${header}" is missing from the import file.`,
          header
        )
      )
    );
  }

  const filteredRows = table.rows.filter((row) => !row.isBlank);

  if (filteredRows.length === 0) {
    fileErrors.push(
      buildImportIssue(
        0,
        "rows",
        "NO_DATA_ROWS",
        "The import file does not contain any product rows."
      )
    );
  }

  if (filteredRows.length > 1000) {
    fileErrors.push(
      buildImportIssue(
        0,
        "rowLimit",
        "TOO_MANY_ROWS",
        "The product import file exceeds the maximum supported row count of 1,000."
      )
    );
  }

  const categoryLookup = await resolveCategoryLookup();
  const previewRows: PreviewRow[] = filteredRows.map((row) => {
    const rowErrors: ImportIssue[] = [];
    const rowWarnings: ImportIssue[] = [];

    validateFormulaCells(row, table.headers, rowErrors);

    const normalizedResult = normalizeImportRow(row, columnIndexByCanonical, categoryLookup);
    rowErrors.push(...normalizedResult.errors);
    rowWarnings.push(...normalizedResult.warnings);

    return {
      rowNumber: row.rowNumber,
      normalizedData: normalizedResult.normalized,
      valid: normalizedResult.errors.length === 0 && normalizedResult.normalized !== null,
      errors: rowErrors,
      warnings: rowWarnings
    };
  });

  addWithinFileDuplicates(previewRows);
  const rowsByIdentity = new Map<string, PreviewRow[]>();
  for (const row of previewRows) {
    if (!row.normalizedData) continue;
    const identity = normalizeProductIdentity(row.normalizedData.name);
    rowsByIdentity.set(identity, [...(rowsByIdentity.get(identity) ?? []), row]);
  }
  for (const [identity, rowsWithIdentity] of rowsByIdentity) {
    if (!identity || rowsWithIdentity.length < 2) continue;
    for (const row of rowsWithIdentity) {
      row.warnings.push({
        code: "POSSIBLE_DUPLICATE_IDENTITY_IN_FILE",
        field: "name",
        message:
          "Another import row has the same normalized name. Different sizes or variants remain separate; otherwise review these records as duplicate candidates.",
        rowNumber: row.rowNumber,
        value: row.normalizedData?.name
      });
    }
  }

  const skuValues = [
    ...new Set(previewRows.flatMap((row) => (row.normalizedData ? [row.normalizedData.sku] : [])))
  ];
  const barcodeValues = [
    ...new Set(
      previewRows.flatMap((row) =>
        row.normalizedData?.barcode ? [row.normalizedData.barcode] : []
      )
    )
  ];

  if (skuValues.length > 0 || barcodeValues.length > 0) {
    const conflicts = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        barcode: true
      },
      where: {
        OR: [
          skuValues.length > 0 ? { sku: { in: skuValues } } : undefined,
          barcodeValues.length > 0 ? { barcode: { in: barcodeValues } } : undefined
        ].filter(Boolean) as Prisma.ProductWhereInput[]
      }
    });

    addConflictIssues(previewRows, conflicts);
  }

  const existingIdentityProducts = await prisma.product.findMany({
    select: { barcode: true, id: true, name: true, sku: true },
    where: operationalProductWhere()
  });
  const productsByIdentity = new Map<string, typeof existingIdentityProducts>();
  for (const product of existingIdentityProducts) {
    const identity = normalizeProductIdentity(product.name);
    productsByIdentity.set(identity, [...(productsByIdentity.get(identity) ?? []), product]);
  }
  for (const row of previewRows) {
    if (!row.normalizedData) continue;
    const identity = normalizeProductIdentity(row.normalizedData.name);
    const matches = productsByIdentity.get(identity) ?? [];
    for (const match of matches) {
      if (
        match.sku === row.normalizedData.sku ||
        (match.barcode && match.barcode === row.normalizedData.barcode)
      ) {
        continue;
      }
      row.warnings.push({
        code: "POSSIBLE_DUPLICATE_IDENTITY",
        existingProductId: match.id,
        field: "name",
        message:
          "A catalog product has the same normalized name but different strong identifiers. The imported record will require manual duplicate review.",
        rowNumber: row.rowNumber,
        value: row.normalizedData.name
      });
    }
  }

  const rows = previewRows.map((row) => ({
    ...row,
    valid: row.errors.length === 0 && row.normalizedData !== null
  }));

  const errors = [...fileErrors, ...rows.flatMap((row) => row.errors)];
  const warnings = [...summarizeWarnings(ignoredColumns), ...rows.flatMap((row) => row.warnings)];

  const validRows = rows.filter((row) => row.valid).length;
  const invalidRows = rows.length - validRows;

  return {
    fileName: file.originalname,
    fileType,
    totalRows: rows.length,
    validRows,
    invalidRows,
    ignoredColumns,
    detectedColumns,
    rows,
    errors,
    warnings
  };
}

export async function previewProductImport(file: UploadFile): Promise<ProductImportPreview> {
  return validateSpreadsheetImport(file);
}

export async function importProductsFromFile(
  file: UploadFile,
  performedById?: string
): Promise<ProductImportSummary> {
  const preview = await validateSpreadsheetImport(file);

  if (preview.invalidRows > 0 || preview.errors.length > 0) {
    throw new HttpError(422, "Product import contains validation errors.", {
      code: "PRODUCT_IMPORT_INVALID",
      details: preview
    });
  }

  const importId = randomUUID();
  const now = new Date();
  const importRows = preview.rows
    .filter((row) => row.valid && row.normalizedData)
    .map((row) => ({
      candidateProductIds: row.warnings.flatMap((warning) =>
        warning.code === "POSSIBLE_DUPLICATE_IDENTITY" && warning.existingProductId
          ? [warning.existingProductId]
          : []
      ),
      data: row.normalizedData as NormalizedImportRow
    }));

  let inventoryRowsCreated = 0;
  let initialMovementsCreated = 0;

  await prisma.$transaction(async (tx) => {
    const createdByIdentity = new Map<string, string[]>();
    for (const importRow of importRows) {
      const row = importRow.data;
      const canonicalName = normalizeCanonicalProductName(row.name);
      const size = extractCanonicalProductSize(canonicalName);
      const product = await tx.product.create({
        data: {
          name: canonicalName,
          sku: row.sku,
          barcode: row.barcode,
          categoryId: row.categoryId,
          unit: row.unit,
          costPrice: new Prisma.Decimal(row.costPrice),
          sellingPrice: new Prisma.Decimal(row.sellingPrice),
          reorderLevel: row.reorderLevel,
          targetStockLevel: row.targetStockLevel,
          status: row.status,
          description: row.description,
          imageUrl: row.imageUrl,
          sizeValue: size.sizeValue ? new Prisma.Decimal(size.sizeValue) : null,
          sizeUnit: size.sizeUnit,
          recordSource: "IMPORT",
          dataQualityStatus: "NEEDS_REVIEW",
          isStorefrontVisible: false,
          aliases: {
            create: [
              {
                type: "RAW_NAME",
                value: row.name,
                normalizedValue: canonicalName.toLowerCase(),
                recordSource: "IMPORT",
                sourceReference: importId,
                evidence: { fileName: preview.fileName, importId }
              },
              {
                type: "SKU",
                value: row.sku,
                normalizedValue: row.sku.toUpperCase(),
                recordSource: "IMPORT",
                sourceReference: importId,
                evidence: { fileName: preview.fileName, importId }
              },
              ...(row.barcode
                ? [
                    {
                      type: "BARCODE" as const,
                      value: row.barcode,
                      normalizedValue: row.barcode,
                      recordSource: "IMPORT" as const,
                      sourceReference: importId,
                      evidence: { fileName: preview.fileName, importId }
                    }
                  ]
                : [])
            ]
          }
        }
      });

      const identity = normalizeProductIdentity(row.name);
      const candidateProductIds = new Set([
        ...importRow.candidateProductIds,
        ...(createdByIdentity.get(identity) ?? [])
      ]);
      for (const candidateProductId of candidateProductIds) {
        const sortedProductIds = [candidateProductId, product.id].sort();
        const leftProductId = sortedProductIds[0];
        const rightProductId = sortedProductIds[1];
        if (!leftProductId || !rightProductId) continue;
        await tx.productDuplicateCandidate.upsert({
          create: {
            confidence: "0.5500",
            evidence: {
              importId,
              importedBarcode: row.barcode,
              importedName: row.name,
              importedSku: row.sku,
              normalizedName: normalizeProductIdentity(row.name)
            },
            leftProductId,
            matchType: "NORMALIZED_IDENTITY",
            reason:
              "Imported name matches a catalog identity, but strong identifiers differ; manual review required.",
            rightProductId,
            status: "PENDING"
          },
          update: {},
          where: {
            leftProductId_rightProductId: { leftProductId, rightProductId }
          }
        });
      }
      createdByIdentity.set(identity, [...(createdByIdentity.get(identity) ?? []), product.id]);

      await tx.inventory.create({
        data: {
          productId: product.id,
          quantityOnHand: 0,
          lastStockUpdatedAt: now,
          version: 0
        }
      });

      inventoryRowsCreated += 1;

      if (row.initialStock > 0) {
        await createOpeningStockBatch(tx, {
          performedById,
          productId: product.id,
          quantity: row.initialStock,
          reason: "Initial stock from product import",
          referenceId: importId,
          unitCost: new Prisma.Decimal(row.costPrice),
          sku: row.sku
        });
        initialMovementsCreated += 1;
      }

      await assertStockInvariant(tx, product.id);
    }
  });

  return {
    importId,
    fileName: preview.fileName,
    fileType: preview.fileType,
    totalRows: preview.totalRows,
    importedRows: importRows.length,
    failedRows: 0,
    skippedRows: 0,
    productsCreated: importRows.length,
    inventoryRowsCreated,
    initialMovementsCreated,
    errors: [],
    warnings: preview.warnings
  };
}

export function getProductImportTemplateCsv() {
  return buildTemplateCsv();
}

export const productImportTemplateHeaders = PRODUCT_IMPORT_TEMPLATE_HEADERS;
