import { generateForecastBatch } from "../modules/forecasting/forecast.service.js";
import {
  addMonths,
  getActiveForecastMonth,
  monthStartIso
} from "../modules/forecasting/forecast-window.js";

const result = await generateForecastBatch();
const activeMonth = getActiveForecastMonth();
const expectedFirstMonth = monthStartIso(activeMonth);
const expectedLastMonth = monthStartIso(addMonths(activeMonth, 11));

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
  smoke.firstForecastMonth !== expectedFirstMonth ||
  smoke.lastForecastMonth !== expectedLastMonth
) {
  process.exitCode = 1;
}
