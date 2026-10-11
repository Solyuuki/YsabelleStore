import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("quantity control uses the same whole-unit input in Shop, Cart and Favorites", () => {
  const control = read("frontend/src/components/customer/QuantityControl.tsx");
  const cart = read("frontend/src/pages/customer/CartPage.tsx");
  const card = read("frontend/src/components/customer/ProductCard.tsx");
  const favorites = read("frontend/src/pages/customer/CustomerAccountPage.tsx");

  assert.match(control, /className="customer-quantity"/);
  assert.match(control, /parseWholeUnitQuantity\(event\.target\.value\)/);
  assert.match(control, /pattern="\[0-9\]\*"/);
  assert.match(control, /type="text"/);
  assert.match(cart, /<QuantityControl/);
  assert.match(card, /<QuantityControl/);
  assert.match(favorites, /<ProductCard/);
});

test("dark quantity input is transparent across all Storefront pages, not just Shop", () => {
  const css = read("frontend/src/styles/theme-storefront-contrast.css");
  const rule = css.match(/:root\.dark \.customer-app \.customer-quantity > input \{([^}]+)\}/);
  assert.ok(rule, "Missing shared dark-mode quantity input override");
  const declarations = rule[1];
  assert.match(declarations, /background: transparent !important/);
  assert.match(declarations, /background-color: transparent !important/);
  assert.match(declarations, /background-image: none !important/);
  assert.match(declarations, /border: 0 !important/);
  assert.match(declarations, /box-shadow: none !important/);
  assert.match(declarations, /outline: none !important/);
  assert.doesNotMatch(css, /\.customer-shop-page \.customer-quantity > input/);
});

test("the shared rounded control retains a visible focus ring", () => {
  const css = read("frontend/src/styles/theme-storefront-contrast.css");
  assert.match(
    css,
    /:root\.dark \.customer-app \.customer-quantity:focus-within \{\s*outline: 2px solid #b1a3f5;\s*outline-offset: 2px;/
  );
  const base = read("frontend/src/styles/customer.css");
  assert.match(base, /\.customer-quantity \{[^}]*overflow: hidden;[^}]*border-radius:/);
  assert.match(base, /\.customer-quantity button,\s*\.customer-quantity input \{/);
});
