import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const lightSelector = '.about-experience[data-about-hero-theme="light"]';

test("About Light Mode stylesheet is imported and explicitly scoped", () => {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const css = read("frontend/src/styles/about-light-chapters.css");

  assert.match(page, /import "@\/styles\/about-light-chapters\.css";/);
  assert.match(page, /data-about-hero-theme=\{storefrontTheme\}/);
  assert.match(css, /data-about-hero-theme="light"/);
  assert.doesNotMatch(css, /data-about-hero-theme="dark"/);
  assert.doesNotMatch(css, /:root\.dark/);
  assert.equal((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length);
});

test("All chapter seam colors are matching soft light colors", () => {
  const css = read("frontend/src/styles/about-light-chapters.css");
  for (const color of [
    "--story-seam-12: #e5e9fb",
    "--story-seam-23: #f0f2ff",
    "--story-seam-34: #edf4ff",
    "--story-seam-45: #f1f5ff",
    "--story-seam-56: #edf3ff"
  ]) assert.ok(css.includes(color), `missing light seam ${color}`);

  for (const scene of ["story-catalog", "story-sales", "story-forecast", "story-intelligence", "story-delivery"]) {
    assert.ok(css.includes(`.${scene} {`) || css.includes(`.${scene},`), `missing ${scene}`);
  }
  assert.match(css, /\.story-forecast::after \{\s*background: linear-gradient/);
  assert.match(css, /\.story-sales::after \{\s*background: linear-gradient/);
  assert.doesNotMatch(css, /background(?:-image)?:\s*url\(/);
});

test("Sales and Forecast legibility is restored on light background", () => {
  const css = read("frontend/src/styles/about-light-chapters.css");
  for (const selector of [
    "story-sales__copy h2",
    "story-sales__copy p",
    "story-sales__copy .story-kicker",
    "story-forecast__header h2",
    "story-forecast__lead",
    "story-forecast__model small",
    "story-forecast__takeaway"
  ]) assert.ok(css.replace(/\s+/g, " ").includes(selector), `missing light text color for ${selector}`);
  assert.match(css, /\.story-sales__copy p \{\s*color: #455470;/);
  assert.match(css, /\.story-forecast__lead \{\s*color: #495974;/);
});

test("Interactive seven-stage System Intelligence receives pale nav and readable text", () => {
  const css = read("frontend/src/styles/about-light-chapters.css");
  const sys = read("frontend/src/components/customer/discover/SystemIntelligenceScene.tsx");
  for (const stage of ["sale", "stock", "history", "forecast", "decision", "review", "restock"])
    assert.ok(sys.includes(`id: "${stage}"`));

  for (const selector of [
    "story-intelligence h2",
    "story-intelligence__heading-grid p",
    "system-preview__nav",
    "system-preview__nav button",
    "system-preview__nav button.is-active",
    "system-preview__nav-icon",
    "system-preview__workspace"
  ]) assert.ok(css.replace(/\s+/g, " ").includes(selector), `missing ${selector}`);

  assert.ok(css.includes(`${lightSelector} .system-preview__nav`));
  assert.match(sys, /onClick=\{\(\) => selectStage\(index\)\}/);
});

test("Delivery text and CTA contrast are light-themed without changing the MP4", () => {
  const css = read("frontend/src/styles/about-light-chapters.css");
  for (const selector of [
    "story-delivery__copy h2",
    "story-delivery__tagline",
    "story-delivery__lead",
    "story-delivery__proofs li",
    "story-delivery__primary-action",
    "story-delivery__primary-action:hover",
    "story-delivery__frame"
  ]) assert.ok(css.replace(/\s+/g, " ").includes(selector), `missing ${selector}`);
  assert.doesNotMatch(css, /\.story-delivery__video|\.about-sales-motion__video/);
  assert.doesNotMatch(css, /animation:|clip-path:|object-fit:|\.about-welcome-motion__video/);
});

test("Delivery CTA overrides global !important purple text in Light Mode, including hover and focus", () => {
  const css = read("frontend/src/styles/about-light-chapters.css");
  const global = read("frontend/src/styles/customer.css");
  const delivery = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(global, /\.customer-button--light \{[^}]*color:\s*var\(--customer-primary-strong\) !important;/);
  assert.match(delivery, /customer-button--light story-delivery__primary-action/);
  assert.match(css.replace(/\s+/g, " "), /\.story-delivery \.customer-button--light\.story-delivery__primary-action \{[^}]*background:\s*#5953d8;[^}]*color:\s*#fff !important;/);
  assert.match(css.replace(/\s+/g, " "), /story-delivery__primary-action:is\(\s*:hover,\s*:focus-visible,\s*:visited\s*\)\s*\{[^}]*color:\s*#fff !important;/);
  assert.match(css.replace(/\s+/g, " "), /story-delivery__primary-action:hover \{[^}]*background:\s*#4b46c8;[^}]*color:\s*#fff !important;/);
  assert.match(css.replace(/\s+/g, " "), /story-delivery__primary-action:focus-visible \{[^}]*outline:/);
});

test("Approved dark chapter rules and light story video references are preserved", () => {
  const dark = read("frontend/src/styles/about-intelligence-dark.css");
  const previousDark = read("frontend/src/styles/about-dark-chapters.css");
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  assert.match(dark, /data-about-hero-theme="dark"/);
  assert.match(previousDark, /data-about-hero-theme="dark"/);
  assert.match(page, /import "@\/styles\/about-intelligence-dark\.css";/);
  assert.match(page, /import "@\/styles\/about-welcome-motion\.css";/);
});
