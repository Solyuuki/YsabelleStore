import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("shopping guide shows a preparation phase before cross-route navigation", () => {
  const source = read("frontend/src/hooks/useShoppingGuide.ts");

  assert.match(source, /useRef, useState/);
  assert.match(source, /GUIDE_PREPARE_MIN_MS\s*=\s*560/);
  assert.match(
    source,
    /if \(pathname !== "\/"\) \{[\s\S]*?setIsPreparingGuide\(true\);[\s\S]*?sessionStorage\.setItem\(GUIDE_PENDING_KEY, "true"\);[\s\S]*?navigate\("\/"\);/
  );
  assert.match(source, /waitForGuideTarget\(0, \(\) => \{/);
  assert.match(source, /Math\.max\(0, GUIDE_PREPARE_MIN_MS - elapsed\)/);
  assert.match(source, /runGuide\(\);[\s\S]*?requestAnimationFrame\(\(\) => setIsPreparingGuide\(false\)\);/);
  assert.match(source, /return \{ isPreparingGuide, startGuide \};/);
});

test("customer layout renders the branded guide transition overlay", () => {
  const source = read("frontend/src/layouts/CustomerLayout.tsx");

  assert.match(source, /import \{ YsabelleBrandMark \} from "@\/components\/customer\/YsabelleBrandMark";/);
  assert.match(source, /const \{ isPreparingGuide, startGuide \} = useShoppingGuide/);
  assert.match(source, /customer-guide-transition/);
  assert.match(source, /isPreparingGuide \? "is-visible" : ""/);
  assert.match(source, /<YsabelleBrandMark[^>]*variant="mini"/);
  assert.match(source, /Preparing your shopping guide/);
  assert.match(source, /Taking you to the storefront/);
});

test("guide transition is blocking, animated, and reduced-motion safe", () => {
  const styles = read("frontend/src/styles/shopping-guide.css");

  assert.match(styles, /\.customer-guide-transition\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;/);
  assert.match(styles, /\.customer-guide-transition\.is-visible\s*\{[\s\S]*?pointer-events:\s*auto;[\s\S]*?opacity:\s*1;/);
  assert.match(styles, /@keyframes customer-guide-progress/);
  assert.match(styles, /\.customer-guide-transition__progress span\s*\{[\s\S]*?animation:\s*customer-guide-progress/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.customer-guide-transition[\s\S]*?transition:\s*none;[\s\S]*?\.customer-guide-transition__progress span[\s\S]*?animation:\s*none;/
  );
});
