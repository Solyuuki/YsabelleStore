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
  assert.equal(automationSource.includes("appendActionLinesToMonthlyBatch"), false);
  assert.equal(automationSource.includes("reconcileDraftRestockLine"), false);
  assert.equal(automationSource.includes("RestockOrderStatus.CANCELLED"), true);
  assert.match(automationSource, /monthlyOrder\.status === RestockOrderStatus\.CANCELLED/);
  assert.match(automationSource, /AutomatedRestockMonth:/);
  assert.match(automationSource, /AutomatedRestock:/);
});

test("automated monthly restock stays as an owner-review draft until explicit approval", () => {
  assert.equal(automationSource.includes("approveRestockOrder"), false);
  assert.match(automationSource, /Owner approval required/);
  assert.match(automationSource, /createRestockOrder\(/);
  assert.match(automationSource, /forecast-driven multi-product batch/i);
});

test("monthly snapshot is loaded before candidate computation and cannot be amended by the worker", () => {
  const start = automationSource.indexOf("async function runRestockAutomation()");
  const section = automationSource.slice(start, automationSource.indexOf("export async function ensureAutomatedRestockTicket", start));
  const loadSnapshot = section.indexOf("loadAutomatedTicketsForMonth(batch)");
  const loadCandidates = section.indexOf("loadOperationalActionLines()");
  assert.ok(loadSnapshot >= 0 && loadCandidates > loadSnapshot);
  assert.match(section, /if \(monthlyOrder\) \{[\s\S]*?status: monthlyOrder\.status/);
  assert.equal(section.includes("appendActionLinesToMonthlyBatch"), false);
  assert.match(section, /RestockSourceMonth:/);
});
