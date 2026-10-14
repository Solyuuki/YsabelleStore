import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const page = read("frontend/src/pages/ReportsPage.tsx");
const forecast = read("frontend/src/components/reports/RestockForecastPanel.tsx");
const planner = read("frontend/src/components/reports/RestockPlanningPanel.tsx");
const dialog = read("frontend/src/components/reports/ReportDownloadDialog.tsx");
const css = read("frontend/src/styles/retail-reports-mobile-v2.css");

test("Reports Mobile v2 partitions real backend data into compact views", () => {
  assert.match(page, /data-mobile-section=\{mobileSection\}/);
  assert.match(page, /setMobileSection\("recommendations"\)/);
  assert.match(page, /setMobileSection\("planner"\)/);
  assert.match(page, /stats\.slice\(0, 4\)/);
  assert.match(page, /fetchDashboardSummary\(\)/);
  assert.match(page, /listRecentSales\(50\)/);
  assert.match(css, /@media \(max-width: 767px\)/);
  assert.match(css, /data-mobile-section="recommendations"/);
});
test("Forecast cards retain real selections and compact Deliveries-style pager", () => {
  assert.match(forecast, /openForecastProduct\(item\.product\.id\)/);
  assert.match(forecast, /data-mobile-detail=\{mobileDetailOpen\}/);
  assert.match(forecast, /Back to products/);
  assert.match(forecast, /mobileCompact/);
  assert.match(forecast, /ys-report-v2-product-pager/);
  assert.match(forecast, /buildDemandChart\(selected\)/);
  assert.match(forecast, /ys-report-v2-chart-readout/);
  assert.match(css, /\.ys-report-v2-product-pager \.ys-inventory-page-token\{display:none\}/);
  assert.match(css, /\.ys-report-v2-chart \.recharts-tooltip-wrapper\{display:none!important\}/);
});
test("Export and Add Product remain operable and escape their scroll regions", () => {
  assert.match(dialog, /Back to Reports/);
  assert.match(dialog, /Close download report/);
  assert.match(dialog, /ys-report-v2-download-footer/);
  assert.match(dialog, /onClick=\{\(\) => void handlePdf\(\)\}/);
  assert.match(dialog, /onClick=\{\(\) => void handlePrint\(\)\}/);
  assert.match(dialog, /onClick=\{\(\) => void handleCsv\(\)\}/);
  assert.ok(
    planner.includes('<DialogContent className="ys-restock-product-picker max-w-[820px]">')
  );
  assert.match(planner, /ys-report-v2-picker-body/);
  assert.match(planner, /ys-report-v2-picker-footer/);
  assert.match(planner, /addExistingProduct\(candidate\)/);
  assert.match(css, /\.ys-report-v2-picker-body\{flex:1 1 auto;min-height:0/);
  assert.match(css, /\.ys-report-v2-picker-footer button\{width:100%;min-height:42px\}/);
});
