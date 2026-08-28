import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("About origin shelf is a sculptural installation distinct from the photo-based essentials scene", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\/\* Premium origin shelf: sculptural retail installation/);
  assert.doesNotMatch(css, /retail-display\.webp/);
  assert.match(
    css,
    /\.discover-story \.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*1\.1fr 0\.9fr 0\.82fr 1fr;/
  );
  assert.match(
    css,
    /\.discover-story \.story-origin-shelf__sign::before\s*\{[\s\S]*?content:\s*"FOUNDATION \/ 2019";/
  );
  assert.match(
    css,
    /\.discover-story \.story-origin-shelf__item::before\s*\{[\s\S]*?box-shadow:/
  );
  assert.match(css, /content:\s*"01 · DAILY";/);
  assert.match(css, /content:\s*"02 · PANTRY";/);
  assert.match(css, /content:\s*"03 · HOME";/);
  assert.match(css, /content:\s*"04 · CARE";/);
  assert.match(
    css,
    /\.discover-story \.story-origin-shelf__line\s*\{[\s\S]*?height:\s*2px;/
  );
  assert.match(
    css,
    /\.discover-story \.story-origin-shelf__item svg\s*\{[\s\S]*?opacity:\s*0;/
  );
});

test("About sculptural origin shelf remains compact on small screens", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(
    css,
    /@media \(max-width: 840px\)[\s\S]*?\.discover-story \.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/
  );
});
