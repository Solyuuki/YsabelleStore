import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("About and Discover keep distinct storefront-story endings", () => {
  const source = read("frontend/src/app/CustomerApp.tsx");

  assert.match(source, /const AboutExperiencePage = lazy\(\(\) =>/);
  assert.match(source, /loadAboutExperienceModule\(\)/);
  assert.match(
    source,
    /pathname === "\/about"\) page = <AboutExperiencePage navigate=\{navigate\} \/>/
  );
  assert.match(
    source,
    /pathname === "\/discover"\) page = <DiscoverPage navigate=\{navigate\} \/>/
  );
});

test("About delivery chapter uses the approved delivery video with viewport-aware playback", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(source, /about-delivery-operations-83b7547e\.mp4/);
  assert.match(source, /IntersectionObserver/);
  assert.match(source, /deliveryVisibleRef\.current = entry\.isIntersecting/);
  assert.match(source, /video\.preload = "auto"/);
  assert.match(source, /preload="metadata"/);
  assert.match(source, /videoRefs\.forEach\(\(ref\) => ref\.current\?\.pause\(\)\)/);
});

test("About delivery chapter uses the approved store-to-door narrative", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(source, /06 \/ Delivery operations/);
  assert.match(source, /From Store/);
  assert.match(source, /to Door\./);
  assert.match(source, /Every delivery stays in view\./);
  assert.match(source, /Multi-point routes/);
  assert.match(source, /Courier handoff/);
  assert.match(source, /Delivery progress/);
});

test("About delivery chapter keeps one primary Explore now CTA back to the storefront", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.equal(source.match(/story-delivery__primary-action/g)?.length, 1);
  assert.equal(source.match(/Explore now/g)?.length, 1);
  assert.match(source, /href="\/"[\s\S]*?navigate=\{navigate\}/);
  assert.doesNotMatch(source, /Shop the live catalog|Quick add|Pickup ready/);
});

test("About delivery video crossfades instead of hard-looping", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");
  const styles = read("frontend/src/styles/about-storefront-handoff.css");

  assert.match(source, /DELIVERY_CROSSFADE_LEAD_SECONDS = 0\.85/);
  assert.match(source, /DELIVERY_CROSSFADE_DURATION_MS = 720/);
  assert.match(source, /beginDeliveryCrossfade/);
  assert.match(source, /incomingVideo\.currentTime = 0/);
  assert.match(source, /is-incoming/);
  assert.doesNotMatch(source, /\sloop(?:\s|=|>)/);
  assert.match(styles, /story-delivery__video[\s\S]*?transition:\s*opacity 720ms linear/);
});

test("About wrapper defers only the external delivery chapter without legacy DOM mutation", () => {
  const source = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.match(source, /const DeferredAboutStorefrontHandoff = lazy/);
  assert.match(source, /import\("@\/components\/customer\/about\/AboutStorefrontHandoff"\)/);
  assert.match(source, /<DiscoverPage navigate=\{navigate\} variant="about" \/>/);
  assert.match(source, /story-delivery--loading/);
  assert.match(source, /<DeferredAboutStorefrontHandoff navigate=\{navigate\} \/>/);
  assert.doesNotMatch(source, /useLayoutEffect|discover-shop-legacy|story-shop--legacy-hidden/);
});

test("About delivery chapter has isolated responsive styling", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");
  const styles = read("frontend/src/styles/about-storefront-handoff.css");
  const layoutStyles = read("frontend/src/styles/about-storefront-handoff-layout.css");

  assert.match(source, /about-storefront-handoff\.css/);
  assert.match(source, /about-storefront-handoff-layout\.css/);
  assert.match(styles, /\.about-experience \.story-delivery\s*\{/);
  assert.match(styles, /position:\s*sticky;[\s\S]*?top:\s*76px/);
  assert.match(
    layoutStyles,
    /grid-template-columns:\s*minmax\(0, 0\.8fr\) minmax\(35rem, 1\.2fr\)/
  );
  assert.match(
    layoutStyles,
    /@media \(max-width: 1023px\)[\s\S]*?grid-template-columns:\s*1fr/
  );
});

test("About delivery headline stays compact on desktop", () => {
  const styles = read("frontend/src/styles/about-storefront-handoff.css");

  assert.match(
    styles,
    /story-delivery__copy h2[\s\S]*?font-size:\s*clamp\(2\.55rem, 3\.65vw, 4\.25rem\)[\s\S]*?white-space:\s*nowrap/
  );
  assert.match(styles, /story-mask__line--delivery[\s\S]*?font-style:\s*italic/);
});

test("About delivery reveal follows native scroll smoothly without pinning another timeline", () => {
  const source = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");

  assert.match(source, /start:\s*"top 84%"/);
  assert.match(source, /end:\s*"top 14%"/);
  assert.match(source, /scrub:\s*0\.42/);
  assert.doesNotMatch(source, /pin:\s*root|fastScrollEnd/);
});
