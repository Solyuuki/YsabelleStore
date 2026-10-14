import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const wrapper = read("frontend/src/pages/ProductsPage.tsx");
const page = read("frontend/src/pages/ProductsPageLegacy.tsx");
const pkg = read("frontend/src/components/catalog/ProductPackageImportDialog.tsx");
const css = read("frontend/src/styles/retail-products-mobile-v2.css");

test("Products mobile v2 uses a compact separate catalog presentation without removing the desktop table", () => {
  assert.match(page, /ys-products-v2-mobile-list/);
  assert.match(page, /ys-products-v2-desktop-table/);
  assert.match(page, /ys-products-v2-product-card/);
  assert.match(page, /ys-products-v2-product-name/);
  assert.match(page, /ys-products-v2-product-price/);
  assert.match(page, /setSelectedProductId\(product.id\)/);
  assert.match(page, /handleAvailabilityToggle\(product\)/);
  assert.match(css, /\.ys-products-v2-desktop-table\s*\{[^}]*display: none;/);
  assert.match(css, /-webkit-line-clamp: 2;/);
});
test("Mobile custom filter and sort actions reuse real server-side behavior", () => {
  assert.match(page, /onChange=\{\(event\) => handleSearchChange\(event.target.value\)\}/);
  assert.match(page, /handleStatusFilterChange\(value\)/);
  assert.match(page, /handleQualityFilterChange\(value\)/);
  assert.match(page, /onSortOrderChange\(value\)/);
  assert.match(
    wrapper,
    /ProductsPageLegacy key=\{catalogRevision\} onSortOrderChange=\{handleSortOrderChange\} sortOrder=\{sortOrder\}/
  );
  assert.match(wrapper, /url.searchParams.set\("sortOrder", activeCatalogSortOrder\)/);
  assert.match(page, /aria-expanded=\{mobileFiltersOpen\}/);
  assert.match(page, /aria-pressed=\{statusFilter === value\}/);
  assert.match(page, /aria-pressed=\{qualityFilter === value\}/);
  assert.match(page, /aria-pressed=\{sortOrder === value\}/);
});
test("Deliveries-style mobile pager retains page change and page size handlers", () => {
  assert.match(page, /className="ys-products-v2-pagination"/);
  assert.match(page, /mobileCompact/);
  assert.match(page, /onPageChange=\{handlePageChange\}/);
  assert.match(page, /onPageSizeChange=\{handlePageSizeChange\}/);
  assert.match(css, /\.ys-products-v2-pagination \.ys-inventory-page-token \{ display: none; \}/);
  assert.match(css, /\.ys-products-v2-pagination \.ys-inventory-mobile-page-label/);
});
test("Package import keeps scanner validation but provides compact dialog presentation", () => {
  assert.match(pkg, /ys-products-v2-import-heading/);
  assert.match(pkg, /ys-products-v2-guide-text/);
  assert.match(pkg, /ys-products-v2-dropzone/);
  assert.match(pkg, /ys-products-v2-import-footer/);
  assert.match(pkg, /scanPackage\(\)/);
  assert.match(pkg, /confirmImport\(\)/);
  assert.match(css, /safe-area-inset-bottom/);
});
test("Small-phone and tablet layouts and desktop dark mode retain readable surfaces", () => {
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /@media \(max-width: 359px\)/);
  assert.match(
    css,
    /:root.dark .retail-workspace .ys-products-v2-page .ys-products-v2-desktop-filters option/
  );
  assert.match(css, /:root.dark .retail-workspace .ys-products-v2-page .ys-products-v2-option/);
});

