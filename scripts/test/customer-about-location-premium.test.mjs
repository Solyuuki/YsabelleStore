import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("About location uses a balanced premium map and copy composition", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\.discover-story \.story-location__stage/);
  assert.match(css, /grid-template-columns:\s*minmax\(0, 1\.08fr\) minmax\(320px, 0\.92fr\)/);
  assert.match(css, /\.discover-story \.story-location__copy/);
  assert.match(css, /backdrop-filter:\s*blur\(18px\)/);
  assert.match(css, /\.discover-story \.story-real-map iframe/);
  assert.match(css, /inset:\s*0\.55rem/);
  assert.match(css, /width:\s*calc\(100% - 1\.1rem\)/);
});

test("About welcome decorative rings stay complete and contained on desktop", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /@media \(min-width: 841px\)/);
  assert.match(css, /\.discover-story \.story-brand-path--one/);
  assert.match(css, /left:\s*clamp\(2rem, 6vw, 6rem\)/);
  assert.match(css, /\.discover-story \.story-brand-path--two/);
  assert.match(css, /right:\s*clamp\(2rem, 5vw, 5rem\)/);
  assert.doesNotMatch(css, /right:\s*clamp\(-/);
  assert.doesNotMatch(css, /bottom:\s*clamp\(-/);
});

test("About story progress rail uses the premium glass navigation treatment", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\.discover-story \.discover-progress/);
  assert.match(css, /backdrop-filter:\s*blur\(16px\)/);
  assert.match(css, /box-shadow:\s*0 18px 44px/);
  assert.match(css, /\.discover-story \.discover-progress li\.is-active a/);
  assert.match(css, /linear-gradient\(135deg, var\(--story-blue\), var\(--story-indigo\), var\(--story-violet\)\)/);
});
