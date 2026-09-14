import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageSource = readFileSync("package.json", "utf8");
const qaSource = readFileSync("backend/src/scripts/qaForecastRestock.ts", "utf8");

test("forecast restock QA commands are explicit opt-in scripts", () => {
  const pkg = JSON.parse(packageSource);
  assert.equal(
    pkg.scripts["qa:forecast-restock:seed"],
    "node --env-file=.env --import tsx backend/src/scripts/qaForecastRestock.ts seed"
  );
  assert.equal(
    pkg.scripts["qa:forecast-restock:reset"],
    "node --env-file=.env --import tsx backend/src/scripts/qaForecastRestock.ts reset"
  );
});

test("forecast restock QA lowers real stock instead of fabricating historical demand", () => {
  assert.equal(qaSource.includes('source: "IMPORTED_HISTORICAL"'), false);
  assert.equal(qaSource.includes("HISTORY_MONTHS"), false);
  assert.equal(qaSource.includes("applyStockAdjustment"), true);
  assert.equal(qaSource.includes('direction: "OUT"'), true);
  assert.equal(qaSource.includes("computeStockStatus"), true);
  assert.equal(qaSource.includes('inventoryStatus !== "LOW_STOCK"'), true);
});

test("forecast restock QA uses the real forecast and automation pipeline", () => {
  assert.equal(qaSource.includes("waitForForecastRefresh"), true);
  assert.equal(qaSource.includes("force: true"), true);
  assert.equal(qaSource.includes("listRestockPlanningCandidates"), true);
  assert.equal(qaSource.includes("ensureForecastRestockTicket"), true);
  assert.equal(qaSource.includes("candidate.incomingStock > 0"), true);
  assert.equal(qaSource.includes("candidate.forecast?.batchId === baselineBatchId"), true);
});

test("forecast restock QA reset restores stock and refuses unsafe history rewrites", () => {
  assert.equal(qaSource.includes('order.status === RestockOrderStatus.RECEIVED'), true);
  assert.equal(qaSource.includes('order.status === RestockOrderStatus.PARTIALLY_RECEIVED'), true);
  assert.equal(qaSource.includes("line.receivedQuantity > 0"), true);
  assert.equal(qaSource.includes("unexpectedMovements.length > 0"), true);
  assert.equal(qaSource.includes("quantityRemaining: batch.quantityRemaining"), true);
  assert.equal(qaSource.includes("quantityOnHand: product.inventory.quantityOnHand"), true);
});

test("forecast restock QA can clean snapshots produced by the old demand-seeding fixture", () => {
  assert.equal(qaSource.includes("resetLegacySnapshot"), true);
  assert.equal(qaSource.includes("LEGACY_QA_PREFIX"), true);
  assert.equal(qaSource.includes("historicalMonthlySales.deleteMany"), true);
});
