import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const planningSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockPlanningPanel.tsx"),
  "utf8"
);
const forecastSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockForecastPanel.tsx"),
  "utf8"
);
const forecastViewModelSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/restockForecastViewModel.ts"),
  "utf8"
);
const receivingSource = readFileSync(resolve(process.cwd(), "src/pages/ReceivingPage.tsx"), "utf8");
const returnDialogSource = readFileSync(
  resolve(process.cwd(), "src/components/receiving/ReturnReportDialog.tsx"),
  "utf8"
);
const returnHistorySource = readFileSync(
  resolve(process.cwd(), "src/components/receiving/ReturnHistoryDialog.tsx"),
  "utf8"
);
const returnExportSource = readFileSync(
  resolve(process.cwd(), "src/utils/restockReturnExport.ts"),
  "utf8"
);
const routesSource = readFileSync(resolve(process.cwd(), "src/app/routes.ts"), "utf8");
const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");

assert.doesNotMatch(reportsSource, /RestockNewProductCard/);
assert.doesNotMatch(reportsSource, /New product restock/);
assert.doesNotMatch(reportsSource, /Add new product/);
assert.match(forecastSource, /Restock forecast/);
assert.doesNotMatch(reportsSource, /Review recommendations/);
assert.match(
  forecastSource,
  /See which products need restocking, when to order, and how many units to buy\./
);
assert.match(reportsSource, /RestockForecastPanel/);
assert.match(forecastSource, /Forecast watchlist/);
assert.match(forecastSource, /loadAllRestockPlanningCandidates\(controller\.signal\)/);
assert.match(forecastViewModelSource, /includeZero:\s*true/);
assert.match(forecastSource, /Recommended next step/);
assert.match(forecastSource, /Expected monthly demand/);
assert.match(forecastSource, /Gray shows recent sales\. Blue shows expected demand/);
assert.match(forecastSource, /Forecast chart ready/);
assert.doesNotMatch(forecastSource, /confidence interval/i);
assert.doesNotMatch(forecastSource, /Projected inventory/);
assert.match(reportsSource, /RestockPlanningPanel/);
assert.doesNotMatch(reportsSource, />Saved drafts</);
assert.match(reportsSource, /RestockDraftsPanel/);
assert.match(planningSource, /<Badge>Manual<\/Badge>/);
assert.match(planningSource, /Save for later/);
assert.match(planningSource, /Saved drafts/);
assert.match(planningSource, /makePlanLine\(candidate, true\)/);
assert.doesNotMatch(planningSource, /<Badge variant="info">Recommended<\/Badge>/);
assert.doesNotMatch(reportsSource, /restockView === "plan"/);
assert.doesNotMatch(reportsSource, /RestockReceivingPanel/);
assert.doesNotMatch(reportsSource, /"plan" \| "orders" \| "receiving"/);

assert.match(receivingSource, /Complete — No issues/);
assert.match(receivingSource, /Complete — With issues/);
assert.match(receivingSource, /Partial delivery/);
assert.match(
  receivingSource,
  /Enter what arrived\. Missing and accepted quantities are calculated automatically\./
);
assert.match(receivingSource, /Mark entire delivery damaged/);
assert.match(receivingSource, /Accepted quantity is calculated automatically/);
assert.match(receivingSource, /ReturnReportDialog/);
assert.match(receivingSource, /ReturnHistoryDialog/);
assert.match(receivingSource, /<AppPagination/);
assert.match(receivingSource, /useState\(20\)/);
assert.match(receivingSource, /Return history/);
assert.match(receivingSource, /Damage \/ return reason/);
assert.match(receivingSource, /setReturnReportOrder\(updated\)/);
assert.match(receivingSource, /receiveRestockOrder/);
assert.match(receivingSource, /@\/components\/ui\/table/);
assert.match(receivingSource, /<Table aria-label=/);
assert.match(receivingSource, /role="button"/);
assert.match(receivingSource, /<StatCard/);
assert.match(receivingSource, /<Dialog/);
assert.match(receivingSource, /DialogContent/);
assert.doesNotMatch(receivingSource, /@base-ui\/react\/accordion/);
assert.doesNotMatch(receivingSource, /@\/components\/ui\/sheet/);
assert.doesNotMatch(receivingSource, /<table\b/);
assert.doesNotMatch(receivingSource, /RefreshCw/);
assert.doesNotMatch(receivingSource, /role="tablist"/);
assert.doesNotMatch(receivingSource, /QueueSummaryCard/);
assert.doesNotMatch(receivingSource, /receiveInventoryStock/);
assert.doesNotMatch(receivingSource, /stockInInventory\s*\(/);
assert.match(apiSource, /\/receipts/);
assert.match(apiSource, /damageReason/);
assert.match(apiSource, /hasReturns/);
assert.match(apiSource, /return-report/);

assert.match(returnDialogSource, /Download return report/);
assert.match(returnDialogSource, /Download PDF/);
assert.match(returnDialogSource, /Print/);
assert.match(returnDialogSource, /Excel-compatible CSV/);
assert.match(returnDialogSource, /Supplier \/ manufacturer/);
assert.match(returnDialogSource, /deliveryReference/);
assert.match(returnDialogSource, /saveRestockReturnReport/);
assert.match(returnDialogSource, /getRestockReturnDocumentInfo/);
assert.match(returnHistorySource, /<AppPagination/);
assert.match(returnHistorySource, /hasReturns: true/);
assert.match(returnHistorySource, /View report/);
assert.match(returnExportSource, /damagedQuantity/);
assert.match(returnExportSource, /damageReason/);
assert.match(returnExportSource, /returnQuantity/);
assert.match(returnExportSource, /returnScope/);
assert.match(returnExportSource, /Supplier \/ Manufacturer/);
assert.match(returnExportSource, /safeCsvText/);
assert.match(routesSource, /path: "\/receiving"[\s\S]*?icon: Truck/);

console.log("Restock Phase 7-9 UI contract passed.");
