import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("About chapter 02 is owned by the isolated catalog-intelligence stylesheet", () => {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const css = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(page, /about-catalog-intelligence\.css/);
  assert.match(css, /\.about-experience \.discover-story \.story-catalog\s*\{/);
  assert.doesNotMatch(page, /about-origin-timeline\.css/);
});

test("About catalog headline preserves italic descenders without clipping", () => {
  const css = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(
    css,
    /story-catalog__copy h2[\s\S]*?overflow:\s*visible[\s\S]*?line-height:\s*1\.02/
  );
  assert.match(
    css,
    /story-mask:last-child[\s\S]*?overflow:\s*visible[\s\S]*?padding:\s*0\.08em 0\.14em 0\.42em 0\.08em/
  );
  assert.match(
    css,
    /story-mask:last-child \.story-mask__line[\s\S]*?display:\s*inline-block[\s\S]*?width:\s*max-content[\s\S]*?line-height:\s*1\.12/
  );
});

test("About catalog pipeline keeps five lightweight stages", () => {
  const css = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(
    css,
    /story-catalog__steps[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/
  );
  assert.match(
    css,
    /story-catalog__step,[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none/
  );
});

test("About catalog motion keeps seamless dual-video crossfade behavior", () => {
  const motion = read("frontend/src/components/customer/about/AboutCatalogMotion.tsx");
  const css = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(motion, /gemini_generated_video_a80f6413\.mp4/);
  assert.match(motion, /CROSSFADE_LEAD_SECONDS = 0\.85/);
  assert.match(motion, /videoRefs/);
  assert.match(motion, /IntersectionObserver/);
  assert.match(css, /about-catalog-motion__video[\s\S]*?transition:\s*opacity 680ms linear/);
});

test("About catalog layout collapses cleanly for tablet and mobile widths", () => {
  const css = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(
    css,
    /@media \(max-width: 1023px\)[\s\S]*?story-catalog__stage[\s\S]*?grid-template-columns:\s*1fr/
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*?story-catalog__copy h2[\s\S]*?font-size:\s*clamp\(2\.6rem, 12vw, 4rem\)/
  );
});

test("About catalog motion honors reduced-motion preferences", () => {
  const css = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?about-catalog-motion__video[\s\S]*?display:\s*none/
  );
  assert.match(
    css,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?about-catalog-motion__fallback[\s\S]*?opacity:\s*1/
  );
});
