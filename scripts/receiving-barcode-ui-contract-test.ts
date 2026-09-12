import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { appRoutes, canRoleAccessRoute } from "../frontend/src/app/routes.ts";

const receivingRoute = appRoutes.find((route) => route.path === "/receiving");
assert.ok(receivingRoute, "Receiving route must be registered.");
assert.equal(canRoleAccessRoute(receivingRoute, "OWNER"), true);
assert.equal(canRoleAccessRoute(receivingRoute, "STAFF"), false);

const appShellSource = readFileSync(resolve(process.cwd(), "src/app/AppShell.tsx"), "utf8");
const routesSource = readFileSync(resolve(process.cwd(), "src/app/routes.ts"), "utf8");
const sidebarSource = readFileSync(
  resolve(process.cwd(), "src/components/app/AppSidebar.tsx"),
  "utf8"
);
const pageSource = readFileSync(resolve(process.cwd(), "src/pages/ReceivingPage.tsx"), "utf8");
const restockApiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");

assert.match(appShellSource, /case "\/receiving":[\s\S]*?<ReceivingPage \/>/);
assert.match(sidebarSource, /"\/receiving"/);
assert.match(routesSource, /path: "\/receiving"[\s\S]*?icon: Truck/);
assert.match(pageSource, /listRestockOrders/);
assert.match(pageSource, /Restock tickets ready for delivery/);
assert.match(pageSource, /Complete — No issues/);
assert.match(pageSource, /Complete — With issues/);
assert.match(pageSource, /Partial delivery/);
assert.match(pageSource, /internalBatchReference/);
assert.match(pageSource, /@base-ui\/react\/accordion/);
assert.match(pageSource, /<StatCard/);
assert.match(pageSource, /<Dialog/);
assert.doesNotMatch(pageSource, /@\/components\/ui\/sheet/);
assert.doesNotMatch(pageSource, /RefreshCw/);
assert.doesNotMatch(pageSource, /<table\b/i);
assert.doesNotMatch(pageSource, /Barcode on received item/);
assert.doesNotMatch(pageSource, /Register barcode & receive/);
assert.match(restockApiSource, /acceptedQuantity/);
assert.match(restockApiSource, /\/receipts/);

console.log("Receiving ticket UI contract passed.");
