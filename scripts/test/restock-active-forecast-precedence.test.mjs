import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const planningSource = await readFile(
  new URL("../../backend/src/services/restockPlanningService.ts", import.meta.url),
  "utf8"
);
const demandSource = await readFile(
  new URL("../../backend/src/services/restockDemandForecastService.ts", import.meta.url),
  "utf8"
);

test("restock planning is independent from owner demand forecast persistence", () => {
  assert.equal(planningSource.includes("forecastBatchCache"), false);
  assert.equal(planningSource.includes("sarimaSourceProductMapping"), false);
  assert.equal(planningSource.includes("buildRestockForecastDecision"), false);
  assert.equal(planningSource.includes("getEffectiveMonthlySeries"), false);
  assert.match(planningSource, /loadOperationalPosSales/);
  assert.match(planningSource, /buildOperationalRestockForecast/);
});

test("operational restock forecast reads completed POS sales by actual product id", () => {
  assert.match(demandSource, /prisma\.saleItem\.findMany/);
  assert.match(demandSource, /productId: \{ in: uniqueProductIds \}/);
  assert.match(demandSource, /status: "COMPLETED"/);
  assert.equal(demandSource.includes("forecastBatchCache"), false);
  assert.equal(demandSource.includes("SARIMA"), false);
});
