import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("About origin shelf uses an editorial photographic retail treatment", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\/\* Premium origin shelf:/);
  assert.match(css, /\.discover-story \.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*1\.25fr 0\.9fr 0\.9fr 1\.05fr;/);
  assert.match(css, /beverages-retail-display\.webp/);
  assert.match(css, /bread-bakery-retail-display\.webp/);
  assert.match(css, /snacks-retail-display\.webp/);
  assert.match(css, /household-retail-display\.webp/);
  assert.match(css, /\.discover-story \.story-origin-shelf__line\s*\{[\s\S]*?height:\s*2px;/);
  assert.match(css, /\.discover-story \.story-origin-shelf__item svg\s*\{[\s\S]*?opacity:\s*0;/);
  assert.match(css, /\.discover-story \.story-origin-shelf__sign::before\s*\{[\s\S]*?content:\s*"NEIGHBORHOOD SHELF";/);
});

test("About origin shelf keeps a compact responsive photo grid", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(
    css,
    /@media \(max-width: 840px\)[\s\S]*?\.discover-story \.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
});
