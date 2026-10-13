import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const inventory = read("frontend/src/pages/InventoryPage.tsx");
const css = read("frontend/src/styles/retail-inventory-mobile-v2.css");

test("inventory mobile filters collapse into an accessible dynamic panel", () => {
  assert.match(inventory, /import "@\/styles\/retail-inventory-mobile-v2\.css"/);
  assert.match(inventory, /aria-controls="retail-inventory-filter-panel"/);
  assert.match(inventory, /aria-expanded=\{mobileFiltersOpen\}/);
  assert.match(inventory, /data-open=\{mobileFiltersOpen\}/);
  assert.match(inventory, /setMobileFiltersOpen\(\(open\) => !open\)/);
  assert.match(inventory, /activeFilterCount > 0/);
  assert.match(inventory, /Reset filters/);
  assert.match(css, /\.retail-inventory-filter-panel\[data-open="false"\]/);
});

test("inventory native selects define actual option contrast in both appearances", () => {
  assert.match(css, /:root\.dark \.app-shell-ambient \.ys-inventory-filter > select/);
  assert.match(css, /color-scheme: dark !important;/);
  assert.match(css, /background-color: #20314d !important;/);
  assert.match(css, /color: #f1f5ff !important;/);
  assert.match(css, /:root:not\(\.dark\)/);
  assert.match(css, /color-scheme: light !important;/);
});

test("mobile inventory cards remain compact while details still expose full stock information", () => {
  assert.match(inventory, /retail-inventory-data-table retail-mobile-data-table/);
  assert.match(inventory, /onOpenDetails\(row\.productId\)/);
  assert.match(inventory, /function InventoryDetailsDialog\(/);
  for (const col of ["Product", "SKU", "Stock", "Restock levels", "Expiry", "Batches", "Status"]) {
    assert.ok(inventory.includes('data-label="' + col + '"'));
  }
  assert.match(css, /td\[data-label="SKU"\]/);
  assert.match(css, /td\[data-label="Batches"\]/);
  assert.match(css, /grid-template-rows: auto auto auto;/);
});

test("inventory uses a short phone page without reducing desktop results", () => {
  assert.match(inventory, /const DEFAULT_PAGE_SIZE = 20;/);
  assert.match(inventory, /const MOBILE_INVENTORY_PAGE_SIZE = 10;/);
  assert.match(inventory, /useState\(preferredInventoryPageSize\)/);
  assert.match(inventory, /viewport\.addEventListener\("change", onViewportChange\)/);
  assert.match(inventory, /onPageSizeChange=\{\(nextPageSize\) =>/);
});

test("stock activity becomes a readable six-field mobile timeline with no horizontal scroll", () => {
  assert.match(inventory, /retail-inventory-activity-table min-w-\[820px\]/);
  for (const col of ["Date", "Activity", "Change", "Stock", "Reason", "By"]) {
    assert.ok(inventory.includes('data-label="' + col + '"'));
  }
  assert.match(css, /\.retail-inventory-activity-table tbody > tr/);
  assert.match(css, /\.retail-inventory-activity-table thead/);
  assert.match(css, /max-height: none;/);
});

test("phone inventory pagination shows previous, concise page label and next", () => {
  const pager = read("frontend/src/components/shared/AppPagination.tsx");
  assert.match(inventory, /className="ys-inventory-pagination"/);
  assert.match(inventory, /mobileCompact/);
  assert.match(pager, /mobileCompact\?: boolean;/);
  assert.match(pager, /Page \{currentPage\} of \{resolvedTotalPages\}/);
  assert.match(css, /\.ys-inventory-page-token \{ display: none; \}/);
  assert.match(css, /\.ys-inventory-mobile-page-label/);
});

test("mobile stock receiving and adjustment remain horizontal and scrollable", () => {
  assert.match(inventory, /ys-stock-receive-modal/);
  assert.match(inventory, /ys-stock-adjust-modal/);
  assert.match(inventory, /ys-stock-receipt-math/);
  assert.match(inventory, /ys-stock-adjust-math/);
  assert.equal((inventory.match(/ys-stock-quantity-stepper/g) || []).length, 2);
  assert.equal((inventory.match(/ys-stock-dialog-footer/g) || []).length, 2);
  assert.match(css, /grid-template-columns: 44px minmax\(0,1fr\) 44px !important;/);
  assert.match(css, /\.ys-stock-receipt-math/);
  assert.match(css, /\.ys-stock-adjust-math/);
  assert.match(css, /overflow: hidden !important;/);
  assert.match(inventory, /Removal quantity cannot exceed current stock/);
  assert.match(inventory, /Batch\/Lot number is required/);
});

test("import Guide keeps a separate line from the exit control on phones", () => {
  const importing = read("frontend/src/components/inventory/InventoryImportDialog.tsx");
  assert.match(importing, /ys-inventory-import-header/);
  assert.match(importing, /ys-inventory-import-heading/);
  assert.match(importing, /setShowGuide\(\(current\) => !current\)/);
  assert.match(css, /\.ys-inventory-import-heading \{\s*display: flex;\s*flex-direction: column;/);
});
