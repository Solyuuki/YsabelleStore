import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const automation = readFileSync("backend/src/services/restockAutomationService.ts", "utf8");
const panel = readFileSync("frontend/src/components/reports/RestockForecastPanel.tsx", "utf8");
const dashboard = readFileSync("frontend/src/pages/DashboardPage.tsx", "utf8");
const service = readFileSync("backend/src/services/dashboardService.ts", "utf8");

test("monthly creation requires activation and a durable, recoverable claim", () => {
  assert.match(automation, /monthlyRestockCycle\(cycleNow\)\.automationEnabled/);
  assert.match(automation, /claimMonthlyRun\(batch\.monthKey\)/);
  assert.match(automation, /RESTOCK_MONTH_NO_ACTION/);
  assert.match(automation, /RESTOCK_MONTH_RETRY/);
  assert.match(automation, /P2002/);
  assert.match(automation, /findMonthlyBatch\(monthOrders, batch\)/);
});

test("forecast displays upcoming date instead of a false order-today instruction", () => {
  assert.doesNotMatch(panel, /Place the order by/);
  assert.match(panel, /Next Restock/);
  assert.match(panel, /scheduledRestockAt/);
  assert.match(panel, /nextMonthRestock\.estimatedRestock/);
});

test("dashboard differentiates planned restock from high-risk shortages", () => {
  assert.match(service, /scheduledRestockAt: nextMonthlyRestockDate\(now\)/);
  assert.match(dashboard, /Next restock preview/);
  assert.match(service, /candidate\.nextMonthRestock\.estimatedRestock/);
  assert.match(dashboard, /High \/ critical/);
});
