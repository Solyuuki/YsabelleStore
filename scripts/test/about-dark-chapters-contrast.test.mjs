import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const scope = '.about-experience[data-about-hero-theme="dark"]';

test("About sections 02 and 03 reuse the exact Storefront galaxy variable", () => {
  const css = read("frontend/src/styles/about-dark-chapters.css");
  const shared = read("frontend/src/styles/theme-retail.css");
  const experience = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.match(shared, /\/\* Shared storefront galaxy palette:[\s\S]*?:root \{\s*--storefront-galaxy-background:/);
  assert.match(experience, /import "@\/styles\/about-dark-chapters\.css";/);
  assert.ok(css.includes(`${scope} .discover-story--about .story-catalog`));
  assert.ok(css.includes(`${scope} .discover-story--about .story-sales`));
  assert.equal((css.match(/var\(--storefront-galaxy-background\)/g) ?? []).length, 2);
  assert.doesNotMatch(css, /(?:background-image|background-size):\s*url\(/);
});

test("Dark chapter overrides remain scoped and protect motion videos", () => {
  const css = read("frontend/src/styles/about-dark-chapters.css");

  assert.match(css, /story-catalog__copy h2\s*\{\s*color: #f2f5ff;/);
  assert.match(css, /story-catalog__copy p\s*\{\s*color: #d2dcf0;/);
  assert.match(css, /story-catalog__summary\s*\{\s*color: #afbeda;/);
  assert.match(css, /story-sales__copy p\s*\{\s*color: #d7e0f4;/);
  assert.match(css, /story-sales__summary\s*\{\s*color: #b8c7e5;/);
  assert.match(css, /discover-progress__dot\s*\{/);
  assert.match(css, /discover-progress a:focus-visible\s*\{/);
  assert.doesNotMatch(css, /\.about-(?:catalog|sales)-motion(?:__video|__fallback|__glass)?/);
  assert.doesNotMatch(css, /(^|\n):root\.dark\s/m);
});

test("About hero appearance selector still comes from storefront preference", () => {
  const experience = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  assert.match(experience, /const \{ storefrontTheme \} = useAppearance\(\)/);
  assert.match(experience, /data-about-hero-theme=\{storefrontTheme\}/);
});
