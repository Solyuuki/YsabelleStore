import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(
  new URL("../../frontend/src/pages/customer/ShopPage.tsx", import.meta.url),
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
  assert.match(productGridSource, /className="customer-product-grid shop-product-grid is-visible"/);

  assert.match(source, /const categoryNavigationReveal = useRevealOnView<HTMLElement>/);
  assert.match(source, /ref=\{categoryNavigationReveal\.ref\}/);
});
