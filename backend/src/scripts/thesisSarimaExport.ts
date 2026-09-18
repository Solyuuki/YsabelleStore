import fs from "node:fs/promises";
import path from "node:path";

import { assessSarimaEligibility } from "../modules/forecasting/effective-sales.service.js";
import { loadForecastInput } from "../modules/forecasting/forecast.service.js";

const outputDirectory = path.resolve("testing/thesis-validation/data");
const csvPath = path.join(outputDirectory, "effective_monthly_sales.csv");
const metadataPath = path.join(outputDirectory, "export_metadata.json");

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const input = await loadForecastInput();
const series = input.allProducts.map((product) => ({
  product,
  eligibility: assessSarimaEligibility(
    product.productId,
    product.productName,
    product.historical.map((point) => ({
      period: point.period,
      quantitySold: point.quantitySold,
      source: "IMPORTED_HISTORICAL" as const
    }))
  )
}));

await fs.mkdir(outputDirectory, { recursive: true });

const headers = [
  "product_id",
  "product_name",
  "category",
  "period",
  "quantity_sold",
  "source",
  "eligibility_status",
  "eligibility_reason",
  "observation_count",
  "zero_months"
];

const rows = series.flatMap(({ product, eligibility }) =>
  product.historical.map((point) => [
    product.productId,
    product.productName,
    product.category,
    point.period,
    point.quantitySold,
    input.source,
    eligibility.status,
    eligibility.reason,
    eligibility.observationCount,
    eligibility.zeroMonths
  ])
);

const csv = [
  headers.join(","),
  ...rows.map((row) => row.map((value) => csvCell(value)).join(","))
].join("\n");

await fs.writeFile(csvPath, `${csv}\n`, "utf8");

const metadata = {
  generatedAt: new Date().toISOString(),
  forecastInputSource: input.source,
  productCount: series.length,
  rowCount: rows.length,
  productsByEligibility: Object.fromEntries(
    ["ELIGIBLE", "LIMITED_HISTORY", "INSUFFICIENT_HISTORY", "DATA_QUALITY_ISSUE"].map(
      (status) => [
        status,
        series.filter(({ eligibility }) => eligibility.status === status).length
      ]
    )
  ),
  sourceRule: `Forecast source selected by the application: ${input.source}.`,
  validation: input.validation,
  output: path.relative(process.cwd(), csvPath)
};

await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
console.log(JSON.stringify(metadata, null, 2));

if (rows.length === 0) {
  throw new Error("Production forecast input contained no historical observations for thesis validation.");
}
