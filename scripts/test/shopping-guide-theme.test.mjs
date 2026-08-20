import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("shopping guide loads Driver defaults before the isolated Ysabelle theme", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const driverIndex = app.indexOf('import "driver.js/dist/driver.css";');
  const customerIndex = app.indexOf('import "@/styles/customer.css";');
  const guideIndex = app.indexOf('import "@/styles/shopping-guide.css";');

  assert.ok(driverIndex >= 0, "CustomerApp must load Driver.js base styles");
  assert.ok(customerIndex > driverIndex, "customer.css must load after Driver defaults");
  assert.ok(guideIndex > customerIndex, "shopping-guide.css must load last");
});

test("shopping guide config uses storefront colors and waits for async product targets", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");

  assert.doesNotMatch(source, /driver\.js\/dist\/driver\.css/);
  assert.match(source, /waitForElement:\s*4_000/);
  assert.match(source, /overlayColor:\s*"#101426"/);
  assert.match(source, /overlayOpacity:\s*0\.52/);
  assert.match(source, /popover\.closeButton\.textContent\s*=\s*"Skip"/);
});

test("shopping guide transitions between distant targets without making the popover chase scrolling", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");

  assert.match(source, /smoothScroll:\s*false/);
  assert.match(source, /duration:\s*prefersReducedMotion\s*\?\s*0\s*:\s*520/);
  assert.match(source, /onNextClick:/);
  assert.match(source, /onPrevClick:/);
  assert.match(source, /scrollIntoView\(\{/);
  assert.match(source, /behavior:\s*prefersReducedMotion\s*\?\s*"auto"\s*:\s*"smooth"/);
  assert.match(source, /block:\s*"center"/);
  assert.match(source, /wrapper\.classList\.add\("is-transitioning"\)/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /\.home-categories \.home-section-heading/);
  assert.doesNotMatch(source, /element:\s*'\[data-tour="start-shopping"\]'/);
});

test("shopping guide popover is self-themed and aligned without customer-app scoped variables", () => {
  const styles = read("frontend/src/styles/shopping-guide.css");

  assert.match(styles, /--guide-primary:\s*#625bff/);
  assert.match(styles, /--guide-ink:\s*#101426/);
  assert.match(styles, /font-family:\s*var\(--font-sans\)/);
  assert.doesNotMatch(styles, /var\(--customer-/);
  assert.match(styles, /driver-popover-title[\s\S]*?padding-right:\s*4rem/);
  assert.match(styles, /driver-popover-close-btn[\s\S]*?position:\s*absolute/);
  assert.match(styles, /driver-popover-footer[\s\S]*?justify-content:\s*space-between/);
  assert.match(styles, /driver-popover-next-btn[\s\S]*?background:\s*var\(--guide-primary\)/);
  assert.match(styles, /driver-popover-prev-btn[\s\S]*?background:\s*var\(--guide-surface\)/);
  assert.match(styles, /\.ysabelle-guide\.is-transitioning\s*\{[\s\S]*?opacity:\s*0;/);
});
