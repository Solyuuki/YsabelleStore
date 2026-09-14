import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const restockApiSource = readFileSync("frontend/src/services/restockApi.ts", "utf8");
const automationSource = readFileSync(
  "backend/src/services/forecastRestockAutomationService.ts",
  "utf8"
);
const forecastPersistenceSource = readFileSync(
  "backend/src/modules/forecasting/forecast-persistence.service.ts",
  "utf8"
);
const serverSource = readFileSync("backend/src/server.ts", "utf8");

test("restock UI uses backend forecast data without localhost QA", () => {
  assert.equal(restockApiSource.includes("SARIMAX QA"), false);
  assert.equal(restockApiSource.includes("Temporary local QA scenario"), false);
  assert.equal(restockApiSource.includes("LOCAL_RESTOCK_QA_COVERAGE_DAYS"), false);
  assert.equal(restockApiSource.includes("applyLocalRestockQaScenario"), false);
  assert.equal(restockApiSource.includes("items: response.data"), true);
});

test("automation binds lines to the active forecast batch", () => {
  assert.equal(automationSource.includes("candidate.forecast?.batchId !== batchId"), true);
  assert.equal(automationSource.includes('recommendationSource: "SARIMA"'), true);
  assert.equal(automationSource.includes("startForecastRestockAutomationWorker"), true);
});

test("automation uses an event trigger plus a retry worker", () => {
  assert.match(forecastPersistenceSource, /ensureForecastRestockTicket\(activated\.id\)/);
  assert.match(serverSource, /startForecastRestockAutomationWorker\(\);/);
});

test("reconciliation handles live and terminal ticket states", () => {
  assert.equal(automationSource.includes("LIVE_TICKET_STATUSES"), true);
  assert.equal(automationSource.includes("RestockOrderStatus.CANCELLED"), true);
  assert.match(automationSource, /RECEIVED tickets are intentionally not treated as live blockers/);
});
