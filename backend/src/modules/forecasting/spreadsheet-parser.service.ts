import fs from "node:fs";
import path from "node:path";

import readXlsxFile from "read-excel-file/node";

import type { HistoricalImportIssue, HistoricalSalesPoint } from "./forecast.types.js";
import { normalizeProductName } from "../../utils/productNameNormalizer.js";

const MONTH_HEADERS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];
const REQUIRED_HEADERS = [
  "Product ID",
  "Category",
  "Product Name",
  "Product Price",
  ...MONTH_HEADERS,
  "Total Quantity Sold",
  "Annual Sales"
];

type RawCell = string | number | boolean | Date | null;
type RawRow = RawCell[];

export type ParsedWorkbookProduct = {
  productId: string;
  productName: string;
  category: string;
  sellingPrice: number;
  totalQuantitySold: number | null;
  row: number;
  points: HistoricalSalesPoint[];
};

export type ParsedWorkbook = {
  products: Map<string, ParsedWorkbookProduct>;
  issues: HistoricalImportIssue[];
  sourcePath: string;
  workbookYear: number;
  productRowsFound: number;
};

type HeaderMap = Map<string, number>;

function issue(
  code: string,
  severity: "warning" | "error",
  workbookYear: number,
  row: number | null,
  productId: string | null,
  message: string
): HistoricalImportIssue {
  return {
    code,
    severity,
    workbookYear,
    row,
    productId,
    message
  };
}

function normalizeHeader(value: RawCell) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function decodeSpreadsheetText(value: RawCell) {
  return String(value ?? "")
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

function decodeProductName(value: RawCell) {
  return normalizeProductName(decodeSpreadsheetText(value));
}

function toNumber(value: RawCell) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    return Number(value.replace(/,/g, ""));
  }

  return Number.NaN;
}

function assertFiniteNumber(value: number) {
  return Number.isFinite(value) && !Number.isNaN(value);
}

function coerceRows(rawRows: unknown): RawRow[] {
  if (
    Array.isArray(rawRows) &&
    rawRows.length === 1 &&
    rawRows[0] &&
    typeof rawRows[0] === "object" &&
    !Array.isArray(rawRows[0]) &&
    Array.isArray((rawRows[0] as { data?: unknown }).data)
  ) {
    return (rawRows[0] as { data: RawRow[] }).data;
  }

  return Array.isArray(rawRows) ? (rawRows as RawRow[]) : [];
}

function detectHeaderRow(rows: RawRow[]) {
  return rows.findIndex((row) => {
    const normalized = row.map(normalizeHeader);

    return (
      normalized.includes("product id") &&
      normalized.includes("category") &&
      normalized.includes("product name") &&
      MONTH_HEADERS.every((month) => normalized.includes(month.toLowerCase()))
    );
  });
}

function buildHeaderMap(headerRow: RawRow) {
  const headers = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const header = normalizeHeader(cell);

    if (header) {
      headers.set(header, index);
    }
  });

  return headers;
}

function getCell(row: RawRow, headers: HeaderMap, header: string) {
  return row[headers.get(header.toLowerCase()) ?? -1] ?? null;
}

