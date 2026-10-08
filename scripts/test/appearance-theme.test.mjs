import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("storefront and retail keep independent persisted appearance preferences", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");

  assert.match(context, /ysabellestore\.appearance\.storefront\.v1/);
  assert.match(context, /ysabellestore\.appearance\.retail\.v1/);
  assert.match(context, /getAppearanceScope/);
  assert.match(context, /window\.localStorage\.setItem/);
  assert.match(context, /root\.classList\.toggle\("dark", dark\)/);
});

test("the About scenes and receipt print routes are excluded from dark rendering", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");
  const bootstrap = read("frontend/index.html");
  const storefrontStyles = read("frontend/src/styles/theme-storefront.css");

  assert.match(context, /pathname === "\/about" \|\| pathname === "\/discover"/);
  assert.match(context, /get\("print"\) === "receipt"/);
  assert.match(bootstrap, /path === "\/about" \|\| path === "\/discover"/);
  assert.doesNotMatch(storefrontStyles, /\.about-experience|\.discover-story|\.story-welcome/);
});

test("both appearance controls and theme styles are loaded without changing Light Mode", () => {
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const settings = read("frontend/src/pages/SettingsPage.tsx");
  const customer = read("frontend/src/app/CustomerApp.tsx");
  const main = read("frontend/src/main.tsx");
  const retail = read("frontend/src/styles/theme-retail.css");
  const storefront = read("frontend/src/styles/theme-storefront.css");

  assert.match(header, /className="customer-theme-toggle"/);
  assert.match(header, /aria-pressed=\{storefrontTheme === "dark"\}/);
  assert.match(settings, /className="ys-appearance-options"/);
  assert.match(settings, /setRetailTheme\("dark"\)/);
  assert.match(customer, /@\/styles\/theme-storefront\.css/);
  assert.match(main, /@\/styles\/theme-retail\.css/);
  assert.match(retail, /:root\.dark \.app-shell-ambient/);
  assert.match(storefront, /:root\.dark \.customer-app/);
  assert.match(storefront, /frosted-ribbon\.webp/);
});


test("dark home category portal and SVG merchandising canvas never reuse light fills", () => {
  const dark = read("frontend/src/styles/theme-storefront.css");
  const home = read("frontend/src/styles/customer-home-premium.css");
  const about = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.match(home, /\.home-categories__center-light/);
  assert.match(home, /--merch-bg-top:/);
  assert.match(dark, /:root\.dark \.customer-app \.home-categories \{/);
  assert.match(dark, /:root\.dark \.customer-app \.home-categories__center-light/);
  assert.match(dark, /:root\.dark \.customer-app \.home-categories__handoff > path:nth-child\(2\)/);
  assert.match(dark, /:root\.dark \.customer-app \.home-category-merch-handoff/);
  assert.match(dark, /--merch-bg-top: #17243c/);
  assert.match(dark, /\.home-categories \.home-category-card__body small/);
  assert.doesNotMatch(dark, /\.about-experience|\.discover-story|\.story-welcome/);
  assert.match(about, /const storyTheme/);
});

test("printed receipts remain explicitly light", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");
  const print = read("frontend/src/styles/receipt.css");

  assert.match(context, /isReceiptPrint/);
  assert.match(print, /@media print/);
  assert.match(print, /background: #ffffff !important/);
});
