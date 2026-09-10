import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { appRoutes, canRoleAccessRoute } from "../frontend/src/app/routes.ts";

const receivingRoute = appRoutes.find((route) => route.path === "/receiving");
assert.ok(receivingRoute, "Receiving route must be registered.");
assert.equal(canRoleAccessRoute(receivingRoute, "OWNER"), true);
assert.equal(canRoleAccessRoute(receivingRoute, "STAFF"), false);

const appShellSource = readFileSync(resolve(process.cwd(), "src/app/AppShell.tsx"), "utf8");
const sidebarSource = readFileSync(
  resolve(process.cwd(), "src/components/app/AppSidebar.tsx"),
  "utf8"
);
const pageSource = readFileSync(resolve(process.cwd(), "src/pages/ReceivingPage.tsx"), "utf8");
const apiSource = readFileSync(resolve(process.cwd(), "src/services/receivingApi.ts"), "utf8");

assert.match(appShellSource, /case "\/receiving":[\s\S]*?<ReceivingPage \/>/);
assert.match(sidebarSource, /"\/receiving"/);
assert.match(pageSource, /Barcode on received item/);
assert.match(pageSource, /PRODUCT_BARCODE_CONFIRMATION_REQUIRED/);
assert.match(pageSource, /New barcode detected/);
assert.match(pageSource, /Register barcode & receive/);
assert.match(pageSource, /PRODUCT_BARCODE_CONFLICT/);
assert.match(pageSource, /PRODUCT_INTERNAL_BARCODE_RESERVED/);
assert.match(apiSource, /scannedBarcode\?: string/);
assert.match(apiSource, /confirmNewBarcode\?: boolean/);
assert.match(apiSource, /\/api\/inventory\/\$\{encodeURIComponent\(productId\)\}\/stock-in/);

console.log("Receiving barcode UI contract passed.");