function periodFor(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export async function parseHistoricalWorkbook(sourcePath: string, workbookYear: number) {
  if (!fs.existsSync(sourcePath)) {
    return {
      issues: [
        issue(
          "WORKBOOK_MISSING",
          "error",
          workbookYear,
          null,
          null,
          `Historical sales workbook was not found at ${path.normalize(sourcePath)}.`
        )
      ],
      productRowsFound: 0,
      products: new Map<string, ParsedWorkbookProduct>(),
      sourcePath,
      workbookYear
    } satisfies ParsedWorkbook;
  }

  const rawRows = await readXlsxFile(sourcePath);
  const rows = coerceRows(rawRows).filter((row) =>
    row.some((cell) => cell !== null && String(cell).trim() !== "")
  );
  const issues: HistoricalImportIssue[] = [];
  const headerRowIndex = detectHeaderRow(rows);

  if (headerRowIndex < 0) {
    return {
      issues: [
        issue(
          "HEADER_ROW_NOT_FOUND",
          "error",
          workbookYear,
          null,
          null,
          "Required historical sales header row was not found."
        )
      ],
      productRowsFound: 0,
      products: new Map<string, ParsedWorkbookProduct>(),
      sourcePath,
      workbookYear
    };
  }

  const headers = buildHeaderMap(rows[headerRowIndex] ?? []);
  const expectedHeaders = new Set(REQUIRED_HEADERS.map((header) => header.toLowerCase()));

  for (const header of REQUIRED_HEADERS) {
    if (!headers.has(header.toLowerCase())) {
      issues.push(
        issue(
          "MISSING_REQUIRED_HEADER",
          "error",
          workbookYear,
          headerRowIndex + 1,
          null,
          `Missing required header: ${header}.`
        )
      );
    }
  }

  for (const header of headers.keys()) {
    if (!expectedHeaders.has(header)) {
      issues.push(
        issue(
          "UNKNOWN_COLUMN",
          "warning",
          workbookYear,
          headerRowIndex + 1,
          null,
          `Unexpected column was ignored: ${header}.`
        )
      );
    }
  }

  if (issues.some((currentIssue) => currentIssue.severity === "error")) {
    return {
      issues,
      productRowsFound: 0,
      products: new Map<string, ParsedWorkbookProduct>(),
      sourcePath,
      workbookYear
    };
  }

  const products = new Map<string, ParsedWorkbookProduct>();
  const dataRows = rows.slice(headerRowIndex + 1);

  dataRows.forEach((row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const productId = decodeSpreadsheetText(getCell(row, headers, "Product ID"));
    const productName = decodeProductName(getCell(row, headers, "Product Name"));
    const category = decodeSpreadsheetText(getCell(row, headers, "Category"));
    const sellingPrice = toNumber(getCell(row, headers, "Product Price"));
    const totalQuantitySold = toNumber(getCell(row, headers, "Total Quantity Sold"));
    const rowErrors: HistoricalImportIssue[] = [];

    if (!productId) {
      rowErrors.push(
        issue(
          "MISSING_PRODUCT_ID",
          "error",
          workbookYear,
          rowNumber,
          null,
          "Product ID is required."
        )
      );
    }

    if (productId && products.has(productId)) {
      rowErrors.push(
        issue(
          "DUPLICATE_PRODUCT_ID",
          "error",
          workbookYear,
          rowNumber,
          productId,
          `Product ID ${productId} appears more than once in the workbook.`
        )
      );
    }

    if (!productName) {
      rowErrors.push(
        issue(
          "MISSING_PRODUCT_NAME",
          "error",
          workbookYear,
          rowNumber,
          productId || null,
          "Product name is required."
        )
      );
    }

    if (!category) {
      rowErrors.push(
        issue(
          "MISSING_CATEGORY",
          "error",
          workbookYear,
          rowNumber,
          productId || null,
          "Category is required."
        )
      );
    }

    if (!assertFiniteNumber(sellingPrice) || sellingPrice < 0) {
      rowErrors.push(
        issue(
          "INVALID_PRODUCT_PRICE",
          "error",
          workbookYear,
          rowNumber,
          productId || null,
          "Product price must be a finite non-negative number."
        )
      );
    }

    const monthlyQuantities: number[] = [];

    MONTH_HEADERS.forEach((month) => {
      const cellValue = getCell(row, headers, month);
      const quantity = toNumber(cellValue);

      if (cellValue === null || cellValue === "") {
        rowErrors.push(
          issue(
            "BLANK_MONTH_VALUE",
            "error",
            workbookYear,
            rowNumber,
            productId || null,
            `${month} quantity is blank.`
          )
        );
        return;
      }

      if (!assertFiniteNumber(quantity)) {
        rowErrors.push(
          issue(
            "INVALID_MONTH_VALUE",
            "error",
            workbookYear,
            rowNumber,
            productId || null,
            `${month} quantity must be numeric.`
          )
        );
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 0) {
        rowErrors.push(
          issue(
            "INVALID_MONTH_QUANTITY",
            "error",
            workbookYear,
            rowNumber,
            productId || null,
            `${month} quantity must be a non-negative integer.`
          )
        );
        return;
      }

      monthlyQuantities.push(quantity);
    });

    if (rowErrors.length > 0) {
      issues.push(...rowErrors);
      return;
    }

    const computedTotal = monthlyQuantities.reduce((sum, value) => sum + value, 0);

    if (assertFiniteNumber(totalQuantitySold) && computedTotal !== totalQuantitySold) {
      issues.push(
        issue(
          "TOTAL_QUANTITY_MISMATCH",
          "warning",
          workbookYear,
          rowNumber,
          productId,
          `Jan-Dec total ${computedTotal} does not match Total Quantity Sold ${totalQuantitySold}.`
        )
      );
    }

    products.set(productId, {
      category,
      points: monthlyQuantities.map((quantitySold, monthIndex) => ({
        category,
        period: periodFor(workbookYear, monthIndex),
        productId,
        productName,
        sellingPrice,
        quantitySold
      })),
      productId,
      productName,
      sellingPrice,
      row: rowNumber,
      totalQuantitySold: assertFiniteNumber(totalQuantitySold) ? totalQuantitySold : null
    });
  });

  return {
    issues,
    productRowsFound: dataRows.length,
    products,
    sourcePath,
    workbookYear
  } satisfies ParsedWorkbook;
}
