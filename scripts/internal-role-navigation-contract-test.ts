import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { appRoutes, canRoleAccessRoute } from "../frontend/src/app/routes.ts";

const ownerOnlyPaths = [
  "/products",
  "/receiving",
  "/forecast",
  "/reports",
  "/users",
  "/settings"
] as const;

for (const path of ownerOnlyPaths) {
  const route = appRoutes.find((item) => item.path === path);
  assert.ok(route, `${path} must be registered`);
  assert.equal(canRoleAccessRoute(route, "OWNER"), true, `${path} must remain available to OWNER`);
  assert.equal(canRoleAccessRoute(route, "STAFF"), false, `${path} must be denied to STAFF`);
}

for (const path of ["/dashboard", "/pos", "/inventory", "/sales"] as const) {
  const route = appRoutes.find((item) => item.path === path);
  assert.ok(route, `${path} must be registered`);
  assert.equal(canRoleAccessRoute(route, "OWNER"), true, `${path} must be available to OWNER`);
  assert.equal(canRoleAccessRoute(route, "STAFF"), true, `${path} must be available to STAFF`);
}

const sidebarSource = readFileSync(
  resolve(process.cwd(), "src/components/app/AppSidebar.tsx"),
  "utf8"
);
const appShellSource = readFileSync(resolve(process.cwd(), "src/app/AppShell.tsx"), "utf8");
const customerAppSource = readFileSync(resolve(process.cwd(), "src/app/CustomerApp.tsx"), "utf8");

assert.match(sidebarSource, /const isOwner = user\?\.role === "OWNER"/);
assert.match(sidebarSource, /\{isOwner && ownerItems\.length > 0 \? \(/);
assert.doesNotMatch(
  sidebarSource,
  /<SidebarSection[\s\S]*?items=\{ownerItems\}[\s\S]*?title="OWNER AREA"[\s\S]*?<\/SidebarSection>\s*<\/nav>/,
  "OWNER AREA must not render unconditionally"
);

assert.match(appShellSource, /const CustomerApp = lazy\(\(\) =>/);
for (const pageName of [
  "DashboardPage",
  "ProductsPage",
  "InventoryPage",
  "ReceivingPage",
  "PosPage",
  "SalesPage",
  "ForecastPage",
  "HistoricalSalesPage",
  "ReportsPage",
  "SettingsPage",
  "UserManagementPage"
]) {
  assert.match(appShellSource, new RegExp(`const ${pageName} = lazy\\(\\(\\) =>`));
}
assert.doesNotMatch(appShellSource, /import \{ ReportsPage \} from "@\/pages\/ReportsPage"/);
assert.match(appShellSource, /<Suspense fallback=\{<RouteLoadingFallback/);

for (const pageName of [
  "CustomerHomePage",
  "ShopPage",
  "ProductDetailPage",
  "CartPage",
  "CheckoutPage",
  "OrderSuccessPage",
  "AboutExperiencePage",
  "DiscoverPage",
  "CustomerLoginPage",
  "CustomerRegisterPage",
  "CustomerAccountRecoveryPage",
  "CustomerAccountPage",
  "CustomerNotFoundPage"
]) {
  assert.match(customerAppSource, new RegExp(`const ${pageName} = lazy\\(\\(\\) =>`));
}
assert.doesNotMatch(
  customerAppSource,
  /import \{ AboutExperiencePage \} from "@\/pages\/customer\/AboutExperiencePage"/
);
assert.match(customerAppSource, /<Suspense fallback=\{<CustomerRouteFallback \/>\}>/);

console.log("Internal role navigation and route loading contract passed.");
