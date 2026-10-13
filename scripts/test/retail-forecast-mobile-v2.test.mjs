import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read=path=>readFileSync(new URL("../../"+path, import.meta.url),"utf8");
const page=read("frontend/src/pages/ForecastPage.tsx");
const css=read("frontend/src/styles/retail-forecast-mobile-v2.css");
const presentation=read("frontend/src/utils/forecastPresentation.ts");

test("Mobile forecasting cards replace table presentation on phones but desktop remains",()=>{
  assert.match(page,/className="ys-forecast-v2-mobile-cards"/);
  assert.match(page,/className="ys-forecast-v2-desktop-products/);
  assert.match(page,/pagination\.items\.map\(\(product\) =>/);
  assert.match(page,/onProductSelect\(product\.productId\)/);
  assert.match(page,/formatForecastVariance\(product\.forecastVariancePercentage\)/);
  assert.match(css,/\.ys-forecast-v2-desktop-products[\s\S]*?\{\s*display: none;/);
  assert.match(css,/@media \(max-width: 699px\)/);
  assert.match(css,/@media \(max-width: 359px\)/);
});
test("Mobile filters preserve category and eight sort options and server requests",()=>{
  assert.match(page,/aria-expanded=\{mobileFiltersOpen\}/);
  assert.match(page,/onCategoryChange\(option\.value\)/);
  assert.match(page,/onSortChange\(option\.value\)/);
  assert.match(page,/forecastSortOptions\.map\(\(option\) =>/);
  assert.match(page,/onSearchChange\(event\.target\.value\)/);
  assert.match(page,/getForecastProductCollection\(\{/);
  assert.match(presentation,/getForecastServerSort/);
  assert.match(css,/\.ys-forecast-v2-filter-panel[\s\S]*?max-height: min\(65dvh, 29rem\)/);
});
test("Mobile pager uses page size, server paging handlers and shared compact page token",()=>{
  assert.match(page,/className="ys-forecast-v2-mobile-pagination"/);
  assert.match(page,/className="ys-forecast-v2-desktop-pagination"/);
  assert.match(page,/className="ys-forecast-v2-pager"/);
  assert.match(page,/mobileCompact/);
  assert.match(page,/pageSizeOptions=\{\[7, 10, 20\]\}/);
  assert.match(page,/onProductsPageSizeChange=\{\(size\) => \{ setProductsPageSize\(size\); setProductsPage\(1\); \}\}/);
  assert.match(page,/totalPages=\{pagination\.totalPages\}/);
  assert.match(css,/\.ys-forecast-v2-pager \.ys-inventory-page-token \{ display: none; \}/);
});
test("Mobile chart uses real points, never hover popup and provides touch+keyboard selected month",()=>{
  assert.match(page,/const mobileForecastRows = visibleForecastRows\.slice\(0, 4\);/);
  assert.match(page,/const mobileChartData = buildChartData\(mobileForecastRows\);/);
  assert.match(page,/<Tooltip active=\{false\} \/>/);
  assert.match(page,/state\?\.activeTooltipIndex/);
  assert.match(page,/setMobileSelectedMonth\(index\)/);
  assert.match(page,/aria-pressed=\{index === mobileSelectedMonth\}/);
  assert.match(page,/aria-live="polite"/);
  assert.match(page,/mobileMonthPoint\.comparisonSalesEstimated/);
  assert.match(css,/\.ys-forecast-v2-chart-canvas\s*\{[\s\S]*?height: 192px;/);
});
test("Monthly cards collapse at 3 but allow full real window, keeping desktop table",()=>{
  assert.match(page,/visibleForecastRows\.slice\(0, showAllMobileMonths \? undefined : 3\)/);
  assert.match(page,/setShowAllMobileMonths\(\(current\) => !current\)/);
  assert.match(page,/ys-forecast-v2-desktop-monthly/);
  assert.match(page,/getForecastDetailWindowSizes/);
  assert.match(page,/clampForecastWindowStart/);
  assert.match(page,/comparisonSalesEstimated \? " \(est\.\)" : ""/);
  assert.match(css,/\.ys-forecast-v2-summary-metrics\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
});

test("Forecast paging responds to user clicks without reverting to stale API page", () => {
  assert.match(page, /setProductsPage\(\(current\) =>\s*current === forecastData\.page \? current : forecastData\.page/);
  assert.match(page, /\}, \[forecastData\]\);/);
  assert.doesNotMatch(page, /forecastData\.page !== productsPage/);
  assert.match(page, /onProductsPageSizeChange=\{\(size\) => \{ setProductsPageSize\(size\); setProductsPage\(1\); \}\}/);
  assert.match(page, /const index = state\?\.activeTooltipIndex;/);
  assert.match(page, /typeof index === "number" && Number\.isInteger\(index\)/);
});
