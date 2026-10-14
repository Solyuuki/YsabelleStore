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
  assert.match(dashboard, /import\s*"@\/styles\/retail-dashboard-mobile\.css"/);
  assert.match(dashboard, /ys-dashboard-kpi-grid\s*grid\s*gap-4\s*md:grid-cols-2/);
  assert.match(dashboard, /ys-dashboard-kpi-content\s*flex\s*min-h-40/);
  assert.match(dashboard, /ys-dashboard-alert-mobile/);
  assert.match(dashboard, /summary\.inventory\.lowStockItems/);
  assert.match(dashboard, /summary\.inventory\.outOfStockItems/);
  assert.match(dashboard, /summary\.expiry\.nearExpiryBatches/);
  assert.match(dashboard, /summary\.expiry\.expiredBatches/);
  assert.match(dashboard, /forecastStat\?\.value/);
  assert.ok(mobile, "Missing phone-only Dashboard rules");
  assert.match(
    mobile,
    /\.ys-dashboard-kpi-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*\s*minmax\(0,\s*\s*1fr\)\);/
  );
  assert.match(mobile, /\.ys-dashboard-kpi-content\s*\{[^}]*min-height:\s*114px;/);
  assert.match(
    mobile,
    /\.ys-dashboard-alert-detail,\s*[\s\S]*?\.ys-dashboard-alert-help\s*\{\s*display:\s*none;/
  );
  assert.match(mobile, /\.ys-dashboard-alert-mobile\s*\{\s*display:\s*grid;/);
  assert.match(mobile, /\.ys-dashboard-kpi-grid\s*>\s*:last-child:nth-child\(3\)/);
});

test("Sales Pulse on phones retains four genuine metrics with legible non-truncated currencies", () => {
  for (const label of ["Actual sales", "Forecast target", "Forecast", "Transactions"]) {
    assert.ok(pulse.includes('label="' + label + '"'), "Missing " + label);
  }
  assert.match(pulse, /ys-sales-summary-grid\s*grid\s*gap-3\s*sm:grid-cols-2/);
  assert.match(pulse, /ys-sales-summary-tile__value/);
  assert.match(pulse, /ys-sales-summary-tile__value\s*mt-1\s*truncate\s*text-lg/);
  assert.match(
    mobile,
    /\.ys-sales-summary-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*\s*minmax\(0,\s*\s*1fr\)\);/
  );
  assert.match(
    mobile,
    /\.ys-sales-summary-tile__value\s*\{[^}]*white-space:\s*normal;[^}]*overflow-wrap:\s*anywhere;/
  );
  assert.match(mobile, /\.ys-sales-view-tab\s*\{[^}]*min-height:\s*44px;/);
  assert.match(pulse, /fetchDashboardSalesCalendar\(activeMonth\)/);
  assert.match(pulse, /fetchDashboardSalesDay\(selectedDate\)/);
  assert.match(pulse, /setView\("performance"\)/);
});

test("Five-date mobile navigator preserves access to every day and full monthly view", () => {
  assert.match(
    pulse,
    /const\s*\[mobileWindowStart,\s*\s*setMobileWindowStart\]\s*=\s*useState\(0\)/
  );
  assert.match(
    pulse,
    /const\s*\[mobileMonthExpanded,\s*\s*setMobileMonthExpanded\]\s*=\s*useState\(false\)/
  );
  assert.match(pulse, /Math\.max\(0,\s*\s*\(calendar\?\.days\.length\s*\?\?\s*0\)\s*-\s*5\)/);
  assert.match(
    pulse,
    /calendar\?\.days\s*\?\?\s*\[\]\)\.slice\(mobileWindowStart,\s*\s*mobileWindowStart\s*\+\s*5\)/
  );
  assert.match(pulse, /const\s*moveMobileWindow\s*=\s*\(offset:\s*number\)\s*=>/);
  assert.match(pulse, /onClick=\{\(\)\s*=>\s*moveMobileWindow\(-5\)\}/);
  assert.match(pulse, /onClick=\{\(\)\s*=>\s*moveMobileWindow\(5\)\}/);
  assert.match(pulse, /aria-pressed=\{selectedDate\s*===\s*day\.date\}/);
  assert.match(pulse, /onClick=\{\(\)\s*=>\s*setSelectedDate\(day\.date\)\}/);
  assert.match(pulse, /aria-expanded=\{mobileMonthExpanded\}/);
  assert.match(pulse, /data-mobile-open=\{mobileMonthExpanded\}/);
  assert.match(pulse, /calendar\?\.days\.map\(\(day\)\s*=>/);
  assert.match(
    mobile,
    /\.ys-sales-mobile-week__days\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*\s*minmax\(0,\s*\s*1fr\)\);/
  );
  assert.match(mobile, /\.ys-sales-mobile-week__day\s*\{[^}]*min-height:\s*55px;/);
  assert.match(mobile, /\.ys-sales-month-grid\[data-mobile-open="false"\]\s*\{\s*display:\s*none;/);
  assert.match(
    mobile,
    /\.ys-sales-month-grid\s*>\s*\.grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*\s*minmax\(0,\s*\s*1fr\)\);/
  );
  assert.match(mobile, /\.ys-sales-month-grid\s*\.ys-sales-day\s*\{[^}]*min-height:\s*48px;/);
  assert.match(pulse, /setMonth\(today\.slice\(0,\s*\s*7\)\)/);
});

