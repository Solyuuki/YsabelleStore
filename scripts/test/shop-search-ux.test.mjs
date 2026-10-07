import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../../frontend/src/pages/customer/ShopPage.tsx", import.meta.url),
  "utf8"
);
const appShellSource = readFileSync(
  new URL("../../frontend/src/app/AppShell.tsx", import.meta.url),
  "utf8"
);

test("shop search auto-applies without an Apply button", () => {
  assert.match(source, /const SEARCH_DEBOUNCE_MS = 350/);
  assert.match(source, /window\.setTimeout\([\s\S]*SEARCH_DEBOUNCE_MS/);
  assert.match(source, /search\.trim\(\)/);
  assert.doesNotMatch(source, />\s*Apply\s*</);
});

test("availability applies immediately and keeps keyboard search submission", () => {
  assert.match(source, /function applyAvailability\(/);
  assert.match(source, /onChange=\{\(event\) => applyAvailability\(/);
  assert.match(source, /onSubmit=\{submit\}/);
  assert.doesNotMatch(source, /const \[availability, setAvailability\]/);
});

test("loaded products stay visible without animation gating while sidebar keeps its reveal", () => {
  const productGridStart = source.indexOf("function ShopProductGrid");
  assert.notEqual(productGridStart, -1);

  const productGridSource = source.slice(productGridStart);
  assert.doesNotMatch(productGridSource, /useRevealOnView/);
  assert.doesNotMatch(productGridSource, /requestAnimationFrame/);
  assert.doesNotMatch(productGridSource, /hasEntered/);
  assert.match(productGridSource, /customer-product-grid shop-product-grid is-visible/);
  assert.match(productGridSource, /isRefreshing \? " is-refreshing" : ""/);

  assert.match(source, /const categoryNavigationReveal = useRevealOnView<HTMLElement>/);
  assert.match(source, /ref=\{categoryNavigationReveal\.ref\}/);
});


test("shop category navigation preserves the current scroll position", () => {
  assert.match(appShellSource, /function shouldPreserveShopCategoryScroll/);
  assert.ok(
    appShellSource.includes('const shopBrowsePath = /^\\/shop(?:\\/category\\/[^/]+)?$/;')
  );
  assert.match(appShellSource, /currentUrl\.pathname !== nextUrl\.pathname/);
  assert.match(appShellSource, /else if \(!preserveShopCategoryScroll\)/);
});


test("category refresh stages a delayed loader and keeps the current grid mounted", () => {
  assert.match(source, /const CATALOG_REFRESH_LOADER_DELAY_MS = 180/);
  assert.match(source, /const CATALOG_ENTER_DURATION_MS = 260/);
  assert.match(source, /setShowRefreshLoader\(true\)/);
  assert.match(source, /CATALOG_REFRESH_LOADER_DELAY_MS/);
  assert.match(source, /setGridEntering\(true\)/);
  assert.match(source, /CATALOG_ENTER_DURATION_MS/);
  assert.match(source, /loading && !products\.length/);
  assert.match(source, /products\.length \? \(/);
  assert.match(source, /isRefreshing=\{loading\}/);
  assert.match(source, /isEntering=\{gridEntering\}/);
  assert.match(source, /ShopCatalogRefreshLoader visible=\{showRefreshLoader\}/);
  assert.match(source, /Updating aisle…/);
  assert.match(source, /aria-busy=\{loading\}/);
});
