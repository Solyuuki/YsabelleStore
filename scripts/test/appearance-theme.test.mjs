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
  assert.match(bootstrap, /const safeRoute\s*=/);
  assert.match(bootstrap, /path\s*===\s*"\\/about"[\\s\\S]{0,160}path\s*===\s*"\\/discover"/);
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
  assert.ok(storefront.includes("ys-dark-graphite-glass.svg"));
  assert.ok(customer.includes("@/styles/theme-storefront-contrast.css"));
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


test("dedicated dark asset files exist and are referenced by scoped theme styles", () => {
  const storefront = read("frontend/src/styles/theme-storefront.css");
  const retail = read("frontend/src/styles/theme-retail.css");
  const assets = [
    ["frontend/public/textures/ys-dark-midnight-velvet.svg", "ys-dark-midnight-velvet.svg"],
    ["frontend/public/textures/ys-dark-graphite-glass.svg", "ys-dark-graphite-glass.svg"],
    ["frontend/public/textures/ys-dark-indigo-silk.svg", "ys-dark-indigo-silk.svg"],
    ["frontend/public/media/ys-dark-delivery-closing.svg", "ys-dark-delivery-closing.svg"]
  ];

  for (const [path, name] of assets) {
    const svg = read(path);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    assert.match(svg, /preserveAspectRatio="xMidYMid slice"/);
    assert.match(svg, /<\/svg>\s*$/);
    assert.ok(storefront.includes(name) || retail.includes(name), `Unused dark asset: ${name}`);
  }
  assert.doesNotMatch(storefront, /kpi-card-frosted-ribbon\.webp/);
  assert.doesNotMatch(retail, /kpi-card-frosted-ribbon\.webp/);
});

test("contrast layer uses semantic dark surfaces and is not applied to About", () => {
  const contrast = read("frontend/src/styles/theme-storefront-contrast.css");
  const app = read("frontend/src/app/CustomerApp.tsx");
  assert.match(app, /@\/styles\/theme-storefront-contrast\.css/);
  assert.match(contrast, /--store-contrast-ink: #d4deec/);
  assert.match(contrast, /--store-contrast-stroke: #687995/);
  assert.match(contrast, /customer-review-overview/);
  assert.match(contrast, /customer-account-history-card/);
  assert.match(contrast, /customer-auth-stage__panel/);
  assert.doesNotMatch(contrast, /\.about-experience|\.discover-story|\.story-welcome/);
});

test("printed receipts remain explicitly light", () => {
  const context = read("frontend/src/context/AppearanceContext.tsx");
  const print = read("frontend/src/styles/receipt.css");

  assert.match(context, /isReceiptPrint/);
  assert.match(print, /@media print/);
  assert.match(print, /background: #ffffff !important/);
});