test("Performance day chart stays informative when activity is zero or phone labels are tight", () => {
  assert.match(pulse, /const\s*noHourlyActivity\s*=/);
  assert.match(pulse, /chartData\.every\(\(bucket\)\s*=>\s*bucket\.amount\s*===\s*0\)/);
  assert.match(pulse, /No\s*completed\s*sales\s*in\s*these\s*two-hour\s*windows\./);
  assert.match(pulse, /data-mobile-empty=\{noHourlyActivity\}/);
  assert.match(pulse, /interval=\{compactChartAxis\s*\?\s*"preserveStartEnd"\s*:\s*1\}/);
  assert.match(pulse, /minTickGap=\{12\}/);
  assert.match(pulse, /window\.matchMedia\(/);
  assert.match(
    pulse,
    /tickFormatter=\{compactChartAxis\s*\?\s*\(label\)\s*=>\s*formatHourAxisTick\(String\(label\)\)\s*:\s*undefined\}/
  );
  assert.match(mobile, /\.ys-sales-hourly-chart\s*\{[^}]*height:\s*150px;/);
  assert.match(
    mobile,
    /\.ys-sales-hourly-chart\[data-mobile-empty="true"\]\s*\.ys-sales-hourly-chart__plot\s*\{\s*display:\s*none;/
  );
  assert.match(pulse, /Daily\s*POS\s*history\s*is\s*not\s*available\s*for\s*this\s*date/);
});

test("Monthly inventory displays four summary stats and an actionable but compact restock plan", () => {
  assert.match(dashboard, /ys-dashboard-inventory-recommendation/);
  assert.match(dashboard, /ys-dashboard-report-stats\s*grid\s*gap-3/);
  for (const label of [
    "Products requiring action",
    "Suggested units",
    "High / critical",
    "Open restock orders",
    "To restock",
    "Other reviews"
  ])
    assert.ok(dashboard.includes('label="' + label + '"'), "Missing " + label);
  assert.match(dashboard, /ys-dashboard-plan-stats\s*mt-4\s*grid\s*gap-3/);
  assert.match(dashboard, /ys-dashboard-plan-footer\s*mt-4\s*flex/);
  assert.match(dashboard, /onClick=\{\(\)\s*=>\s*onNavigate\("\/reports"\)\}/);
  assert.match(dashboard, /No\s*purchase\s*ticket\s*is\s*created\s*by\s*this\s*card/);
  assert.match(
    mobile,
    /\.ys-dashboard-report-stats\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*\s*minmax\(0,\s*\s*1fr\)\);/
  );
  assert.match(mobile, /\.ys-dashboard-plan-stats\s*>\s*:nth-child\(2\)\s*\{\s*display:\s*none;/);
  assert.match(mobile, /\.ys-dashboard-plan-footer\s*>\s*button\s*\{[^}]*min-height:\s*44px;/);
});

test("Dashboard v2 is scoped to mobile and preserves dark-mode readability", () => {
  assert.match(
    css,
    /:root\.dark\s*\.retail-workspace\s*\.retail-dashboard-page\s*\.ys-sales-mobile-week__day\[aria-pressed="true"\]/
  );
  assert.match(
    css,
    /:root\.dark\s*\.retail-workspace\s*\.retail-dashboard-page\s*\.ys-dashboard-alert-mobile/
  );
  assert.match(
    css,
    /:root\.dark\s*\.retail-workspace\s*\.retail-dashboard-page\s*\.ys-sales-hourly-chart\[data-mobile-empty="true"\]/
  );
  assert.match(
    css,
    /@media\s*\(max-width:\s*767px\),\s*\s*\(max-height:\s*500px\)\s*and\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*1024px\)/
  );
  assert.doesNotMatch(css, /@media\s*\(min-width:\s*1280px\)/);
});
