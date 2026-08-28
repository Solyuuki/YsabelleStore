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
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /Quick add/);
  assert.doesNotMatch(source, /ABOUT_STORE_ESSENTIAL_PRODUCT_IDS/);
  assert.doesNotMatch(source, /disabled=\{/);
  assert.doesNotMatch(source, />Unavailable</);
});

test("About storefront handoff uses the approved compact smart-retail headline", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(source, />From Local</);
  assert.match(source, />\s*to Smart Retail\s*</);
  assert.doesNotMatch(source, /From Local Roots/);
  assert.doesNotMatch(source, /to Smarter Retail\./);
  assert.match(source, /Live catalog/);
  assert.match(source, /Current stock/);
  assert.match(source, /Pickup ready/);
});

test("About storefront handoff keeps one primary catalog CTA", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.equal(source.match(/story-shop__primary-action/g)?.length, 1);
  assert.equal(source.match(/Shop the live catalog/g)?.length, 1);
  assert.doesNotMatch(source, /Open catalog/);
  assert.match(source, /Retry connection/);
});

test("About visible live-catalog identity renders the canonical Ysabelle brand mark", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(
    source,
    /import \{ YsabelleBrandMark \} from "@\/components\/customer\/YsabelleBrandMark";/
  );
  assert.match(
    source,
    /story-live-store__bar[\s\S]*?<YsabelleBrandMark[^>]*variant="mini"/,
    "The visible About live-catalog bar must render the shared canonical mark directly."
  );
  assert.doesNotMatch(
    source,
    /story-live-store__bar[\s\S]*?<Store aria-hidden="true" \/>/,
    "The visible About live-catalog identity must not depend on a generic Store glyph."
  );
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
  const layoutStyles = read("frontend/src/styles/about-storefront-handoff-layout.css");

  assert.match(page, /about-storefront-handoff\.css/);
  assert.match(page, /about-storefront-handoff-layout\.css/);
  assert.match(styles, /\.story-shop\.story-shop--refined/);
  assert.match(styles, /@media \(max-width: 840px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(
    layoutStyles,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(28rem,\s*34rem\)/
  );
  assert.match(layoutStyles, /\.story-shop__copy\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(layoutStyles, /\.story-mask__line\s*\{[\s\S]*?white-space:\s*normal;/);
  assert.match(layoutStyles, /\.story-mask__line--sky\s*\{[\s\S]*?font-style:\s*normal;/);
});

test("About storefront handoff keeps the narrow headline compact", () => {
  const layoutStyles = read("frontend/src/styles/about-storefront-handoff-layout.css");

  assert.match(
    layoutStyles,
    /@media \(max-width: 840px\)\s*\{[\s\S]*?\.story-shop__copy h2\s*\{[\s\S]*?max-width:\s*100%;[\s\S]*?font-size:\s*clamp\(2\.75rem,\s*8vw,\s*3\.4rem\);/
  );
});

test("About storefront handoff waits until scene 06 owns the viewport before revealing", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(source, /start:\s*"top top\+=76"/);
  assert.doesNotMatch(source, /start:\s*"top 78%"/);
  assert.match(
    source,
    /end:\s*\(\)\s*=>\s*`\+=\$\{Math\.max\(520,\s*Math\.round\(window\.innerHeight\s*\*\s*0\.72\)\)\}`/
  );
});
