import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const newProductSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockNewProductCard.tsx"),
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

assert.match(reportsSource, /RestockNewProductCard/);
assert.match(reportsSource, /RestockDraftsPanel/);
assert.doesNotMatch(reportsSource, /RestockReceivingPanel/);
assert.doesNotMatch(reportsSource, /"plan" \| "orders" \| "receiving"/);
assert.match(newProductSource, /createProduct/);
assert.match(newProductSource, /createRestockOrder/);
assert.match(newProductSource, /dataQualityStatus: "NEEDS_REVIEW"/);
assert.match(newProductSource, /isStorefrontVisible: false/);
assert.doesNotMatch(newProductSource, /stockInInventory\s*\(/);

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
assert.match(receivingSource, /@base-ui\/react\/accordion/);
assert.match(receivingSource, /<StatCard/);
assert.match(receivingSource, /<Dialog/);
assert.match(receivingSource, /DialogContent/);
assert.doesNotMatch(receivingSource, /@\/components\/ui\/sheet/);
assert.doesNotMatch(receivingSource, /@\/components\/ui\/table/);
assert.doesNotMatch(receivingSource, /<table\b/i);
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
