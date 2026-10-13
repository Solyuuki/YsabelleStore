import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../"+path, import.meta.url),"utf8");
const wrapper=read("frontend/src/pages/ProductsPage.tsx");
const page=read("frontend/src/pages/ProductsPageLegacy.tsx");
const pkg=read("frontend/src/components/catalog/ProductPackageImportDialog.tsx");
const css=read("frontend/src/styles/retail-products-mobile-v2.css");

test("Products mobile v2 uses a compact separate catalog presentation without removing the desktop table",()=>{
  assert.match(page,/ys-products-v2-mobile-list/);
  assert.match(page,/ys-products-v2-desktop-table/);
  assert.match(page,/ys-products-v2-product-card/);
  assert.match(page,/ys-products-v2-product-name/);
  assert.match(page,/ys-products-v2-product-price/);
  assert.match(page,/setSelectedProductId\(product.id\)/);
  assert.match(page,/handleAvailabilityToggle\(product\)/);
  assert.match(css,/\.ys-products-v2-desktop-table\s*\{[^}]*display: none;/);
  assert.match(css,/-webkit-line-clamp: 2;/);
});
test("Mobile custom filter and sort actions reuse real server-side behavior",()=>{
  assert.match(page,/onChange=\{\(event\) => handleSearchChange\(event.target.value\)\}/);
  assert.match(page,/handleStatusFilterChange\(value\)/);
  assert.match(page,/handleQualityFilterChange\(value\)/);
  assert.match(page,/onSortOrderChange\(value\)/);
  assert.match(wrapper,/ProductsPageLegacy key=\{catalogRevision\} onSortOrderChange=\{handleSortOrderChange\} sortOrder=\{sortOrder\}/);
  assert.match(wrapper,/url.searchParams.set\("sortOrder", activeCatalogSortOrder\)/);
  assert.match(page,/aria-expanded=\{mobileFiltersOpen\}/);
  assert.match(page,/aria-pressed=\{statusFilter === value\}/);
  assert.match(page,/aria-pressed=\{qualityFilter === value\}/);
  assert.match(page,/aria-pressed=\{sortOrder === value\}/);
});
test("Deliveries-style mobile pager retains page change and page size handlers",()=>{
  assert.match(page,/className="ys-products-v2-pagination"/);
  assert.match(page,/mobileCompact/);
  assert.match(page,/onPageChange=\{handlePageChange\}/);
  assert.match(page,/onPageSizeChange=\{handlePageSizeChange\}/);
  assert.match(css,/\.ys-products-v2-pagination \.ys-inventory-page-token \{ display: none; \}/);
  assert.match(css,/\.ys-products-v2-pagination \.ys-inventory-mobile-page-label/);
});
test("Package import keeps scanner validation but provides compact dialog presentation",()=>{
  assert.match(pkg,/ys-products-v2-import-heading/);
  assert.match(pkg,/ys-products-v2-guide-text/);
  assert.match(pkg,/ys-products-v2-dropzone/);
  assert.match(pkg,/ys-products-v2-import-footer/);
  assert.match(pkg,/scanPackage\(\)/);
  assert.match(pkg,/confirmImport\(\)/);
  assert.match(css,/safe-area-inset-bottom/);
});
test("Small-phone and tablet layouts and desktop dark mode retain readable surfaces",()=>{
  assert.match(css,/@media \(max-width: 1024px\)/);
  assert.match(css,/@media \(max-width: 359px\)/);
  assert.match(css,/:root.dark .retail-workspace .ys-products-v2-page .ys-products-v2-desktop-filters option/);
  assert.match(css,/:root.dark .retail-workspace .ys-products-v2-page .ys-products-v2-option/);
});

test("Desktop catalog override selectors still target actual Products v2 section", () => {
  const overrides=read("frontend/src/pages/products-page-overrides.css");
  assert.match(overrides, /\.products-page-no-actions \.ys-products-v2-page > section > \.w-full > :first-child/);
  assert.match(overrides, /\.products-page-no-actions \.ys-products-v2-page > section > \.w-full > :nth-child\(2\)/);
  assert.match(css, /\.ys-products-v2-page > header > div:first-child > p\s*\{\s*display: none;/);
  assert.match(css, /\.ys-products-v2-import-heading button\s*\{[^}]*position: absolute;/);
});

test("Compact status and import source controls have accessible names and accurate availability colors", () => {
  assert.match(page,/data-available=\{product.status === "ACTIVE"\}/);
  assert.match(css,/\.ys-products-v2-product-availability\[data-available="false"\]/);
  assert.match(pkg,/aria-label=\{showGuide \? "Hide product import guide" : "Show product import guide"\}/);
  assert.match(pkg,/ys-products-v2-source-tab/);
  assert.match(pkg,/ys-products-v2-local-label/);
  assert.match(css,/\.ys-products-v2-local-label::after \{ content: "Local file";/);
});
