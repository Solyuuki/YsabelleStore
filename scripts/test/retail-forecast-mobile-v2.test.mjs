import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const page = read("frontend/src/pages/ForecastPage.tsx");
const css = read("frontend/src/styles/retail-forecast-mobile-v2.css");
const presentation = read("frontend/src/utils/forecastPresentation.ts");

test("Mobile forecasting cards replace table presentation on phones but desktop remains", () => {
  assert.match(page, /className="ys-forecast-v2-mobile-cards"/);
  assert.match(page, /className="ys-forecast-v2-desktop-products/);
  assert.match(page, /pagination\.items\.map\(\(product\) =>/);
  assert.match(page, /onProductSelect\(product\.productId\)/);
  assert.match(page, /formatForecastVariance\(product\.forecastVariancePercentage\)/);
  assert.match(css, /\.ys-forecast-v2-desktop-products[\s\S]*?\{\s*display: none;/);
  assert.match(css, /@media \(max-width: 699px\)/);
  assert.match(css, /@media \(max-width: 359px\)/);
});
test("Mobile filters preserve category and eight sort options and server requests", () => {
  assert.match(page, /aria-expanded=\{mobileFiltersOpen\}/);
  assert.match(page, /onCategoryChange\(option\.value\)/);
  assert.match(page, /onSortChange\(option\.value\)/);
  assert.match(page, /forecastSortOptions\.map\(\(option\) =>/);
  assert.match(page, /onSearchChange\(event\.target\.value\)/);
  assert.match(page, /getForecastProductCollection\(\{/);
  assert.match(presentation, /getForecastServerSort/);
  assert.match(css, /\.ys-forecast-v2-filter-panel[\s\S]*?max-height: min\(65dvh, 29rem\)/);
});
test("Mobile pager uses page size, server paging handlers and shared compact page token", () => {
  assert.match(page, /className="ys-forecast-v2-mobile-pagination"/);
  assert.match(page, /className="ys-forecast-v2-desktop-pagination"/);
  assert.match(page, /className="ys-forecast-v2-pager"/);
  assert.match(page, /mobileCompact/);
  assert.match(page, /pageSizeOptions=\{\[7,\s*\s*10,\s*\s*20\]\}/);
  assert.match(
    page,
    /onProductsPageSizeChange=\{\(size\)\s*=>\s*\{\s*setProductsPageSize\(size\);\s*setProductsPage\(1\);\s*\}\}/
  );
  assert.match(page, /totalPages=\{pagination\.totalPages\}/);
  assert.match(
    css,
    /\.ys-forecast-v2-pager\s*\.ys-inventory-page-token\s*\{\s*display:\s*none;\s*\}/
  );
});
test("Mobile chart uses real points, never hover popup and provides touch+keyboard selected month", () => {
  assert.match(page, /const mobileForecastRows = visibleForecastRows\.slice\(0, 4\);/);
  assert.match(page, /const mobileChartData = buildChartData\(mobileForecastRows\);/);
  assert.match(page, /<Tooltip active=\{false\} \/>/);
  assert.match(page, /state\?\.activeTooltipIndex/);
  assert.match(page, /setMobileSelectedMonth\(index\)/);
  assert.match(page, /aria-pressed=\{index === mobileSelectedMonth\}/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /mobileMonthPoint\.comparisonSalesEstimated/);
  assert.match(css, /\.ys-forecast-v2-chart-canvas\s*\{[\s\S]*?height: 192px;/);
});
test("Monthly cards collapse at 3 but allow full real window, keeping desktop table", () => {
  assert.match(page, /visibleForecastRows\.slice\(0, showAllMobileMonths \? undefined : 3\)/);
  assert.match(page, /setShowAllMobileMonths\(\(current\) => !current\)/);
  assert.match(page, /ys-forecast-v2-desktop-monthly/);
  assert.match(page, /getForecastDetailWindowSizes/);
  assert.match(page, /clampForecastWindowStart/);
  assert.match(page, /comparisonSalesEstimated \? " \(est\.\)" : ""/);
  assert.match(
    css,
    /\.ys-forecast-v2-summary-metrics\s*\{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/
  );
});

test("Forecast paging responds to user clicks without reverting to stale API page", () => {
  assert.match(
    page,
    /setProductsPage\(\(current\)\s*=>\s*current\s*===\s*forecastData\.page\s*\?\s*current\s*:\s*forecastData\.page/
  );
  assert.match(page, /\},\s*\s*\[forecastData\]\);/);
  assert.doesNotMatch(page, /forecastData\.page\s*!==\s*productsPage/);
  assert.match(
    page,
    /onProductsPageSizeChange=\{\(size\)\s*=>\s*\{\s*setProductsPageSize\(size\);\s*setProductsPage\(1\);\s*\}\}/
  );
  assert.match(page, /const\s*index\s*=\s*state\?\.activeTooltipIndex;/);
  assert.match(page, /typeof\s*index\s*===\s*"number"\s*&&\s*Number\.isInteger\(index\)/);
});

test("Desktop chart keeps a measurable Recharts canvas and existing theme contract", () => {
  assert.ok(page.includes('className="ys-forecast-chart min-h-[20rem] flex-1"'));
  assert.ok(
    css.includes(".ys-forecast-v2-desktop-chart > .ys-forecast-chart {\n  height: 20rem;\n}")
  );
  assert.ok(page.includes('<ResponsiveContainer height="100%" width="100%">'));
  assert.ok(
    css.includes(
      ".ys-forecast-v2-desktop-chart,\n  .retail-workspace .ys-forecast-v2 .ys-forecast-v2-desktop-monthly { display: none; }"
    )
  );
});

test("Desktop chart keeps axis ticks within its border and explains absent comparisons", () => {
  assert.ok(
    page.includes(
      "<LineChart data={chartData} margin={{ top: 12, right: 18, bottom: 8, left: 8 }}>"
    )
  );
  assert.ok(
    page.includes(
      '<XAxis dataKey="month" minTickGap={24} padding={{ left: 40, right: 40 }} tickMargin={10} />'
    )
  );
  assert.ok(
    page.includes('<Legend height={36} verticalAlign="bottom" wrapperStyle={{ fontSize: 12 }} />')
  );
  assert.ok(page.includes("point.comparisonSalesQuantity === null"));
  assert.ok(page.includes("unavailableComparisonMonths.length > 0"));
  assert.ok(page.includes("The line stops at missing data rather than showing invented values."));
  assert.ok(page.includes("connectNulls={false}"));
});
