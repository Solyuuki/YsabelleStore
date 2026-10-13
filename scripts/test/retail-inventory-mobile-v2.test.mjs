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

test("inventory filter menus use accessible themed listboxes rather than native OS option popups", () => {
  assert.match(inventory, /aria-haspopup="listbox"/);
  assert.match(inventory, /role="listbox"/);
  assert.match(inventory, /role="option"/);
  assert.match(inventory, /aria-selected=\{option.value === value\}/);
  assert.match(inventory, /document.addEventListener\("pointerdown", closeOnOutsidePointer\)/);
  assert.match(inventory, /event.key === "Escape"/);
  assert.match(inventory, /event.key === "ArrowDown"/);
  assert.match(css, /:root.dark \.app-shell-ambient \.ys-inventory-filter-menu/);
  assert.match(css, /background: #1c2d47;/);
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

test("Inventory pagination mirrors Deliveries: compact current-page button between arrows, selector left", () => {
  const pager = read("frontend/src/components/shared/AppPagination.tsx");
  assert.match(inventory, /className="ys-inventory-pagination"/);
  assert.match(inventory, /mobileCompact/);
  assert.match(pager, /aria-label=\{`Page \${currentPage} of \${resolvedTotalPages}`\}/);
  assert.match(css, /\.ys-inventory-pagination > div > label > span\s*\{\s*display: none;/);
  assert.match(css, /\.ys-inventory-page-token\s*\{\s*display: none;/);
  assert.match(css, /\.ys-inventory-pagination \.ys-inventory-mobile-page-label/);
  assert.match(css, /\.ys-inventory-pagination nav > ul/);
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

test("Import header places icon-only guide beside X without altering guide functionality", () => {
  const importing = read("frontend/src/components/inventory/InventoryImportDialog.tsx");
  assert.match(importing, /ys-inventory-import-header-actions/);
  assert.match(importing, /aria-label="Toggle import guide"/);
  assert.match(importing, /aria-pressed=\{showGuide\}/);
  assert.match(importing, /<CircleHelp/);
  assert.match(importing, /setShowGuide\(\(current\) => !current\)/);
  assert.match(css, /\.ys-inventory-import-heading\s*\{\s*display: flex;\s*flex-direction: row;/);
});

test("Inventory mobile search hint remains fully visible with an accessible full search label", () => {
  assert.match(inventory, /placeholder="Search products"/);
  assert.match(inventory, /aria-label="Search inventory by product name, SKU, or barcode"/);
});

test("narrow Inventory toolbar reserves readable search width by using an accessible icon-only filter", () => {
  assert.match(inventory, /placeholder="Search products"/);
  assert.match(inventory, /aria-label=\{mobileFiltersOpen \? "Hide inventory filters" : "Show inventory filters"\}/);
  assert.match(css, /@media \(max-width: 479px\)/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 44px;/);
  assert.match(css, /\.retail-inventory-filter-toggle > span:not\(\.retail-inventory-filter-count\)/);
  assert.match(css, /\.retail-inventory-filter-toggle-chevron\s*\{\s*display: none;/);
  assert.match(css, /\.retail-inventory-filter-count\s*\{\s*position: absolute;/);
});
