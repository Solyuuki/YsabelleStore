import fs from "node:fs";

import type {
  HistoricalImportIssue,
  HistoricalImportValidation,
  ProductHistoricalSeries
} from "./forecast.types.js";
import { resolveRepositoryPath } from "./repository-paths.js";
import {
  parseHistoricalWorkbook,
  type ParsedWorkbookProduct
} from "./spreadsheet-parser.service.js";

const HISTORICAL_2024_PATH = "data/forecasting/historical-sales-2024.xlsx";
const HISTORICAL_2025_PATH = "data/forecasting/historical-sales-2025.xlsx";

export type HistoricalSalesFallbackResult =
  | { available: true; data: HistoricalSalesImport }
  | { available: false; missingYears: number[] };

export type HistoricalSalesImport = {
  products: ProductHistoricalSeries[];
  validation: HistoricalImportValidation;
  workbookProductCounts: {
    products2024: number;
    products2025: number;
  };
};

function makeIssue(
  code: string,
  severity: "warning" | "error",
  productId: string,
  message: string
): HistoricalImportIssue {
  return {
    code,
    message,
    productId,
    row: null,
    severity,
    workbookYear: null
  };
}

function sameProductIdentity(left: ParsedWorkbookProduct, right: ParsedWorkbookProduct) {
  return {
    categoryMatches: left.category === right.category,
    nameMatches: left.productName === right.productName
  };
}

function hasContinuousSeries(product: ProductHistoricalSeries) {
  const expected = [
    ...Array.from({ length: 12 }, (_, index) => `2024-${String(index + 1).padStart(2, "0")}`),
    ...Array.from({ length: 12 }, (_, index) => `2025-${String(index + 1).padStart(2, "0")}`)
  ];

  return expected.every((period, index) => product.historical[index]?.period === period);
}

export async function loadHistoricalSalesData(): Promise<HistoricalSalesImport> {
  const workbook2024 = await parseHistoricalWorkbook(
    resolveRepositoryPath(HISTORICAL_2024_PATH),
    2024
  );
  const workbook2025 = await parseHistoricalWorkbook(
    resolveRepositoryPath(HISTORICAL_2025_PATH),
    2025
  );
  const warnings: HistoricalImportIssue[] = [
    ...workbook2024.issues.filter((issue) => issue.severity === "warning"),
    ...workbook2025.issues.filter((issue) => issue.severity === "warning")
  ];
  const errors: HistoricalImportIssue[] = [
    ...workbook2024.issues.filter((issue) => issue.severity === "error"),
    ...workbook2025.issues.filter((issue) => issue.severity === "error")
  ];
  const products: ProductHistoricalSeries[] = [];
  const allProductIds = new Set([...workbook2024.products.keys(), ...workbook2025.products.keys()]);

  for (const productId of [...allProductIds].sort()) {
    const product2024 = workbook2024.products.get(productId);
    const product2025 = workbook2025.products.get(productId);

    if (!product2024 || !product2025) {
      warnings.push(
        makeIssue(
          "PRODUCT_MISSING_IN_YEAR",
          "warning",
          productId,
          `Product ${productId} is missing from ${product2024 ? "2025" : "2024"} and was excluded from matched forecasting.`
        )
      );
      continue;
    }

    const identity = sameProductIdentity(product2024, product2025);

    if (!identity.nameMatches) {
      warnings.push(
        makeIssue(
          "PRODUCT_NAME_CONFLICT",
          "warning",
          productId,
          `Product name differs between 2024 (${product2024.productName}) and 2025 (${product2025.productName}).`
        )
      );
    }

    if (!identity.categoryMatches) {
      warnings.push(
        makeIssue(
          "CATEGORY_CONFLICT",
          "warning",
          productId,
          `Category differs between 2024 (${product2024.category}) and 2025 (${product2025.category}).`
        )
      );
    }

    const historicalProduct = {
      category: product2025.category || product2024.category,
      historical: [...product2024.points, ...product2025.points],
      productId,
      productName: product2025.productName || product2024.productName,
      sellingPrice: product2025.sellingPrice
    };

    if (!hasContinuousSeries(historicalProduct)) {
      errors.push(
        makeIssue(
          "NON_CONTINUOUS_MONTHLY_SERIES",
          "error",
          productId,
          `Product ${productId} does not have a continuous 2024-01 through 2025-12 series.`
        )
      );
      continue;
    }

    products.push(historicalProduct);
  }

  const importedObservations = products.reduce(
    (sum, product) => sum + product.historical.length,
    0
  );

  return {
    products,
    validation: {
      errors,
      importedObservations,
      importedProducts: products.length,
      skippedProducts: allProductIds.size - products.length,
      valid: errors.length === 0,
      warnings
    },
    workbookProductCounts: {
      products2024: workbook2024.products.size,
      products2025: workbook2025.products.size
    }
  };
}

export async function loadHistoricalSalesFallbackData(): Promise<HistoricalSalesFallbackResult> {
  const workbookPaths = [
    { sourcePath: resolveRepositoryPath(HISTORICAL_2024_PATH), year: 2024 },
    { sourcePath: resolveRepositoryPath(HISTORICAL_2025_PATH), year: 2025 }
  ];
  const missingYears = workbookPaths
    .filter((workbook) => !fs.existsSync(workbook.sourcePath))
    .map((workbook) => workbook.year);

  if (missingYears.length > 0) {
    return { available: false, missingYears };
  }

  return { available: true, data: await loadHistoricalSalesData() };
}