test("Desktop catalog override selectors still target actual Products v2 section", () => {
  const overrides = read("frontend/src/pages/products-page-overrides.css");
  assert.match(
    overrides,
    /\.products-page-no-actions \.ys-products-v2-page > section > \.w-full > :first-child/
  );
  assert.match(
    overrides,
    /\.products-page-no-actions \.ys-products-v2-page > section > \.w-full > :nth-child\(2\)/
  );
  assert.match(css, /\.ys-products-v2-page > header > div:first-child > p\s*\{\s*display: none;/);
  assert.match(css, /\.ys-products-v2-import-heading button\s*\{[^}]*position: absolute;/);
});

test("Compact status and import source controls have accessible names and accurate availability colors", () => {
  assert.match(page, /data-available=\{product.status === "ACTIVE"\}/);
  assert.match(css, /\.ys-products-v2-product-availability\[data-available="false"\]/);
  assert.match(
    pkg,
    /aria-label=\{showGuide \? "Hide product import guide" : "Show product import guide"\}/
  );
  assert.match(pkg, /ys-products-v2-source-tab/);
  assert.match(pkg, /ys-products-v2-local-label/);
  assert.match(css, /\.ys-products-v2-local-label::after \{ content: "Local file";/);
});

test("approved product image uses a single compact quality row and upload control", () => {
  const component = read("frontend/src/components/catalog/ProductImageUploadPanel.tsx");
  assert.match(component, /className="ys-product-image-quality-card/);
  assert.match(component, /data-needs-action=\{candidate\.qualityStatus !== "APPROVED"\}/);
  assert.match(component, /className="ys-product-image-quality-heading/);
  assert.match(component, /<QualityIndicator status=\{candidate\.qualityStatus\} \/>/);
  assert.match(component, /className="ys-product-image-quality-actions/);
  assert.match(component, /aria-label="Upload another product image"/);
  assert.match(component, /ys-product-image-replace-mobile">Replace/);
  assert.match(component, /ys-product-image-updated inline-flex/);
  assert.match(component, /\{selectedFile && !candidate \? \(/);
  assert.match(component, /onClick=\{openPicker\}/);
  assert.match(
    css,
    /\.ys-product-image-quality-card\[data-needs-action="false"\] \.ys-product-image-approved-description/
  );
  assert.match(
    css,
    /\.ys-product-image-previews\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
});
test("image quality errors and all approval/discard actions remain intact", () => {
  const component = read("frontend/src/components/catalog/ProductImageUploadPanel.tsx");
  assert.match(component, /ys-product-image-diagnostics/);
  assert.match(component, /diagnostics\.map\(\(diagnostic, index\) =>/);
  assert.match(component, /handleDiscard\(\)/);
  assert.match(component, /handleApprove\(\)/);
  assert.match(component, /canApprove && phase !== "approved"/);
});
test("Products search never paints a separate dark input rectangle", () => {
  assert.match(css, /\.ys-products-v2-search > input,/);
  assert.match(css, /background: transparent !important;/);
  assert.match(css, /background-color: transparent !important;/);
  assert.match(css, /box-shadow: none !important;/);
  assert.match(css, /\.ys-products-v2-search:focus-within/);
});

test("approved photo hides redundant mobile upload guidance without removing upload controls", () => {
  const component = read("frontend/src/components/catalog/ProductImageUploadPanel.tsx");
  assert.match(component, /className="ys-product-image-guidance/);
  assert.match(component, /ys-product-image-updated inline-flex[^"]*" role="status"/);
  assert.match(
    css,
    /\.ys-product-image-panel\[data-quality-status="APPROVED"\] \.ys-product-image-guidance\s*\{\s*display: none;/
  );
  assert.match(component, /Upload a normal product photo/);
  assert.match(component, /onClick=\{openPicker\}/);
});

test("Original and Optimized product thumbnails show the full portrait photo at narrow widths", () => {
  const component = read("frontend/src/components/catalog/ProductImageUploadPanel.tsx");
  assert.match(component, /<ImagePreview title="Original" url=\{originalPreviewUrl\} \/>/);
  assert.match(component, /title="Optimized"/);
  assert.match(
    component,
    /className="block h-full w-full min-h-0 min-w-0 object-contain object-center"/
  );
  const canvasRule = css.match(
    /\.ys-product-image-preview \.ys-product-preview-canvas \{([^}]*)\}/
  )?.[1];
  assert.ok(canvasRule, "Mobile preview container CSS missing");
  assert.match(canvasRule, /aspect-ratio: 4 \/ 5;/);
  assert.match(canvasRule, /min-height: 126px;/);
  assert.match(canvasRule, /max-height: 216px;/);
  assert.match(canvasRule, /grid-template-rows: minmax\(0, 1fr\);/);
  assert.doesNotMatch(canvasRule, /height:\s*clamp\(78px,\s*23vw,\s*126px\)/);
  const imageRule = css.match(
    /\.ys-product-image-preview \.ys-product-preview-canvas img \{([^}]*)\}/
  )?.[1];
  assert.ok(imageRule, "Image fit rule missing");
  assert.match(imageRule, /object-fit: contain;/);
  assert.match(imageRule, /object-position: center;/);
  assert.match(imageRule, /height: 100%;/);
  assert.match(
    css,
    /\.ys-product-image-previews\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/
  );
});
