import { validateHistoricalSales } from "../modules/forecasting/forecast.service.js";

const result = await validateHistoricalSales();
const totalMismatchWarnings = result.validation.warnings.filter(
  (issue) => issue.code === "TOTAL_QUANTITY_MISMATCH"
).length;
const identityConflicts = result.validation.warnings.filter((issue) =>
  ["PRODUCT_NAME_CONFLICT", "CATEGORY_CONFLICT"].includes(issue.code)
).length;
const missingProducts = result.validation.warnings.filter(
  (issue) => issue.code === "PRODUCT_MISSING_IN_YEAR"
).length;

console.log(
  JSON.stringify(
    {
      errors: result.validation.errors.length,
      historicalObservationsImported: result.validation.importedObservations,
      identityConflicts,
      matchedProducts: result.validation.importedProducts,
      missingProducts,
      products2024: result.workbookProductCounts.products2024,
      products2025: result.workbookProductCounts.products2025,
      rejectedProducts: result.validation.skippedProducts,
      totalMismatchWarnings,
      valid: result.validation.valid,
      warnings: result.validation.warnings.length
    },
    null,
    2
  )
);

if (!result.validation.valid) {
  process.exitCode = 1;
}
