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
  assert.match(pager, /aria-label=\{`Page\s*\${currentPage}\s*of\s*\${resolvedTotalPages}`\}/);
  assert.match(
    css,
    /\.ys-inventory-pagination\s*>\s*div\s*>\s*label\s*>\s*span\s*\{\s*display:\s*none;/
  );
  assert.match(css, /\.ys-inventory-page-token\s*\{\s*display:\s*none;/);
  assert.match(css, /\.ys-inventory-pagination\s*\.ys-inventory-mobile-page-label/);
  assert.match(css, /\.ys-inventory-pagination\s*nav\s*>\s*ul/);
});

test("mobile stock receiving and adjustment remain horizontal and scrollable", () => {
  assert.match(inventory, /ys-stock-receive-modal/);
  assert.match(inventory, /ys-stock-adjust-modal/);
  assert.match(inventory, /ys-stock-receipt-math/);
  assert.match(inventory, /ys-stock-adjust-math/);
  assert.equal((inventory.match(/ys-stock-quantity-stepper/g) || []).length, 2);
  assert.equal((inventory.match(/ys-stock-dialog-footer/g) || []).length, 2);
  assert.match(css, /grid-template-columns:\s*44px\s*minmax\(0,\s*1fr\)\s*44px\s*!important;/);
  assert.match(css, /\.ys-stock-receipt-math/);
  assert.match(css, /\.ys-stock-adjust-math/);
  assert.match(css, /overflow:\s*hidden\s*!important;/);
  assert.match(inventory, /Removal\s*quantity\s*cannot\s*exceed\s*current\s*stock/);
  assert.match(inventory, /Batch\/Lot\s*number\s*is\s*required/);
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
  assert.match(inventory, /placeholder="Search\s*products"/);
  assert.match(
    inventory,
    /aria-label=\{mobileFiltersOpen\s*\?\s*"Hide\s*inventory\s*filters"\s*:\s*"Show\s*inventory\s*filters"\}/
  );
  assert.match(css, /@media\s*\(max-width:\s*479px\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*\s*1fr\)\s*44px;/);
  assert.match(
    css,
    /\.retail-inventory-filter-toggle\s*>\s*span:not\(\.retail-inventory-filter-count\)/
  );
  assert.match(css, /\.retail-inventory-filter-toggle-chevron\s*\{\s*display:\s*none;/);
  assert.match(css, /\.retail-inventory-filter-count\s*\{\s*position:\s*absolute;/);
});

test("Inventory toolbar stacks search above Filters when the usable content width is small", () => {
  assert.match(css, /container:\s*inventory-panel\s*\/\s*inline-size;/);
  assert.match(css, /@container\s*inventory-panel\s*\(max-width:\s*345px\)/);
  assert.match(
    css,
    /\.retail-inventory-toolbar\s*>\s*\.ys-inventory-search\s*\{\s*grid-column:\s*1;\s*grid-row:\s*1;/
  );
  assert.match(
    css,
    /\.retail-inventory-toolbar\s*>\s*\.retail-inventory-filter-toggle\s*\{\s*grid-column:\s*1;\s*grid-row:\s*2;/
  );
  assert.match(
    css,
    /\.retail-inventory-toolbar\s*>\s*\.retail-inventory-filter-panel\s*\{\s*grid-column:\s*1;\s*grid-row:\s*3;/
  );
  assert.match(
    css,
    /\.retail-inventory-filter-toggle\s*>\s*span:not\(\.retail-inventory-filter-count\)/
  );
});

test("Inventory mobile stock actions display history in a compact header and two role-gated buttons", () => {
  const start = inventory.indexOf('className="ys-inventory-details-footer');
  const end = inventory.indexOf("</DialogFooter>", start);
  assert.ok(start > 0 && end > start);
  const actions = inventory.slice(start, end);
  assert.match(actions, /ys-inventory-stock-actions-head/);
  assert.match(actions, /Stock\s*actions/);
  assert.match(actions, /ys-inventory-history-mobile">View\s*history/);
  assert.match(actions, /ys-inventory-adjust-mobile">Adjust\s*qty/);
  assert.match(actions, /ys-inventory-receive-action/);
  assert.match(actions, /onClick=\{onOpenMovements\}/);
  assert.match(actions, /onClick=\{onOpenAdjust\}/);
  assert.match(actions, /onClick=\{onOpenStockIn\}/);
  assert.match(actions, /\{isOwner\s*\?\s*\(/);
  assert.match(actions, /disabled=\{!inventory\s*\|\|\s*isLoading\s*\|\|\s*mutationPending\}/);
  assert.match(css, /\.ys-inventory-stock-actions-head\s*\{\s*display:\s*contents;\s*\}/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*\s*minmax\(0,\s*\s*1fr\)\);/);
  assert.match(
    css,
    /:root\.dark\[data-appearance-scope="retail"\]\s*\.ys-inventory-details-modal\s*\.ys-inventory-history-action/
  );
});
