import { generateForecastBatch } from "../modules/forecasting/forecast.service.js";

const result = await generateForecastBatch();

const firstProduct = result.products[0];
const smoke = {
  forecastPointCount: result.generation.forecastPointsGenerated,
  firstForecastMonth: result.generation.firstForecastMonth,
  firstProductForecastRows: firstProduct?.forecast.length ?? 0,
  generatedAt: result.generation.generatedAt,
  lastForecastMonth: result.generation.lastForecastMonth,
  productCount: result.products.length
};

console.log(JSON.stringify(smoke, null, 2));

if (
  smoke.productCount <= 0 ||
  smoke.firstProductForecastRows !== 12 ||
  smoke.firstForecastMonth !== "2026-01" ||
  smoke.lastForecastMonth !== "2026-12"
) {
  process.exitCode = 1;
}
