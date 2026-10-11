import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const theme = 'about-experience[data-about-hero-theme="dark"]';

test("About dark intelligence stylesheet applies only to the customer About route", () => {
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const css = read("frontend/src/styles/about-intelligence-dark.css");

  assert.match(page, /import "@\/styles\/about-intelligence-dark\.css";/);
  assert.match(page, /data-about-hero-theme=\{storefrontTheme\}/);
  assert.ok(css.includes(theme));
  assert.doesNotMatch(css, /(?:^|\n):root\.dark\b/);
});

test("All seven System Intelligence stages share the same complete dark workspace styling", () => {
  const component = read("frontend/src/components/customer/discover/SystemIntelligenceScene.tsx");
  const css = read("frontend/src/styles/about-intelligence-dark.css");

  for (const stage of ["sale", "stock", "history", "forecast", "decision", "review", "restock"]) {
    assert.match(component, new RegExp(`id: "${stage}"`));
  }
  for (const surface of [
    "system-preview__workspace",
    "system-preview__workspace-bar",
    "system-preview__workspace-copy",
    "system-preview__metric",
    "system-preview__table-card",
    "system-preview__chart-card",
    "system-preview__review-card",
    "system-preview__recommendation",
    "system-preview__decision-result",
    "system-preview__actions button",
    "system-preview__status-track",
    "system-preview__workspace-footer",
    "system-preview__nav button"
  ]) {
    assert.ok(css.includes(surface), `missing dark rule for ${surface}`);
  }
  assert.match(css, /\.system-preview__gridline \{\s*stroke:/);
  assert.match(css, /\.system-preview__history-dot \{\s*fill:/);
  assert.match(css, /\.system-preview__actions button\.is-primary\.is-selected/);
});

test("Forecast chart metrics, SVG labels and recommendation remain readable", () => {
  const css = read("frontend/src/styles/about-intelligence-dark.css");
  for (const surface of [
    "about-forecast-demo__topbar",
    "about-forecast-demo__metrics article",
    "about-forecast-demo__chart-panel",
    "about-forecast-demo__grid line",
    "about-forecast-demo__y-labels text",
    "about-forecast-demo__forecast-label",
    "about-forecast-demo__years strong",
    "about-forecast-demo__status"
  ]) {
    assert.ok(css.includes(surface), `missing dark treatment for ${surface}`);
  }
  assert.doesNotMatch(css, /\.about-forecast-demo__chart\s*\{[^}]*display:\s*none/);
});

test("Transitions fade between matching sales, forecast, intelligence and delivery colors", () => {
  const css = read("frontend/src/styles/about-intelligence-dark.css");
  assert.match(css, /--story-seam-34:\s*#17243c/);
  assert.match(css, /--story-seam-45:\s*#10182f/);
  assert.match(css, /--story-seam-56:\s*#09182f/);
  assert.match(css, /--about-sales-forecast-seam:\s*linear-gradient/);
  assert.match(css, /\.story-forecast::after \{[\s\S]*?mask-image:\s*linear-gradient\(to bottom/);
  assert.match(css, /\.story-intelligence \{\s*background:/);
  assert.match(css, /\.story-delivery \{\s*background:/);
  assert.doesNotMatch(css, /background(?:-image)?:\s*url\(/);
});

test("Only CSS changes: preserve videos, chart calculations, stage events, and interactions", () => {
  const css = read("frontend/src/styles/about-intelligence-dark.css");
  assert.doesNotMatch(css, /\.(?:about-sales-motion__video|about-catalog-motion__video|story-delivery__video)/);
  const component = read("frontend/src/components/customer/discover/SystemIntelligenceScene.tsx");
  assert.match(component, /onClick=\{\(\) => selectStage\(index\)\}/);
  assert.match(component, /<StageContent stageIndex=\{activeStage\}/);
  assert.match(component, /role="status"/);
});
