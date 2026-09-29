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

test("automation consumes the unified restock planning result without reading forecast persistence directly", () => {
  assert.match(automationSource, /listRestockPlanningCandidates/);
  assert.match(automationSource, /includeZero: false/);
  assert.equal(automationSource.includes("candidate.forecast?.batchId"), false);
  assert.equal(automationSource.includes("forecastBatchCache"), false);
  assert.match(automationSource, /RestockRecommendationSource\.SARIMA/);
  assert.match(
    automationSource,
    /candidate\.recommendationSource !== RestockRecommendationSource\.LOW_STOCK/
  );
  assert.match(
    automationSource,
    /candidate\.recommendationSource !== RestockRecommendationSource\.TARGET_STOCK/
  );
});

test("forecast persistence synchronizes forecast-derived sales targets without directly creating restock tickets", () => {
  assert.match(forecastPersistenceSource, /ensureForecastDerivedSalesTargets/);
  assert.equal(forecastPersistenceSource.includes("ensureForecastRestockTicket"), false);
  assert.equal(forecastPersistenceSource.includes("restockAutomationService"), false);
});

test("server starts the independent operational restock retry worker", () => {
  assert.match(serverSource, /startRestockAutomationWorker\(\);/);
  assert.match(serverSource, /restockAutomationService\.js/);
});

test("operational automation preserves monthly duplicate and lifecycle safeguards", () => {
  assert.equal(automationSource.includes("EXTENDABLE_BATCH_STATUSES"), true);
  assert.equal(automationSource.includes("RestockOrderStatus.CANCELLED"), true);
  assert.equal(automationSource.includes("RestockOrderStatus.PARTIALLY_RECEIVED"), true);
  assert.equal(automationSource.includes("RestockOrderStatus.RECEIVED"), true);
  assert.match(automationSource, /AutomatedRestockMonth:/);
  assert.match(automationSource, /AutomatedRestock:/);
});


test("automated monthly restock stays as an owner-review draft until explicit approval", () => {
  assert.equal(automationSource.includes("approveRestockOrder"), false);
  assert.match(automationSource, /Owner approval is required before Receiving/);
  assert.match(automationSource, /RestockOrderStatus\.DRAFT/);
  assert.match(automationSource, /recommended inventory plan/i);
});
