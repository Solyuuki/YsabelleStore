import { readFileSync, writeFileSync } from "node:fs";

const plannerPath = "frontend/src/components/reports/RestockPlanningPanel.tsx";
let planner = readFileSync(plannerPath, "utf8");

if (!planner.includes('import { useToast } from "@/components/shared/ToastProvider";')) {
  planner = planner.replace(
    'import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";',
    'import { useToast } from "@/components/shared/ToastProvider";\nimport { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";'
  );
}

planner = planner.replace(
  'export function RestockPlanningPanel({ onOpenOrders, onOrdersChanged }: RestockPlanningPanelProps) {\n',
  'export function RestockPlanningPanel({ onOpenOrders, onOrdersChanged }: RestockPlanningPanelProps) {\n  const { pushToast } = useToast();\n'
);

const oldApproval = `      const approved = await approveRestockOrder(order.id, order.version);
      setDraftOrder(approved);
      setDraftDirty(false);
      setReviewOpen(false);
      setNotice(null);
      onOrdersChanged();`;
const newApproval = [
  "      const approved = await approveRestockOrder(order.id, order.version);",
  "      setReviewOpen(false);",
  "      setNotice(null);",
  "      onOrdersChanged();",
  "      pushToast({",
  '        title: "Restock sent to Receiving",',
  '        message: `${approved.orderNumber} is ready in Receiving. Physical Inventory stays unchanged until the delivery is accepted.`,',
  '        variant: "success"',
  "      });",
  "      await loadRecommendations();"
].join("\n");

if (!planner.includes(oldApproval)) {
  throw new Error("Restock planner approval block did not match expected source.");
}
planner = planner.replace(oldApproval, newApproval);
writeFileSync(plannerPath, planner);

writeFileSync(
  "scripts/restock-phase7-9-ui-contract-test.ts",
  `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const newProductSource = readFileSync(resolve(process.cwd(), "src/components/reports/RestockNewProductCard.tsx"), "utf8");
const receivingSource = readFileSync(resolve(process.cwd(), "src/pages/ReceivingPage.tsx"), "utf8");
const returnDialogSource = readFileSync(resolve(process.cwd(), "src/components/receiving/ReturnReportDialog.tsx"), "utf8");
const returnExportSource = readFileSync(resolve(process.cwd(), "src/utils/restockReturnExport.ts"), "utf8");
const routesSource = readFileSync(resolve(process.cwd(), "src/app/routes.ts"), "utf8");
const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");

assert.match(reportsSource, /RestockNewProductCard/);
assert.match(reportsSource, /RestockDraftsPanel/);
assert.doesNotMatch(reportsSource, /RestockReceivingPanel/);
assert.doesNotMatch(reportsSource, /"plan" \\| "orders" \\| "receiving"/);
assert.match(newProductSource, /createProduct/);
assert.match(newProductSource, /createRestockOrder/);
assert.match(newProductSource, /dataQualityStatus: "NEEDS_REVIEW"/);
assert.match(newProductSource, /isStorefrontVisible: false/);
assert.doesNotMatch(newProductSource, /stockInInventory\\s*\\(/);

assert.match(receivingSource, /Complete — No issues/);
assert.match(receivingSource, /Complete — With issues/);
assert.match(receivingSource, /Partial delivery/);
assert.match(receivingSource, /Mark entire delivery damaged/);
assert.match(receivingSource, /Accepted quantity is calculated automatically/);
assert.match(receivingSource, /ReturnReportDialog/);
assert.match(receivingSource, /receiveRestockOrder/);
assert.doesNotMatch(receivingSource, /receiveInventoryStock/);
assert.doesNotMatch(receivingSource, /stockInInventory\\s*\\(/);
assert.match(apiSource, /\\/receipts/);

assert.match(returnDialogSource, /Download return report/);
assert.match(returnDialogSource, /Download PDF/);
assert.match(returnDialogSource, /Print/);
assert.match(returnDialogSource, /Excel-compatible CSV/);
assert.match(returnExportSource, /damagedQuantity/);
assert.match(returnExportSource, /returnQuantity/);
assert.match(returnExportSource, /safeCsvText/);
assert.match(routesSource, /path: "\\/receiving"[\\s\\S]*?icon: Truck/);

console.log("Restock Phase 7-9 UI contract passed.");
`
);

writeFileSync(
  "scripts/receiving-barcode-ui-contract-test.ts",
  `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { appRoutes, canRoleAccessRoute } from "../frontend/src/app/routes.ts";

const receivingRoute = appRoutes.find((route) => route.path === "/receiving");
assert.ok(receivingRoute, "Receiving route must be registered.");
assert.equal(canRoleAccessRoute(receivingRoute, "OWNER"), true);
assert.equal(canRoleAccessRoute(receivingRoute, "STAFF"), false);

const appShellSource = readFileSync(resolve(process.cwd(), "src/app/AppShell.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "src/components/app/AppSidebar.tsx"), "utf8");
const pageSource = readFileSync(resolve(process.cwd(), "src/pages/ReceivingPage.tsx"), "utf8");
const restockApiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");

assert.match(appShellSource, /case "\\/receiving":[\\s\\S]*?<ReceivingPage \\/>/);
assert.match(sidebarSource, /"\\/receiving"/);
assert.match(pageSource, /listRestockOrders/);
assert.match(pageSource, /Restock tickets ready for delivery/);
assert.match(pageSource, /Complete — No issues/);
assert.match(pageSource, /Complete — With issues/);
assert.match(pageSource, /Partial delivery/);
assert.match(pageSource, /internalBatchReference/);
assert.doesNotMatch(pageSource, /Barcode on received item/);
assert.doesNotMatch(pageSource, /Register barcode & receive/);
assert.match(restockApiSource, /acceptedQuantity/);
assert.match(restockApiSource, /\\/receipts/);

console.log("Receiving ticket UI contract passed.");
`
);
