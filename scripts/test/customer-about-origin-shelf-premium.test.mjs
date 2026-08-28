import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function readTimelineCss() {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  assert.match(page, /about-origin-timeline\.css/);
  return read("frontend/src/styles/about-origin-timeline.css");
}

test("About origin chapter uses a distinct 2019-to-today editorial timeline", () => {
  const css = readTimelineCss();

  assert.match(css, /\.about-experience \.story-origin-shelf__items::before[\s\S]*?content:\s*"2019";/);
  assert.match(css, /\.about-experience \.story-origin-shelf__items::after[\s\S]*?content:\s*"2019 \\2192 TODAY";/);
  assert.match(css, /content:\s*"NEIGHBORHOOD STORE";/);
  assert.match(css, /content:\s*"EVERYDAY ESSENTIALS";/);
  assert.match(css, /content:\s*"PASIG CITY";/);
  assert.match(css, /content:\s*"CONNECTED RETAIL";/);
  assert.doesNotMatch(css, /retail-display\.webp|clip-path:/);
});

test("About origin timeline collapses cleanly on small screens", () => {
  const css = readTimelineCss();

  assert.match(css, /@media \(max-width: 840px\)[\s\S]*?\.about-experience \.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
});
