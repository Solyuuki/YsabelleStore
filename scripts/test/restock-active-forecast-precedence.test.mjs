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
const inventoryForecastSource = await readFile(
  new URL("../../backend/src/services/inventoryForecastSourceService.ts", import.meta.url),
  "utf8"
);

test("restock planning prefers the active persisted forecast and retains POS only as fallback", () => {
  assert.match(planningSource, /loadActiveInventoryForecasts/);
  assert.match(planningSource, /buildRestockForecastDecision/);
  assert.match(planningSource, /loadOperationalPosSales/);
  assert.match(planningSource, /buildOperationalRestockForecast/);
  assert.match(planningSource, /RESTOCK_POS_FALLBACK/);
  assert.match(planningSource, /recommendationSource: "SARIMA"/);
});

test("active inventory forecast source reads the persisted forecast batch by canonical product id", () => {
  assert.match(inventoryForecastSource, /forecastBatchCache\.findFirst/);
  assert.match(inventoryForecastSource, /isActive: true/);
  assert.match(inventoryForecastSource, /status: "READY"/);
  assert.match(inventoryForecastSource, /forecastProductResult\.findMany/);
  assert.match(inventoryForecastSource, /sourceProductId: \{ in: uniqueProductIds \}/);
});

test("POS fallback remains based on completed operational sales and does not masquerade as SARIMA", () => {
  assert.match(demandSource, /prisma\.saleItem\.findMany/);
  assert.match(demandSource, /productId: \{ in: uniqueProductIds \}/);
  assert.match(demandSource, /status: "COMPLETED"/);
  assert.equal(demandSource.includes("forecastBatchCache"), false);
  assert.equal(demandSource.includes("SARIMA"), false);
});
