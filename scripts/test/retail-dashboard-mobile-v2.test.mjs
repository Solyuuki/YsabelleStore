import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const dashboard = read("frontend/src/pages/DashboardPage.tsx");
const pulse = read("frontend/src/components/dashboard/SalesPulseCard.tsx");
const css = read("frontend/src/styles/retail-dashboard-mobile.css");
const mobile = css
  .split(
    "@media (max-width: 767px), (max-height: 500px) and (orientation: landscape) and (max-width: 1024px) {"
  )[1]
  ?.split("@media (max-width: 359px) {")[0];

test("Dashboard v2 uses compact two-column KPIs without hiding real summary values", () => {
  assert.match(dashboard, /import "@\/styles\/retail-dashboard-mobile\.css"/);
  assert.match(dashboard, /ys-dashboard-kpi-grid grid gap-4 md:grid-cols-2/);
  assert.match(dashboard, /ys-dashboard-kpi-content flex min-h-40/);
  assert.match(dashboard, /ys-dashboard-alert-mobile/);
  assert.match(dashboard, /summary\.inventory\.lowStockItems/);
  assert.match(dashboard, /summary\.inventory\.outOfStockItems/);
  assert.match(dashboard, /summary\.expiry\.nearExpiryBatches/);
  assert.match(dashboard, /summary\.expiry\.expiredBatches/);
  assert.match(dashboard, /forecastStat\?\.value/);
  assert.ok(mobile, "Missing phone-only Dashboard rules");
  assert.match(
    mobile,
    /\.ys-dashboard-kpi-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(mobile, /\.ys-dashboard-kpi-content\s*\{[^}]*min-height: 114px;/);
  assert.match(
    mobile,
    /\.ys-dashboard-alert-detail,[\s\S]*?\.ys-dashboard-alert-help\s*\{\s*display: none;/
  );
  assert.match(mobile, /\.ys-dashboard-alert-mobile\s*\{\s*display: grid;/);
  assert.match(mobile, /\.ys-dashboard-kpi-grid > :last-child:nth-child\(3\)/);
});

test("Sales Pulse on phones retains four genuine metrics with legible non-truncated currencies", () => {
  for (const label of ["Actual sales", "Forecast target", "Forecast", "Transactions"]) {
    assert.ok(pulse.includes('label="' + label + '"'), "Missing " + label);
  }
  assert.match(pulse, /ys-sales-summary-grid grid gap-3 sm:grid-cols-2/);
  assert.match(pulse, /ys-sales-summary-tile__value/);
  assert.match(pulse, /ys-sales-summary-tile__value mt-1 truncate text-lg/);
  assert.match(
    mobile,
    /\.ys-sales-summary-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(
    mobile,
    /\.ys-sales-summary-tile__value\s*\{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/
  );
  assert.match(mobile, /\.ys-sales-view-tab\s*\{[^}]*min-height: 44px;/);
  assert.match(pulse, /fetchDashboardSalesCalendar\(activeMonth\)/);
  assert.match(pulse, /fetchDashboardSalesDay\(selectedDate\)/);
  assert.match(pulse, /setView\("performance"\)/);
});

test("Five-date mobile navigator preserves access to every day and full monthly view", () => {
  assert.match(pulse, /const \[mobileWindowStart, setMobileWindowStart\] = useState\(0\)/);
  assert.match(pulse, /const \[mobileMonthExpanded, setMobileMonthExpanded\] = useState\(false\)/);
  assert.match(pulse, /Math\.max\(0, \(calendar\?\.days\.length \?\? 0\) - 5\)/);
  assert.match(
    pulse,
    /calendar\?\.days \?\? \[\]\)\.slice\(mobileWindowStart, mobileWindowStart \+ 5\)/
  );
  assert.match(pulse, /const moveMobileWindow = \(offset: number\) =>/);
  assert.match(pulse, /onClick=\{\(\) => moveMobileWindow\(-5\)\}/);
  assert.match(pulse, /onClick=\{\(\) => moveMobileWindow\(5\)\}/);
  assert.match(pulse, /aria-pressed=\{selectedDate === day\.date\}/);
  assert.match(pulse, /onClick=\{\(\) => setSelectedDate\(day\.date\)\}/);
  assert.match(pulse, /aria-expanded=\{mobileMonthExpanded\}/);
  assert.match(pulse, /data-mobile-open=\{mobileMonthExpanded\}/);
  assert.match(pulse, /calendar\?\.days\.map\(\(day\) =>/);
  assert.match(
    mobile,
    /\.ys-sales-mobile-week__days\s*\{[^}]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\);/
  );
  assert.match(mobile, /\.ys-sales-mobile-week__day\s*\{[^}]*min-height: 55px;/);
  assert.match(mobile, /\.ys-sales-month-grid\[data-mobile-open="false"\]\s*\{\s*display: none;/);
  assert.match(
    mobile,
    /\.ys-sales-month-grid > \.grid\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/
  );
  assert.match(mobile, /\.ys-sales-month-grid \.ys-sales-day\s*\{[^}]*min-height: 48px;/);
  assert.match(pulse, /setMonth\(today\.slice\(0, 7\)\)/);
});

test("Performance day chart stays informative when activity is zero or phone labels are tight", () => {
  assert.match(pulse, /const noHourlyActivity =/);
  assert.match(pulse, /chartData\.every\(\(bucket\) => bucket\.amount === 0\)/);
  assert.match(pulse, /No completed sales in these two-hour windows\./);
  assert.match(pulse, /data-mobile-empty=\{noHourlyActivity\}/);
  assert.match(pulse, /interval=\{compactChartAxis \? "preserveStartEnd" : 1\}/);
  assert.match(pulse, /minTickGap=\{12\}/);
  assert.match(pulse, /window\.matchMedia\(/);
  assert.match(
    pulse,
    /tickFormatter=\{compactChartAxis \? \(label\) => formatHourAxisTick\(String\(label\)\) : undefined\}/
  );
  assert.match(mobile, /\.ys-sales-hourly-chart\s*\{[^}]*height: 150px;/);
  assert.match(
    mobile,
    /\.ys-sales-hourly-chart\[data-mobile-empty="true"\] \.ys-sales-hourly-chart__plot\s*\{\s*display: none;/
  );
  assert.match(pulse, /Daily POS history is not available for this date/);
});

test("Monthly inventory displays four summary stats and an actionable but compact restock plan", () => {
  assert.match(dashboard, /ys-dashboard-inventory-recommendation/);
  assert.match(dashboard, /ys-dashboard-report-stats grid gap-3/);
  for (const label of [
    "Products requiring action",
    "Suggested units",
    "High / critical",
    "Open restock orders",
    "To restock",
    "Other reviews"
  ])
    assert.ok(dashboard.includes('label="' + label + '"'), "Missing " + label);
  assert.match(dashboard, /ys-dashboard-plan-stats mt-4 grid gap-3/);
  assert.match(dashboard, /ys-dashboard-plan-footer mt-4 flex/);
  assert.match(dashboard, /onClick=\{\(\) => onNavigate\("\/reports"\)\}/);
  assert.match(dashboard, /No purchase ticket is created by this card/);
  assert.match(
    mobile,
    /\.ys-dashboard-report-stats\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
  assert.match(mobile, /\.ys-dashboard-plan-stats > :nth-child\(2\)\s*\{\s*display: none;/);
  assert.match(mobile, /\.ys-dashboard-plan-footer > button\s*\{[^}]*min-height: 44px;/);
});

test("Dashboard v2 is scoped to mobile and preserves dark-mode readability", () => {
  assert.match(
    css,
    /:root\.dark \.retail-workspace \.retail-dashboard-page \.ys-sales-mobile-week__day\[aria-pressed="true"\]/
  );
  assert.match(
    css,
    /:root\.dark \.retail-workspace \.retail-dashboard-page \.ys-dashboard-alert-mobile/
  );
  assert.match(
    css,
    /:root\.dark \.retail-workspace \.retail-dashboard-page \.ys-sales-hourly-chart\[data-mobile-empty="true"\]/
  );
  assert.match(
    css,
    /@media \(max-width: 767px\), \(max-height: 500px\) and \(orientation: landscape\) and \(max-width: 1024px\)/
  );
  assert.doesNotMatch(css, /@media \(min-width: 1280px\)/);
});
