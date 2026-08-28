import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function readOriginCss() {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  assert.match(page, /about-origin-timeline\.css/);
  return read("frontend/src/styles/about-origin-timeline.css");
}

test("About lower origin panel uses founding principles without repeating 2019", () => {
  const css = readOriginCss();

  assert.match(
    css,
    /\.about-experience \.discover-story \.story-origin-shelf__sign::before[\s\S]*?content:\s*"FOUNDING PRINCIPLES";/
  );
  assert.match(
    css,
    /\.about-experience \.discover-story \.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/
  );
  assert.match(css, /content:\s*"LOCAL BY NATURE\\A Neighborhood grocery";/);
  assert.match(css, /content:\s*"BUILT FOR DAILY LIFE\\A Everyday essentials";/);
  assert.match(css, /content:\s*"CLOSE TO HOME\\A Familiar Pasig retail";/);
  assert.match(
    css,
    /\.about-experience \.discover-story \.story-origin-shelf \.story-origin-shelf__item:nth-child\(4\)\s*\{[\s\S]*?display:\s*none;/
  );
  assert.doesNotMatch(css, /content:\s*"2019/);
  assert.doesNotMatch(css, /2019 \\2192 TODAY/);
  assert.doesNotMatch(css, /retail-display\.webp|clip-path:/);
});

test("About origin treatment is owned by its isolated stylesheet", () => {
  const css = readOriginCss();
  const premium = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\.about-experience \.discover-story \.story-origin-shelf\s*\{/);
  assert.match(
    css,
    /\.about-experience \.discover-story \.story-origin-shelf \.story-origin-shelf__item::before/
  );
  assert.doesNotMatch(premium, /story-origin-shelf/);
  assert.doesNotMatch(premium, /01 · DAILY|02 · PANTRY|03 · HOME|04 · CARE/);
});

test("About founding principles stack cleanly on small screens", () => {
  const css = readOriginCss();

  assert.match(
    css,
    /@media \(max-width: 840px\)[\s\S]*?\.about-experience \.discover-story \.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
  );
});
