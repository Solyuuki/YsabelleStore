/**
 * Read-only QA bridge for historical backtesting.
 * Reads the canonical 2024/2025 workbook parser, not Prisma or the live DB.
 * Emits just the validated historical product series as JSON to stdout.
 * DO NOT include reconstructed 2026 comparison workbooks as held-out actuals.
 */
import { loadHistoricalSalesData } from "../modules/forecasting/historical-sales.service.js";

async function main() {
  const data = await loadHistoricalSalesData();
  if (!data.validation.valid) {
    console.error(
      `[qa] Historical workbook validation failed with ${data.validation.errors.length} errors.`
    );
    process.exitCode = 1;
    return;
  }

  console.error(
    `[qa] Read-only 2024–2025 workbook export: ${data.products.length} products; ${data.validation.warnings.length} warnings.`
  );
  process.stdout.write(
    JSON.stringify({
      source: "CANONICAL_2024_2025_WORKBOOKS",
      products: data.products.map((product) => ({
        productId: product.productId,
        productName: product.productName,
        category: product.category,
        sellingPrice: product.sellingPrice,
        historical: product.historical
      }))
    })
  );
}

void main().catch((error: unknown) => {
  console.error("[qa] Historical export failed:", error);
  process.exitCode = 1;
});
