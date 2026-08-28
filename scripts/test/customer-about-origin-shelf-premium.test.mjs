import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function readOriginCss() {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  assert.match(page, /about-origin-timeline\.css/);
  return read("frontend/src/styles/about-origin-timeline.css");
}

test("About origin uses one integrated premium editorial band", () => {
  const css = readOriginCss();

  assert.match(css, /integrated origin editorial band/);
  assert.match(
    css,
    /\.story-origin-shelf\s*\{[\s\S]*?display:\s*block;[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/
  );
  assert.match(css, /\.story-origin-shelf__sign\s*\{[\s\S]*?display:\s*none;/);
  assert.match(
    css,
    /\.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/
  );
  assert.match(css, /content:\s*"01";/);
  assert.match(css, /content:\s*"02";/);
  assert.match(css, /content:\s*"03";/);
  assert.match(css, /content:\s*"LOCAL ROOTS\\A Neighborhood store";/);
  assert.match(css, /content:\s*"PASIG CITY\\A Serving close to home";/);
  assert.match(css, /content:\s*"EVERYDAY ESSENTIALS\\A Built for daily life";/);
  assert.doesNotMatch(css, /Built close to home\.|NEIGHBORHOOD ORIGIN|FOUNDING PRINCIPLES/);
  assert.doesNotMatch(css, /content:\s*"2019/);
});

test("About origin band uses restrained premium hierarchy and ambient depth", () => {
  const css = readOriginCss();

  assert.match(css, /--origin-band-glow:/);
  assert.match(css, /\.story-origin-shelf::before\s*\{[\s\S]*?filter:\s*blur\(42px\);/);
  assert.match(
    css,
    /\.story-origin-shelf \.story-origin-shelf__item::before\s*\{[\s\S]*?font-size:\s*clamp\(3\.2rem, 5\.4vw, 5\.4rem\);[\s\S]*?color:\s*rgb\(98 91 255 \/ 8%\);/
  );
  assert.match(
    css,
    /\.story-origin-shelf \.story-origin-shelf__item::after\s*\{[\s\S]*?font-size:\s*clamp\(0\.8rem, 0\.95vw, 0\.94rem\);[\s\S]*?font-weight:\s*760;/
  );
  assert.match(css, /border-left:\s*1px solid rgb\(98 91 255 \/ 7%\)/);
  assert.match(css, /\.story-origin-shelf__line\s*\{[\s\S]*?height:\s*1px;/);
  assert.match(css, /min-height:\s*clamp\(6\.3rem, 8vw, 7\.6rem\)/);
});

test("About origin band remains owned by its isolated stylesheet", () => {
  const css = readOriginCss();
  const premium = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\.about-experience \.discover-story \.story-origin-shelf\s*\{/);
  assert.doesNotMatch(premium, /story-origin-shelf/);
});

test("About origin editorial band stacks cleanly on small screens", () => {
  const css = readOriginCss();

  assert.match(
    css,
    /@media \(max-width: 840px\)[\s\S]*?\.story-origin-shelf__items\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
  );
});
