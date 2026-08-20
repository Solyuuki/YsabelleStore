import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("About storefront handoff uses live in-stock catalog products", () => {
  const source = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(source, /fetchStorefrontProducts/);
  assert.match(source, /availability:\s*"in-stock"/);
  assert.match(source, /pageSize:\s*3/);
  assert.doesNotMatch(source, /ABOUT_STORE_ESSENTIAL_PRODUCT_IDS/);
});

test("About storefront handoff closes the story with local-to-smart retail copy", () => {
  const source = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(source, /From Local Roots/);
  assert.match(source, /to Smarter Retail\./);
  assert.match(source, /Live catalog/);
  assert.match(source, /Pickup ready/);
});

test("About storefront handoff has isolated responsive styling", () => {
  const entry = read("frontend/src/main.tsx");
  const styles = read("frontend/src/styles/about-storefront-handoff.css");

  assert.match(entry, /about-storefront-handoff\.css/);
  assert.match(styles, /\.story-shop\.story-shop--refined/);
  assert.match(styles, /@media \(max-width: 840px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
