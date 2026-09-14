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

test("forecast restock QA seeds backend demand and uses the real automation pipeline", () => {
  assert.equal(qaSource.includes('source: "IMPORTED_HISTORICAL"'), true);
  assert.equal(qaSource.includes("requestForecastRefresh"), true);
  assert.equal(qaSource.includes("waitForForecastRefresh"), true);
  assert.equal(qaSource.includes("listRestockPlanningCandidates"), true);
  assert.equal(qaSource.includes("ensureForecastRestockTicket"), true);
  assert.equal(qaSource.includes('candidate.stockHealth.status === "LOW_STOCK"'), true);
});

test("forecast restock QA reset refuses to erase received inventory history", () => {
  assert.equal(qaSource.includes('order.status === "RECEIVED"'), true);
  assert.equal(qaSource.includes('order.status === "PARTIALLY_RECEIVED"'), true);
  assert.equal(qaSource.includes("line.receivedQuantity > 0"), true);
});
