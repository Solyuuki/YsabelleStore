import assert from "node:assert/strict";
import fs from "node:fs";

const header = fs.readFileSync(
  new URL("../frontend/src/components/customer/CustomerHeader.tsx", import.meta.url),
  "utf8"
);
const css = fs.readFileSync(
  new URL("../frontend/src/styles/customer-header-actions.css", import.meta.url),
  "utf8"
);

const actionsStart = header.indexOf('className="customer-header__actions"');
assert.notEqual(actionsStart, -1, "Customer header action group must exist.");
const actions = header.slice(actionsStart);

const guideIndex = actions.indexOf("customer-help-button");
const dividerIndex = actions.indexOf("customer-header__action-divider");
const accountIndex = actions.indexOf("customer-account-link");
const cartIndex = actions.indexOf("customer-cart-link");

assert.ok(guideIndex >= 0, "Guide action must exist.");
assert.ok(accountIndex >= 0, "Account action must exist.");
assert.ok(cartIndex >= 0, "Cart action must exist.");
assert.ok(
  guideIndex < accountIndex && accountIndex < cartIndex,
  "Desktop actions must be ordered Guide -> Sign In/Account -> Cart."
);
assert.ok(
  guideIndex < dividerIndex && dividerIndex < accountIndex,
  "A subtle divider must separate Guide from account and commerce actions."
);

assert.match(
  css,
  /\.customer-help-button\s*\{[^}]*background:\s*transparent;/s,
  "Guide must be visually quiet by default."
);
assert.match(
  css,
  /\.customer-account-link\s*\{[^}]*background:\s*transparent;/s,
  "Account must not use the old purple capsule treatment."
);
assert.match(
  css,
  /\.customer-cart-link\s*\{[^}]*border:[^;}]+;[^}]*background:/s,
  "Cart must remain the strongest compact control."
);
assert.match(
  css,
  /\.customer-header__action-divider\s*\{[^}]*width:\s*1px;/s,
  "Action divider must be a subtle 1px separator."
);
assert.match(css, /:focus-visible/s, "Header action polish must preserve keyboard focus styling.");
assert.match(
  css,
  /@media\s*\(max-width:\s*900px\)/s,
  "Header action polish must preserve a deliberate mobile collapse rule."
);

/* Every storefront route shares CustomerHeader, including Sign In/Register.
   Its three navigation links need underline-only hover/active states in dark mode. */
const themeCss = fs.readFileSync(
  new URL("../frontend/src/styles/theme-storefront.css", import.meta.url),
  "utf8"
);
const baseCss = fs.readFileSync(
  new URL("../frontend/src/styles/customer.css", import.meta.url),
  "utf8"
);
assert.match(
  baseCss,
  /\.customer-nav a:hover::after,[\s\S]*?\.customer-nav a\[aria-current="page"\]::after\s*\{\s*transform:\s*scaleX\(1\)/,
  "Home / Shop / About must retain their hover and active underlines."
);
assert.match(
  themeCss,
  /:root\.dark \.customer-app \.customer-nav a:is\(:hover, :focus-visible, \[aria-current="page"\]\)\s*\{\s*background:\s*transparent;/,
  "Dark nav links must not show a rectangular hover or active fill."
);
assert.match(
  themeCss,
  /:root\[data-about-chrome-theme="dark"\] \.customer-app \.customer-header \.customer-nav a:is\([\s\S]*?\)\s*\{\s*background:\s*transparent;/,
  "About chrome theme must use the same clean dark nav hover treatment."
);
assert.doesNotMatch(
  themeCss,
  /\.customer-account-link:hover,\s*:root\.dark \.customer-app \.customer-nav a:hover\s*\{\s*background:\s*#303957/,
  "Old header nav box rule must not be restored."
);
assert.match(
  themeCss,
  /:root\.dark \.customer-app \.customer-cart-link:hover,\s*:root\.dark \.customer-app \.customer-account-link:hover\s*\{\s*background:\s*#303957/,
  "Cart and account hover surfaces must remain unchanged."
);

console.log("Customer header action hierarchy contract passed.");
