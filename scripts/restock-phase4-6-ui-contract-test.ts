import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const panelSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockPlanningPanel.tsx"),
  "utf8"
);
const orderHistorySource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockOrderHistoryPanel.tsx"),
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
const directPdfSource = readFileSync(
  resolve(process.cwd(), "src/utils/directPdfExport.ts"),
  "utf8"
);

// Reports owns one clear Restock workspace with mutually exclusive Plan / Orders views.
assert.match(reportsSource, /RestockPlanningPanel/);
assert.match(reportsSource, /RestockOrderHistoryPanel/);
assert.match(reportsSource, /restockView === "plan"/);
assert.match(reportsSource, /Plan restock/);
assert.match(reportsSource, /Orders/);
assert.match(reportsSource, /onOpenOrders=\{\(\) => setRestockView\("orders"\)\}/);
assert.match(reportsSource, /onOrdersChanged=\{notifyRestockOrdersChanged\}/);
assert.match(reportsSource, /Download report/);
assert.match(reportsSource, /ReportDownloadDialog/);
assert.match(reportsSource, /Recent receipt metrics/);
assert.match(reportsSource, /Recent sales trend/);
assert.match(reportsSource, /LineChart/);
assert.doesNotMatch(reportsSource, /BarChart/);
assert.match(reportsSource, /No inventory issues need attention right now/);
assert.doesNotMatch(reportsSource, /Internal operational snapshot/);

// Planner remains the editable planning surface only, with a compact confirmed success state.
assert.match(panelSource, /<Badge variant="info">Recommended<\/Badge>/);
assert.match(panelSource, /Review and prepare products for restocking\./);
assert.match(panelSource, /Restock planner/);
assert.match(panelSource, /Add product/);
assert.match(panelSource, /Order quantity/);
assert.match(panelSource, /Why did you change the suggested quantity/);
assert.match(panelSource, /Details/);
assert.match(panelSource, /Not needed/);
assert.match(panelSource, /Review restock/);
assert.match(panelSource, /Save for later/);
assert.match(panelSource, /Confirm restock/);
assert.match(panelSource, /Restock confirmed/);
assert.match(panelSource, /View orders/);
assert.match(panelSource, /Start new restock/);
assert.match(panelSource, /confirmLockRef/);
assert.match(panelSource, /currentTarget\.select\(\)/);
assert.match(panelSource, /Inventory has not changed/);
assert.match(panelSource, /Physical inventory is unchanged until the/);
assert.match(panelSource, /updateProduct/);
assert.match(panelSource, /max-h-\[36vh\]/);
assert.doesNotMatch(panelSource, /Export supplier copy/);
assert.doesNotMatch(panelSource, /Export restock order/);
assert.doesNotMatch(panelSource, /Print \/ Save PDF/);
assert.doesNotMatch(panelSource, /printRestockSupplierCopy/);
assert.doesNotMatch(panelSource, /downloadRestockSupplierCsv/);

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

// Persisted orders are scalable, searchable, filterable, and reopen exact records.
assert.match(orderHistorySource, /const ORDER_PAGE_SIZE = 10/);
assert.match(orderHistorySource, /Restock orders/);
assert.match(
  orderHistorySource,
  /Reopen saved and confirmed restock tickets after refresh or a later session\./
);
assert.match(orderHistorySource, /Search restock order reference/);
assert.match(orderHistorySource, /Filter restock orders by status/);
assert.match(orderHistorySource, /search: searchTerm \|\| undefined/);
assert.match(orderHistorySource, /status: statusFilter === "ALL" \? undefined : statusFilter/);
assert.match(orderHistorySource, /Open order/);
assert.match(orderHistorySource, /Persisted restock order/);
assert.match(orderHistorySource, /Physical inventory remains unchanged/);
assert.match(orderHistorySource, /Download PDF/);
assert.match(orderHistorySource, /exportBusy === "print" \? "Preparing…" : "Print"/);
assert.match(orderHistorySource, /Excel-compatible CSV/);
assert.match(orderHistorySource, /await import\("@\/utils\/directPdfExport"\)/);
assert.doesNotMatch(orderHistorySource, /stockInInventory\s*\(/);
assert.doesNotMatch(orderHistorySource, /\/api\/inventory\/.*stock-in/);

// Reports/restock remain planning surfaces, never physical-stock mutation surfaces.
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
assert.match(apiSource, /search\?: string/);
assert.match(apiSource, /statuses\?: readonly RestockOrderStatus\[\]/);

// Central report download selects an exact supplier-ready order; it never silently exports latest.
assert.match(reportDialogSource, /Download report/);
assert.match(reportDialogSource, /Operational Summary/);
assert.match(reportDialogSource, /Inventory Report/);
assert.match(reportDialogSource, /Restock \/ Supplier Order/);
assert.match(reportDialogSource, /Supplier order/);
assert.match(reportDialogSource, /supplier-order-select/);
assert.match(reportDialogSource, /SUPPLIER_ORDER_PAGE_SIZE/);
assert.match(reportDialogSource, /statuses: SUPPLIER_EXPORT_STATUSES/);
assert.match(reportDialogSource, /The exact order selected here will be used for PDF, Print, or CSV export\./);
assert.doesNotMatch(reportDialogSource, /fetchLatestSupplierOrder/);
assert.match(reportDialogSource, /exportBusy === "print" \? "Preparing…" : "Print"/);
assert.match(reportDialogSource, /Excel-compatible CSV/);
assert.match(reportDialogSource, /No supplier-ready restock order yet/);
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

assert.match(reportDialogSource, /Download PDF/);
assert.match(reportDialogSource, /Open a clean print view for paper printing\./);
assert.match(reportDialogSource, /Excel-compatible CSV/);
assert.match(reportDialogSource, /await import\("@\/utils\/directPdfExport"\)/);
assert.doesNotMatch(reportDialogSource, /from "@\/utils\/directPdfExport"/);
assert.match(directPdfSource, /downloadOperationalSummaryPdf/);
assert.match(directPdfSource, /downloadInventoryReportPdf/);
assert.match(directPdfSource, /downloadRestockSupplierPdf/);
assert.match(directPdfSource, /jspdf-autotable/);

console.log("Restock Phase 4-6 Reports QoL contract passed.");
