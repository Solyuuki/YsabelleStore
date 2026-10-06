import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [dashboardPage, restockForecastPanel] = await Promise.all([
  readFile(new URL("../../frontend/src/pages/DashboardPage.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../../frontend/src/components/reports/RestockForecastPanel.tsx", import.meta.url),
    "utf8"
  )
]);

test("dashboard keeps monthly inventory recommendations compact", () => {
  assert.match(dashboardPage, /Monthly inventory recommendation/);
  assert.match(dashboardPage, /Products requiring action/);
  assert.match(dashboardPage, /Highest priority this month/);
  assert.match(dashboardPage, /View \{reportMonth\} report/);
  assert.doesNotMatch(dashboardPage, /operations\.restock\.actions\.map/);
});

test("reports exposes a complete paginated live monthly inventory report", () => {
  assert.match(restockForecastPanel, /inventory recommendation report/);
  assert.match(restockForecastPanel, /Live month/);
  assert.match(restockForecastPanel, /Products analyzed/);
  assert.match(restockForecastPanel, /Monthly product report/);
  assert.match(restockForecastPanel, /Reduce replenishment/);
  assert.match(restockForecastPanel, /Expiry review/);
  assert.match(restockForecastPanel, /AppPagination/);
  assert.match(restockForecastPanel, /All products are included/);
});
