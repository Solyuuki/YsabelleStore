import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function readOriginCss() {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  assert.match(page, /about-origin-timeline\.css/);
  return read("frontend/src/styles/about-origin-timeline.css");
}

test("About origin uses an open shelf-edge editorial treatment", () => {
  const css = readOriginCss();

  assert.match(css, /shelf-edge editorial/);
  assert.match(
    css,
    /\.story-origin-shelf\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;[\s\S]*?backdrop-filter:\s*none;/
  );
  assert.match(css, /content:\s*"NEIGHBORHOOD ORIGIN";/);
  assert.match(css, /content:\s*"Built close to home\.";/);
  assert.match(css, /content:\s*"LOCAL STORE\\A Neighborhood roots";/);
  assert.match(css, /content:\s*"PASIG CITY\\A Close to home";/);
  assert.match(css, /content:\s*"EVERYDAY ESSENTIALS\\A Built for daily life";/);
  assert.doesNotMatch(css, /FOUNDING PRINCIPLES|What shaped the store\./);
  assert.doesNotMatch(css, /content:\s*"2019/);
});

test("About origin remains owned by its isolated stylesheet", () => {
  const css = readOriginCss();
  const premium = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\.about-experience \.discover-story \.story-origin-shelf\s*\{/);
  assert.doesNotMatch(premium, /story-origin-shelf/);
});

test("About shelf-edge editorial stacks cleanly on small screens", () => {
  const css = readOriginCss();

  assert.match(
    css,
    /@media \(max-width: 840px\)[\s\S]*?\.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
  );
});
