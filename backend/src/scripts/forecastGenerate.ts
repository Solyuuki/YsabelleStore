import { generateForecastBatch } from "../modules/forecasting/forecast.service.js";

const result = await generateForecastBatch({ force: true });

console.log(JSON.stringify(result.generation, null, 2));

if (result.generation.failedProducts > 0 || result.generation.nanCount > 0) {
  process.exitCode = 1;
}
