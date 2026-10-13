import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../\${path}`, import.meta.url), "utf8");

const source = {
  layout: read("frontend/src/layouts/AppLayout.tsx"),
  routes: read("frontend/src/app/routes.ts"),
  css: read("frontend/src/styles/retail-responsive-workspaces.css"),
  pos: read("frontend/src/pages/PosPageV2.tsx"),
  products: read("frontend/src/pages/ProductsPageLegacy.tsx"),
  categories: read("frontend/src/pages/CategoriesPage.tsx"),
  inventory: read("frontend/src/pages/InventoryPage.tsx"),
  receiving: read("frontend/src/pages/ReceivingPage.tsx"),
  sales: read("frontend/src/pages/SalesPage.tsx"),
  deliveries: read("frontend/src/pages/DeliveriesPage.tsx"),
  support: read("frontend/src/pages/CustomerSupportInboxPage.tsx"),
  forecast: read("frontend/src/pages/ForecastPage.tsx"),
  history: read("frontend/src/pages/HistoricalSalesPage.tsx"),
  dashboard: read("frontend/src/pages/DashboardPage.tsx"),
  reports: read("frontend/src/pages/ReportsPage.tsx"),
  users: read("frontend/src/pages/UserManagementPage.tsx"),
  settings: read("frontend/src/pages/SettingsPage.tsx")
};

test("retail mobile transforms are route-scoped without replacing the desktop layouts", () => {
  assert.match(source.layout, /import "@\/styles\/retail-responsive-workspaces\.css"/);
  assert.match(source.layout, /data-retail-module=\{activePath\.replace\(\/\^\\\/\/, ""\)\}/);
  assert.match(source.css, /@media \(max-width: 767px\), \(max-height: 500px\) and \(orientation: landscape\) and \(max-width: 1024px\)/);
  assert.match(source.css, /\.retail-workspace \.retail-mobile-data-table tbody > tr\s*\{[^}]*display: grid;/);
  assert.match(source.css, /\.retail-workspace \.retail-mobile-data-table thead\s*\{\s*display: none;/);
  assert.match(source.css, /content: attr\(data-label\)/);
  assert.match(source.css, /:root\.dark \.retail-workspace \.retail-mobile-data-table tbody > tr/);
  assert.doesNotMatch(source.css, /@media \(min-width: 1280px\)/);
});

test("all operational tables use compact labelled cards with their original actions", () => {
  for (const [module, labels] of [
    ["pos", ["Barcode / SKU", "Product", "Stock", "Unit price", "Action"]],
    ["products", ["Product", "SKU", "Barcode", "Category", "Status", "Selling price", "Action"]],
    ["categories", ["Category", "Products", "Cover", "Storefront", "Updated", "Action"]],
    ["inventory", ["Product", "SKU", "Stock", "Restock levels", "Expiry", "Batches", "Status"]],
    ["receiving", ["Ticket", "Status", "Products", "Expected", "Approved", "Remaining"]],
    ["sales", ["Receipt", "Date", "Items", "Total"]],
    ["deliveries", ["Ticket / Order", "Customer", "Payment", "Status", "Updated", "Total", "Action"]],
    ["forecast", ["Product", "Current Month", "Horizon", "Month", "Forecasted Demand", "Prior-Year Comparison", "Expected Change"]],
    ["history", ["Product", "Observations", "Missing months", "Status", "Assessment", "Batch", "Imported", "Mode", "Rows", "Written", "Skipped", "Actions"]]
  ]) {
    const current = source[module];
    assert.ok(current.includes("retail-mobile-data-table"), module + " misses the responsive table");
    for (const label of labels) {
      assert.ok(current.includes(`data-label="\${label}"`), module + " missing " + label);
    }
  }
  assert.match(source.pos, /addProductToCart\(product,/);
  assert.match(source.products, /toggleSelection\(product\.id\)/);
  assert.match(source.categories, /setSelectedCategory\(category\)/);
  assert.match(source.inventory, /onOpenDetails\(row\.productId\)/);
  assert.match(source.receiving, /onOpen\(order\)/);
  assert.match(source.sales, /setSelectedSaleId\(sale\.id\)/);
  assert.match(source.deliveries, /openTicket\(ticket\.id\)/);
});

test("POS mobile sale panel keeps checkout, cart mutation and scanner handlers", () => {
  assert.match(source.pos, /const \[mobileCartOpen, setMobileCartOpen\] = useState\(false\)/);
  assert.match(source.pos, /aria-controls="retail-pos-cart-content"/);
  assert.match(source.pos, /aria-expanded=\{mobileCartOpen\}/);
  assert.match(source.pos, /data-mobile-open=\{mobileCartOpen\}/);
  assert.match(source.pos, /setMobileCartOpen\(false\)/);
  assert.match(source.pos, /updateLineQuantity\(line\.product\.id, 1\)/);
  assert.match(source.pos, /updateLineQuantity\(line\.product\.id, -1\)/);
  assert.match(source.pos, /removeLine\(line\.product\.id\)/);
  assert.match(source.pos, /openCashPayment/);
  assert.match(source.pos, /<CashPaymentDialog/);
  assert.match(source.pos, /checkoutPosSale\(/);
  assert.match(source.css, /\.retail-workspace \.retail-pos-cart\[data-mobile-open="true"\]\s*\{/);
  assert.match(source.css, /\.retail-pos-cart__backdrop\s*\{/);
});

test("Support mobile conversation has an operable ticket-list return", () => {
  assert.match(source.support, /const \[mobileConversationOpen, setMobileConversationOpen\] = useState\(false\)/);
  assert.match(source.support, /data-mobile-conversation=\{mobileConversationOpen\}/);
  assert.match(source.support, /setMobileConversationOpen\(true\)/);
  assert.match(source.support, /setMobileConversationOpen\(false\)/);
  assert.match(source.support, /ys-support-inbox__mobile-back/);
  assert.match(source.support, /<SupportConversation/);
  assert.match(source.css, /data-mobile-conversation="false"/);
  assert.match(source.css, /data-mobile-conversation="true"/);
  assert.match(source.css, /:root\.dark \.retail-workspace \[data-retail-module="customer-support"\] \.ys-support-inbox__mobile-back/);
});

test("remaining analytics and administration preserve functional screen content", () => {
  for (const pathname of [
    "/dashboard", "/pos", "/products", "/categories", "/inventory", "/receiving",
    "/sales", "/deliveries", "/customer-support", "/forecast", "/historical-sales",
    "/reports", "/users", "/settings"
  ]) {
    assert.ok(source.routes.includes(`path: "\${pathname}"`), pathname + " missing route");
  }
  assert.match(source.dashboard, /ys-dashboard-monthly-batch/);
  assert.match(source.reports, /ResponsiveContainer/);
  assert.match(source.forecast, /ResponsiveContainer/);
  assert.match(source.users, /CustomerAccountModerationList/);
  assert.match(source.settings, /ys-appearance-card/);
  assert.match(source.css, /\.retail-workspace \[data-retail-module="dashboard"\]/);
  assert.match(source.css, /\.retail-workspace \[data-retail-module="reports"\]/);
  assert.match(source.css, /:root\[data-appearance-scope="retail"\] \[role="dialog"\]:not\(\.retail-mobile-nav__drawer\)/);
  assert.match(source.css, /max-height: calc\(100dvh - 1rem\) !important;/);
  assert.match(source.css, /font-size: 16px;/);
});
