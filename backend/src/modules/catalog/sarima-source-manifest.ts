const EXPECTED_SARIMA_PRODUCT_COUNT = 472;
const IDENTITY_CONFLICT_CODES = new Set([
  "PRODUCT_NAME_CONFLICT",
  "CATEGORY_CONFLICT",
  "PRODUCT_MISSING_IN_YEAR"
]);

export type SarimaManifestIssue = {
  code: string;
};

export type SarimaManifestInput = {
  products: Array<{
    category: string;
    productId: string;
    productName: string;
  }>;
  validation: {
    errors: SarimaManifestIssue[];
    warnings: SarimaManifestIssue[];
  };
  workbookProductCounts: {
    products2024: number;
    products2025: number;
  };
};

export type SarimaSourceIdentity = {
  category: string;
  productCode: string;
  sourceName: string;
  sourceNameNormalized: string;
  yearsPresent: [2024, 2025];
};

export function normalizeSarimaSourceName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function expectedProductCodes() {
  return Array.from(
    { length: EXPECTED_SARIMA_PRODUCT_COUNT },
    (_, index) => `P${String(index + 1).padStart(3, "0")}`
  );
}

function assertAnnualWorkbookCounts(input: SarimaManifestInput) {
  const { products2024, products2025 } = input.workbookProductCounts;

  if (
    products2024 !== EXPECTED_SARIMA_PRODUCT_COUNT ||
    products2025 !== EXPECTED_SARIMA_PRODUCT_COUNT
  ) {
    throw new Error(
      `Expected exactly 472 products in each annual SARIMA workbook; received 2024=${products2024}, 2025=${products2025}.`
    );
  }
}

function assertWorkbookValidation(input: SarimaManifestInput) {
  if (input.validation.errors.length > 0) {
    const codes = input.validation.errors.map((issue) => issue.code).join(", ");
    throw new Error(
      `Cannot build SARIMA source manifest from invalid historical workbooks: ${codes}.`
    );
  }

  const conflicts = input.validation.warnings
    .map((issue) => issue.code)
    .filter((code) => IDENTITY_CONFLICT_CODES.has(code));

  if (conflicts.length > 0) {
    throw new Error(
      `Cannot build SARIMA source manifest while identity warnings remain: ${[...new Set(conflicts)].join(", ")}.`
    );
  }
}

function assertCompleteProductCodeSet(input: SarimaManifestInput) {
  const expectedCodes = expectedProductCodes();
  const expected = new Set(expectedCodes);
  const actualCodes = input.products.map((product) => product.productId);
  const actual = new Set(actualCodes);

  const hasUnexpectedCode = actualCodes.some((code) => !expected.has(code));
  const hasMissingCode = expectedCodes.some((code) => !actual.has(code));
  const hasDuplicateCode = actual.size !== actualCodes.length;

  if (
    input.products.length !== EXPECTED_SARIMA_PRODUCT_COUNT ||
    hasUnexpectedCode ||
    hasMissingCode ||
    hasDuplicateCode
  ) {
    throw new Error("Expected source codes P001 through P472 exactly once.");
  }
}

export function buildSarimaSourceManifest(input: SarimaManifestInput): SarimaSourceIdentity[] {
  assertAnnualWorkbookCounts(input);
  assertWorkbookValidation(input);
  assertCompleteProductCodeSet(input);

  return [...input.products]
    .sort((left, right) => left.productId.localeCompare(right.productId))
    .map((product) => ({
      category: product.category,
      productCode: product.productId,
      sourceName: product.productName,
      sourceNameNormalized: normalizeSarimaSourceName(product.productName),
      yearsPresent: [2024, 2025]
    }));
}
