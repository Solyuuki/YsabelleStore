import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read=(path)=>readFileSync(new URL("../../"+path,import.meta.url),"utf8");
const page=read("frontend/src/pages/CategoriesPage.tsx");
const css=read("frontend/src/styles/retail-categories-mobile-v2.css");

test("category directory has separate compact mobile cards and original desktop table",()=>{
 assert.match(page,/ys-category-v2-mobile-list/);
 assert.match(page,/ys-category-v2-desktop-table/);
 assert.match(page,/ys-category-v2-category-card/);
 assert.match(page,/CategoryCoverThumbnail category=\{category\}/);
 assert.match(page,/data-status=\{category.coverStatus\}/);
 assert.match(page,/setSelectedCategory\(category\)/);
 assert.match(page,/category.isStorefrontVisible/);
 assert.match(css,/-webkit-line-clamp: 2;/);
 assert.match(css,/\.ys-category-v2-cover-status\s*\{[^}]*white-space: nowrap;/);
 assert.match(css,/\.ys-category-v2-thumb > :is\(div,img\)/);
});
test("all category filter choices reuse existing URL-backed server query",()=>{
 assert.match(page,/ys-category-v2-mobile-controls/);
 assert.match(page,/setSearchInput\(event.target.value\)/);
 for(const expression of ["coverStatus: value","visibility: value","status: value","sortBy, sortOrder, page: 1"]){assert.ok(page.includes(expression),expression)}
 assert.match(page,/applyQuery\(\{ page: 1,/);
 assert.match(page,/aria-expanded=\{mobileFiltersOpen\}/);
 assert.match(page,/aria-pressed=\{query.coverStatus === value\}/);
 assert.match(page,/aria-pressed=\{query.visibility === value\}/);
 assert.match(page,/aria-pressed=\{query.status === value\}/);
 assert.match(page,/setMobileFiltersOpen\(false\)/);
 assert.match(page,/writeCategoryQueryToLocation/);
 assert.match(page,/fetchManagedCategories\(/);
});
test("deliveries style pager uses existing callbacks",()=>{
 assert.match(page,/className="ys-category-v2-pagination"/);
 assert.match(page,/mobileCompact/);
 assert.match(page,/onPageChange=\{\(page\) => applyQuery\(\{ page \}\)\}/);
 assert.match(page,/onPageSizeChange=\{\(pageSize\) => applyQuery\(\{ page: 1, pageSize \}\)\}/);
 assert.match(css,/\.ys-category-v2-pagination \.ys-inventory-page-token \{ display: none;/);
 assert.match(css,/\.ys-category-v2-pagination \.ys-inventory-mobile-page-label \{ display: inline-flex;/);
});
test("live crop toggle wraps without overlap and preserves actual crop logic",()=>{
 assert.match(page,/ys-category-v2-crop-toolbar/);
 assert.match(page,/ys-category-v2-preview-toggle/);
 assert.match(page,/previewMode === "DESKTOP"/);
 assert.match(page,/previewMode === "MOBILE"/);
 assert.match(page,/calculateCategoryCoverCrop\(/);
 assert.match(page,/onCropStateChange/);
 assert.match(css,/\.ys-category-v2-crop-toolbar\s*\{[^}]*flex-direction: column;/);
 assert.match(css,/\.ys-category-v2-preview-toggle \{ display: grid; grid-template-columns: repeat\(2,minmax\(0,1fr\)\);/);
});
test("small phone, tablet, desktop, and dark-mode controls",()=>{
 assert.match(css,/@media \(max-width: 1024px\)/);
 assert.match(css,/@media \(max-width: 359px\)/);
 assert.match(css,/:root.dark \.app-shell-ambient \.ys-category-v2 \.ys-category-v2-desktop-filters select option/);
 assert.match(css,/color-scheme: dark !important;/);
});
