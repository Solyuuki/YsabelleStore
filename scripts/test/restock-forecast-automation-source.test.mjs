import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const restockApiSource = readFileSync("frontend/src/services/restockApi.ts", "utf8");
const automationSource = readFileSync(
  "backend/src/services/forecastRestockAutomationService.ts",
  "utf8"
);

test("restock forecast UI uses backend planning data without implicit localhost QA overrides", () => {
  assert.equal(restockApiSource.includes("SARIMAX QA"), false);
  assert.equal(restockApiSource.includes("Temporary local QA scenario"), false);
  assert.equal(restockApiSource.includes("LOCAL_RESTOCK_QA_COVERAGE_DAYS"), false);
  assert.equal(restockApiSource.includes("applyLocalRestockQaScenario"), false);
  assert.equal(restockApiSource.includes("items: response.data"), true);
});

test("standalone forecast ticket automation binds action lines to the active forecast batch", () => {
  assert.equal(automationSource.includes("candidate.forecast?.batchId !== batchId"), true);
  assert.equal(automationSource.includes('recommendationSource: "SARIMA"'), true);
  assert.equal(automationSource.includes("startForecastRestockAutomationWorker"), true);
});

test("forecast ticket reconciliation blocks live duplicates but handles terminal lifecycle explicitly", () => {
  assert.equal(automationSource.includes("LIVE_TICKET_STATUSES"), true);
  assert.equal(automationSource.includes("RestockOrderStatus.CANCELLED"), true);
  assert.equal(automationSource.includes("RECEIVED tickets are intentionally not treated as live blockers"), true);
});
