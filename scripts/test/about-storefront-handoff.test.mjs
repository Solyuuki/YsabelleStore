import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("About and Discover keep distinct storefront-story endings", () => {
  const source = read("frontend/src/app/CustomerApp.tsx");

  assert.match(
    source,
    /import \{ AboutExperiencePage \} from "@\/pages\/customer\/AboutExperiencePage";/
  );
  assert.match(
    source,
    /pathname === "\/about"\) page = <AboutExperiencePage navigate=\{navigate\} \/>/
  );
  assert.match(
    source,
    /pathname === "\/discover"\) page = <DiscoverPage navigate=\{navigate\} \/>/
  );
});

test("About storefront handoff uses real in-stock catalog products", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(source, /fetchStorefrontProducts/);
  assert.match(source, /availability:\s*"in-stock"/);
  assert.match(source, /pageSize:\s*3/);
  assert.match(source, /Quick add/);
  assert.doesNotMatch(source, /ABOUT_STORE_ESSENTIAL_PRODUCT_IDS/);
  assert.doesNotMatch(source, /disabled=\{/);
  assert.doesNotMatch(source, />Unavailable</);
});

test("About storefront handoff closes the story with local-to-smart retail copy", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(source, /From Local Roots/);
  assert.match(source, /to Smarter Retail\./);
  assert.match(source, /Live catalog/);
  assert.match(source, /Current stock/);
  assert.match(source, /Pickup ready/);
});

test("About wrapper replaces only the legacy About ending", () => {
  const source = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.match(source, /useLayoutEffect/);
  assert.match(source, /discover-shop-legacy/);
  assert.match(source, /story-shop--legacy-hidden/);
  assert.match(source, /<DiscoverPage navigate=\{navigate\} \/>/);
  assert.match(source, /<AboutStorefrontHandoff navigate=\{navigate\} \/>/);
});

test("About storefront handoff has isolated responsive styling", () => {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const styles = read("frontend/src/styles/about-storefront-handoff.css");

  assert.match(page, /about-storefront-handoff\.css/);
  assert.match(styles, /\.story-shop\.story-shop--refined/);
  assert.match(styles, /@media \(max-width: 840px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
