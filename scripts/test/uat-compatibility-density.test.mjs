import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Static responsive contracts. A separate browser review is still necessary
// for actual layout, contrast, keyboard navigation and device behavior.
const css = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("UAT: narrow phone product cards reflow controls without shrinking tap targets", () => {
  const mobile = css("frontend/src/styles/customer-adaptive-mobile.css");
  assert.match(mobile, /@media \(max-width: 390px\) and \(orientation: portrait\)/);
  assert.match(mobile, /\.customer-app \.customer-product-card__purchase-row \{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(mobile, /\.customer-app \.customer-product-card__actions \.customer-quantity \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(mobile, /\.customer-app \.customer-product-card__actions \.customer-quantity > button \{\s*min-width: 0;\s*min-height: 44px/);
  assert.match(mobile, /\.customer-app \.customer-product-card__actions \.customer-button \{\s*min-height: 44px/);
});

test("UAT: recovery slots and progress fit narrow phones", () => {
  const recovery = css("frontend/src/styles/customer-auth-recovery.css");
  assert.match(recovery, /@media \(max-width: 390px\)/);
  assert.match(recovery, /\.customer-recovery-code-slots \{\s*min-width: 0;\s*gap: 0\.25rem/);
  assert.match(recovery, /\.customer-recovery-code-slot \{\s*min-width: 0;\s*min-height: 48px/);
  assert.match(recovery, /\.customer-recovery-actions--verify \{\s*flex-wrap: wrap/);
});

test("UAT: checkout reflows between phone and tablet without changing validation", () => {
  const checkout = css("frontend/src/styles/customer-commerce-premium.css");
  assert.match(checkout, /@media \(min-width: 641px\) and \(max-width: 1100px\)/);
  assert.match(checkout, /\.customer-checkout-layout \{\s*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(checkout, /@media \(max-width: 700px\)/);
  assert.match(checkout, /\.customer-checkout-page \.customer-checkout-form section \{\s*min-width: 0/);
  assert.match(checkout, /\.customer-checkout-page input\[aria-invalid="true"\]/);
});

test("UAT: dark retail sidebar secondary labels remain readable", () => {
  const retail = css("frontend/src/styles/theme-retail.css");
  assert.match(retail, /:root\.dark \.app-shell-ambient > aside :is\(/);
  assert.match(retail, /color: #cbd5e8 !important/);
});
