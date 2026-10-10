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

test("shopping guide config matches the current premium storefront behavior", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");

  assert.doesNotMatch(source, /driver\.js\/dist\/driver\.css/);
  assert.match(source, /waitForElement:\s*4_000/);
  assert.match(source, /overlayColor:\s*"#101426"/);
  assert.match(source, /overlayOpacity:\s*0\.46/);
  assert.match(source, /duration:\s*prefersReducedMotion\s*\?\s*0\s*:\s*340/);
  assert.match(source, /stagePadding:\s*10/);
  assert.match(source, /stageRadius:\s*16/);
  assert.match(source, /popoverOffset:\s*14/);
  assert.match(source, /doneBtnText:\s*"Start shopping"/);
  assert.match(source, /popover\.closeButton\.textContent\s*=\s*"Skip"/);
});

test("shopping guide transitions between distant targets without making the popover chase scrolling", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");

  assert.match(source, /smoothScroll:\s*false/);
  assert.match(source, /const GUIDE_STEP_EXIT_MS = 90/);
  assert.match(source, /wrapper\?\.classList\.add\("is-transitioning"\)/);
  assert.match(source, /scrollIntoView\(\{/);
  assert.match(source, /behavior:\s*"smooth"/);
  assert.match(source, /block:\s*"center"/);
  assert.match(source, /waitForScrollSettle\(completeMove\)/);
  assert.match(source, /requestAnimationFrame/);
  assert.match(
    source,
    /guide\.getState\(\)\.popover\?\.wrapper\.classList\.remove\("is-transitioning"\)/
  );
  assert.match(source, /\.home-categories \.home-section-heading/);
  assert.doesNotMatch(source, /element:\s*'\[data-tour="start-shopping"\]'/);
});

test("shopping guide content matches current catalog, cart, and delivery checkout", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");

  assert.match(source, /title:\s*"Search the catalog"/);
  assert.match(source, /Suggestions and recent searches help you move faster/);
  assert.match(source, /title:\s*"Browse by aisle"/);
  assert.match(source, /without losing your place/);
  assert.match(source, /title:\s*"Check product details"/);
  assert.match(source, /save favorites for later/);
  assert.match(source, /title:\s*"Checkout & delivery"/);
  assert.match(source, /secure online payment or Cash on Delivery/);
  assert.doesNotMatch(source, /pickup details|pay cash when you collect/);
});

test("shopping guide stays hidden while the page scrolls without animating Driver positioning transforms", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");
  const styles = read("frontend/src/styles/shopping-guide.css");
  const popoverRule = styles.match(/\.ysabelle-guide\.driver-popover\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const transitionRule =
    styles.match(/\.ysabelle-guide\.is-transitioning(?:\s*,[\s\S]*?)?\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(source, /const GUIDE_SCROLLING_CLASS = "ysabelle-guide-scrolling"/);
  assert.match(
    source,
    /window\.addEventListener\("scroll", handleGuideScroll, \{ passive: true \}\)/
  );
  assert.match(source, /document\.documentElement\.classList\.add\(GUIDE_SCROLLING_CLASS\)/);
  assert.match(source, /document\.documentElement\.classList\.remove\(GUIDE_SCROLLING_CLASS\)/);
  assert.match(
    styles,
    /\.ysabelle-guide-scrolling \.ysabelle-guide\.driver-popover[\s\S]*?opacity:\s*0/
  );
  assert.doesNotMatch(popoverRule, /transform/);
  assert.doesNotMatch(transitionRule, /transform/);
});

test("shopping guide finish fades the guide and overlay before teardown and navigation", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");
  const styles = read("frontend/src/styles/shopping-guide.css");

  assert.match(source, /const GUIDE_FINISHING_CLASS = "ysabelle-guide-finishing"/);
  assert.match(source, /const GUIDE_FINISH_DURATION_MS = 160/);
  assert.match(source, /document\.documentElement\.classList\.add\(GUIDE_FINISHING_CLASS\)/);
  assert.match(source, /window\.setTimeout\(finish, GUIDE_FINISH_DURATION_MS\)/);
  assert.match(source, /document\.documentElement\.classList\.remove\(GUIDE_FINISHING_CLASS\)/);
  assert.match(
    styles,
    /\.ysabelle-guide-finishing \.ysabelle-guide\.driver-popover[\s\S]*?opacity:\s*0/
  );
  assert.match(styles, /\.ysabelle-guide-finishing \.driver-overlay[\s\S]*?opacity:\s*0/);
});

test("shopping guide popover is spacious, frosted, and has responsive button feedback", () => {
  const styles = read("frontend/src/styles/shopping-guide.css");

  assert.match(styles, /--guide-primary:\s*#625bff/);
  assert.match(styles, /--guide-ink:\s*#101426/);
  assert.match(styles, /width:\s*min\(24\.5rem, calc\(100vw - 2rem\)\)/);
  assert.match(styles, /kpi-card-frosted-ribbon\.webp/);
  assert.match(styles, /driver-popover-title[\s\S]*?max-width:\s*18rem/);
  assert.match(
    styles,
    /driver-popover-footer[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\)/
  );
  assert.match(styles, /driver-popover-progress-text[\s\S]*?border-radius:\s*999px/);
  assert.match(styles, /driver-popover-footer button:active:not\(:disabled\)/);
  assert.match(styles, /driver-popover-close-btn:active/);
  assert.match(
    styles,
    /driver-popover-next-btn[\s\S]*?linear-gradient\(135deg, #625bff, #704fe9\)/
  );
  assert.doesNotMatch(styles, /var\(--customer-/);
  assert.match(
    styles,
    /\.ysabelle-guide\.is-transitioning(?:\s*,[\s\S]*?)?\s*\{[\s\S]*?opacity:\s*0;/
  );
});


test("dark guide popup has readable progress and visibly disabled Back button", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const source = read("frontend/src/styles/theme-storefront.css").replace(/\s+/g, " ");
  const scope = ":root.dark .ysabelle-guide.driver-popover";

  assert.ok(
    app.indexOf('import "@/styles/theme-storefront.css";') >
      app.indexOf('import "@/styles/shopping-guide.css";'),
    "Dark guide rules should load after the base guide stylesheet"
  );
  assert.ok(source.includes(scope + " .driver-popover-progress-text {"));
  assert.ok(source.includes("background: #263650;"));
  assert.ok(source.includes(scope + " .driver-popover-prev-btn {"));
  assert.ok(source.includes("background: #293851 !important;"));
  assert.ok(source.includes(scope + " .driver-popover-footer button:disabled {"));
  assert.ok(source.includes("opacity: 1;"));
  assert.ok(source.includes(scope + " .driver-popover-prev-btn:disabled:is(:hover, :focus-visible)"));
  assert.ok(source.includes(scope + " .driver-popover-next-btn:disabled"));
  assert.ok(source.includes("background: #192438 !important;"));
});
