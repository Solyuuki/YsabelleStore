import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("About keeps native scrolling while hiding only the visual scrollbar", () => {
  const main = read("frontend/src/main.tsx");
  const css = read("frontend/src/styles/customer-about-premium.css");
  const documentScrollbarRule = css.match(/html:has\(\.customer-discover\)\s*\{[^}]*\}/s)?.[0] ?? "";

  assert.match(main, /@\/styles\/customer-about-premium\.css/);
  assert.match(documentScrollbarRule, /scrollbar-width:\s*none/);
  assert.match(css, /html:has\(\.customer-discover\)::-webkit-scrollbar/);
  assert.doesNotMatch(documentScrollbarRule, /overflow(?:-y)?:\s*hidden/);
});

test("About ScrollTrigger setup avoids aggressive catch-up during native wheel scrolling", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(discover, /discover-smarter", "0px 0px 220% 0px"/);
  assert.doesNotMatch(discover, /fastScrollEnd:\s*true/);
  assert.match(discover, /const scrub = desktop \? 0\.45 : tablet \? 0\.32 : 0\.22/);
  assert.match(discover, /scrub:\s*0\.35/);
  assert.match(discover, /ScrollTrigger\.refresh\(true\)/);
});

test("About beginning shader stays premium and less foggy", () => {
  const css = read("frontend/src/styles/customer-about-premium.css");

  assert.match(css, /\.discover-story \.story-beginning/);
  assert.match(css, /#fcfdff/i);
  assert.match(css, /rgb\(0 140 255 \/ 9%\)/);
  assert.match(css, /rgb\(168 60 240 \/ 8%\)/);
});

test("About progress navigator stays hidden through the welcome scene", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(
    discover,
    /const progressVisibilityStart = sceneOwnershipStarts\[1\] \?\? rootTop;/
  );
  assert.match(discover, /scrollTop >= progressVisibilityStart/);
  assert.doesNotMatch(discover, /scrollTop >= rootTop - viewportHeight \* 0\.75/);
});
