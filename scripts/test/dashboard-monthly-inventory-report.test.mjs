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

test("dashboard shows a compact whole-batch summary, never one featured product", () => {
  assert.match(dashboardPage, /Monthly inventory recommendation/);
  assert.match(dashboardPage, /Products in plan \/ review/);
  assert.match(dashboardPage, /Monthly restock plan/);
  assert.match(dashboardPage, /\{nextRestockMonth\} · Next restock preview/);
  assert.match(dashboardPage, /label="To restock"/);
  assert.match(dashboardPage, /label="Suggested units"/);
  assert.match(dashboardPage, /label="Other reviews"/);
  assert.match(dashboardPage, /operations\.restock\.restockProducts/);
  assert.match(dashboardPage, /operations\.restock\.otherReviewProducts/);
  assert.match(dashboardPage, /Review full restock plan/);
  assert.match(dashboardPage, /onNavigate\("\/reports"\)/);
  assert.match(dashboardPage, /Estimated next-month replenishment/);
  assert.match(dashboardPage, /Future-month preview only/);
  assert.doesNotMatch(dashboardPage, /Products requiring action/);
  assert.doesNotMatch(dashboardPage, /Highest priority this month|topPriority|monthlyActionLabel/);
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

test("backend batch counts use the full action set rather than the five-item preview", async () => {
  const service = await readFile(
    new URL("../../backend/src/services/dashboardService.ts", import.meta.url),
    "utf8"
  );
  const api = await readFile(
    new URL("../../frontend/src/services/dashboardApi.ts", import.meta.url),
    "utf8"
  );
  const helper = await readFile(
    new URL("../../backend/src/services/dashboardMonthlyRestockSummary.ts", import.meta.url),
    "utf8"
  );

  assert.match(service, /summarizeMonthlyRestockActions\(actions\)/);
  assert.match(service, /actions\.slice\(0, DASHBOARD_ACTION_LIMIT\)/);
  assert.ok(
    service.indexOf("summarizeMonthlyRestockActions(actions)") <
      service.indexOf("actions.slice(0, DASHBOARD_ACTION_LIMIT)")
  );
  assert.match(service, /restockProducts: monthlyBatchSummary\.restockProducts/);
  assert.match(service, /otherReviewProducts: monthlyBatchSummary\.otherReviewProducts/);
  assert.match(service, /suggestedUnits: monthlyBatchSummary\.suggestedUnits/);
  assert.match(api, /restockProducts: number/);
  assert.match(api, /otherReviewProducts: number/);
  assert.match(helper, /action\.actionType === "RESTOCK"/);
  assert.match(helper, /actions\.length - restockProducts/);
});

test("monthly batch stays readable in retail dark mode without changing light mode", async () => {
  const theme = await readFile(
    new URL("../../frontend/src/styles/theme-retail.css", import.meta.url),
    "utf8"
  );
  assert.match(theme, /:root\.dark \.app-shell-ambient \.retail-dashboard-page/);
  assert.match(theme, /\.ys-dashboard-monthly-batch/);
  assert.match(theme, /\.ys-dashboard-monthly-batch-stat/);
  assert.match(theme, /\.ys-dashboard-monthly-batch__badge/);
  assert.match(theme, /color: #e7dfff !important/);
});
