import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const panelSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockPlanningPanel.tsx"),
  "utf8"
);
const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");
const reportDialogSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/ReportDownloadDialog.tsx"),
  "utf8"
);
const reportExportSource = readFileSync(
  resolve(process.cwd(), "src/utils/reportExport.ts"),
  "utf8"
);
const supplierExportSource = readFileSync(
  resolve(process.cwd(), "src/utils/restockExport.ts"),
  "utf8"
);

assert.match(reportsSource, /RestockPlanningPanel/);
assert.match(reportsSource, /<RestockPlanningPanel \/>/);
assert.match(reportsSource, /Download report/);
assert.match(reportsSource, /ResponsiveContainer/);
assert.match(reportsSource, /Recent receipts/);
assert.match(reportsSource, /No inventory issues need attention right now/);
assert.doesNotMatch(reportsSource, /Internal operational snapshot/);
assert.match(reportsSource, /ReportDownloadDialog/);
assert.ok(
  reportsSource.indexOf("<RestockPlanningPanel />") <
    reportsSource.indexOf("Recent receipt metrics"),
  "Restock planner should stay above secondary report detail cards."
);

assert.match(panelSource, /<Badge variant="info">Recommended<\/Badge>/);
assert.match(panelSource, /Review and prepare products for restocking\./);
assert.doesNotMatch(panelSource, /Large restock lists stay paged/);
assert.match(panelSource, /Restock planner/);
assert.match(panelSource, /Add product/);
assert.match(panelSource, /Order quantity/);
assert.match(panelSource, /Why did you change the suggested quantity/);
assert.match(panelSource, /Details/);
assert.match(panelSource, /Not needed/);
assert.match(panelSource, /Review restock/);
assert.match(panelSource, /Save for later/);
assert.match(panelSource, /Confirm restock/);
assert.match(panelSource, /Export supplier copy/);
assert.match(panelSource, /Export restock order/);
assert.match(panelSource, /currentTarget\.select\(\)/);
assert.match(panelSource, /Confirm the restock before creating a supplier copy/);
assert.match(panelSource, /Inventory has not changed/);
assert.match(panelSource, /Physical Inventory is unchanged/);
assert.match(panelSource, /updateProduct/);
assert.match(panelSource, /DialogContent/);

assert.match(panelSource, /const RESTOCK_PAGE_SIZE = 8/);
assert.match(panelSource, /const CATALOG_PAGE_SIZE = 10/);
assert.match(panelSource, /const REVIEW_PAGE_SIZE = 12/);
assert.match(panelSource, /pagedLines\.map/);
assert.match(panelSource, /pagedSelectedLines\.map/);
assert.match(panelSource, /PaginationControls/);
assert.match(panelSource, /Search existing catalog products/);
assert.match(panelSource, /max-h-\[50vh\]/);
assert.match(panelSource, /Results stay paged so large catalogs do not stretch/);
assert.doesNotMatch(panelSource, /searchResults\.slice\(0, 8\)/);

assert.doesNotMatch(panelSource, /createProduct\s*\(/);
assert.doesNotMatch(panelSource, /stockInInventory\s*\(/);
assert.doesNotMatch(apiSource, /\/api\/inventory\/.*stock-in/);

assert.match(apiSource, /\/api\/restock-orders\/planning/);
assert.match(
  apiSource,
  /\/api\/restock-orders\/recommendations\/\$\{encodeURIComponent\(recommendationId\)\}\/dismiss/
);
assert.match(apiSource, /"\/api\/restock-orders"/);
assert.match(apiSource, /\/api\/restock-orders\/\$\{encodeURIComponent\(orderId\)\}\/lines/);
assert.match(apiSource, /\/api\/restock-orders\/\$\{encodeURIComponent\(orderId\)\}\/approve/);
assert.match(apiSource, /export async function listRestockOrders/);

assert.match(reportDialogSource, /Download report/);
assert.match(reportDialogSource, /Operational Summary/);
assert.match(reportDialogSource, /Inventory Report/);
assert.match(reportDialogSource, /Restock \/ Supplier Order/);
assert.match(reportDialogSource, /Print \/ Save PDF/);
assert.match(reportDialogSource, /Excel-compatible CSV/);
assert.match(reportDialogSource, /No confirmed restock order yet/);
assert.match(reportDialogSource, /REPORT_TYPE_SESSION_KEY/);

assert.match(reportExportSource, /OPERATIONAL SUMMARY/);
assert.match(reportExportSource, /INVENTORY REPORT/);
assert.match(reportExportSource, /Total units on hand/);
assert.doesNotMatch(reportExportSource, /RESTOCK RECOMMENDATIONS/);

assert.match(supplierExportSource, /RESTOCK ORDER - SUPPLIER COPY/);
assert.match(supplierExportSource, /Supplier \/ Manufacturer/);
assert.match(supplierExportSource, /Order quantity/);
assert.match(supplierExportSource, /downloadRestockSupplierCsv/);
assert.match(supplierExportSource, /printRestockSupplierCopy/);
assert.doesNotMatch(supplierExportSource, /Forecast demand/);
assert.doesNotMatch(supplierExportSource, /Reorder level/);

console.log("Restock Phase 4-6 Reports QoL contract passed.");
