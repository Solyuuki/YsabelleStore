import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const restockApiSource = readFileSync("frontend/src/services/restockApi.ts", "utf8");
const automationSource = readFileSync("backend/src/services/restockAutomationService.ts", "utf8");
const forecastPersistenceSource = readFileSync(
  "backend/src/modules/forecasting/forecast-persistence.service.ts",
  "utf8"
);
const serverSource = readFileSync("backend/src/server.ts", "utf8");

test("restock UI uses backend planning data without localhost QA", () => {
  assert.equal(restockApiSource.includes("SARIMAX QA"), false);
  assert.equal(restockApiSource.includes("Temporary local QA scenario"), false);
  assert.equal(restockApiSource.includes("LOCAL_RESTOCK_QA_COVERAGE_DAYS"), false);
  assert.equal(restockApiSource.includes("applyLocalRestockQaScenario"), false);
  assert.equal(restockApiSource.includes("items: response.data"), true);
});

test("automation consumes actionable operational restock planning instead of forecast batches", () => {
  assert.match(automationSource, /listRestockPlanningCandidates/);
  assert.match(automationSource, /includeZero: false/);
  assert.equal(automationSource.includes("candidate.forecast?.batchId"), false);
  assert.equal(automationSource.includes("forecastBatchCache"), false);
  assert.equal(automationSource.includes('recommendationSource: "SARIMA"'), false);
  assert.match(automationSource, /candidate\.recommendationSource !== "LOW_STOCK"/);
  assert.match(automationSource, /candidate\.recommendationSource !== "TARGET_STOCK"/);
});

test("owner demand forecast persistence does not trigger restock ticket generation", () => {
  assert.equal(forecastPersistenceSource.includes("ensureForecastRestockTicket"), false);
  assert.equal(forecastPersistenceSource.includes("restockAutomationService"), false);
});

test("server starts the independent operational restock retry worker", () => {
  assert.match(serverSource, /startRestockAutomationWorker\(\);/);
  assert.match(serverSource, /restockAutomationService\.js/);
});

test("operational automation preserves duplicate and lifecycle safeguards", () => {
  assert.equal(automationSource.includes("LIVE_TICKET_STATUSES"), true);
  assert.equal(automationSource.includes("RestockOrderStatus.CANCELLED"), true);
  assert.equal(automationSource.includes("RestockOrderStatus.RECEIVED"), true);
  assert.match(automationSource, /AutomatedRestock:/);
});
