import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("About keeps native scrolling while hiding only the visual scrollbar", () => {
  const main = read("frontend/src/main.tsx");
  const css = read("frontend/src/styles/customer-about-premium.css");
  const documentScrollbarRule =
    css.match(/html:has\(\.customer-discover\)\s*\{[^}]*\}/s)?.[0] ?? "";

  assert.match(main, /@\/styles\/customer-about-premium\.css/);
  assert.match(documentScrollbarRule, /scrollbar-width:\s*none/);
  assert.match(css, /html:has\(\.customer-discover\)::-webkit-scrollbar/);
  assert.doesNotMatch(documentScrollbarRule, /overflow(?:-y)?:\s*hidden/);
});

test("About scroll UI stays synchronized during fast native wheel scrolling", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(discover, /discover-smarter", "0px 0px 220% 0px"/);
  assert.doesNotMatch(discover, /fastScrollEnd:\s*true/);
  assert.match(discover, /const scrub = desktop \? 0\.45 : tablet \? 0\.32 : 0\.22/);
  assert.match(discover, /window\.addEventListener\("scroll", requestStoryUiUpdate/);
  assert.match(discover, /window\.requestAnimationFrame/);
  assert.match(discover, /onLeave:\s*flushStoryUi/);
  assert.match(discover, /ScrollTrigger\.refresh\(true\)/);
});

test("About chapter 02 uses the product and catalog intelligence story", () => {
  const aboutPage = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const motion = read("frontend/src/components/customer/about/AboutCatalogMotion.tsx");
  const css = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(aboutPage, /about-catalog-intelligence\.css/);
  assert.doesNotMatch(aboutPage, /about-origin-timeline\.css/);
  assert.match(discover, />Product &amp; Catalog Intelligence<\/span>/);
  assert.match(discover, /From Product/);
  assert.match(discover, /to Catalog Ready\./);
  assert.match(discover, /Product catalog workflow from source item to catalog-ready product/);
  assert.match(discover, /label: "Barcode"/);
  assert.match(discover, /label: "Quality check"/);
  assert.match(discover, /label: "Normalize"/);
  assert.match(discover, /label: "Catalog ready"/);
  assert.doesNotMatch(discover, /story-catalog__index/);
  assert.match(discover, /Sales &amp; Inventory/);
  assert.match(discover, /Forecast Intelligence/);
  assert.match(discover, /hideSectionNumber=\{isAboutExperience\}/);
  assert.match(discover, /discover-shop", label: "Delivery operations"/);
  assert.match(discover, /discover-progress__dot/);
  assert.match(motion, /gemini_generated_video_a80f6413\.mp4/);
  assert.match(motion, /CROSSFADE_LEAD_SECONDS = 0\.85/);
  assert.match(
    css,
    /story-catalog__steps[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/
  );
  assert.match(css, /story-catalog__step[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(css, /story-catalog__step[\s\S]{0,500}?border-radius:\s*1rem/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("About progress navigator stays hidden through the welcome scene", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(discover, /const progressVisibilityStart = sceneOwnershipStarts\[1\] \?\? rootTop;/);
  assert.match(discover, /scrollTop >= progressVisibilityStart/);
  assert.doesNotMatch(discover, /scrollTop >= rootTop - viewportHeight \* 0\.75/);
});

test("About welcome uses branded premium typography without a CTA", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const welcomeCss = read("frontend/src/styles/about-welcome-motion.css");

  assert.match(discover, /Established 2019 · Pasig City/);
  assert.doesNotMatch(discover, /story-welcome__divider/);
  assert.match(
    discover,
    /story-welcome__scroll-label">Scroll to continue<\/span>[\s\S]*?<ChevronDown/
  );
  assert.doesNotMatch(discover, /story-welcome__support[\s\S]{0,900}>Get Started</);
  assert.match(
    welcomeCss,
    /story-welcome__title[\s\S]*?width:\s*fit-content[\s\S]*?overflow:\s*visible/
  );
  assert.match(
    welcomeCss,
    /story-welcome__title \.story-mask[\s\S]*?width:\s*max-content[\s\S]*?overflow:\s*visible[\s\S]*?padding:\s*0\.24em 0\.28em 0\.3em/
  );
  assert.match(
    welcomeCss,
    /story-welcome__title[\s\S]*?line-height:\s*0\.9[\s\S]*?overflow:\s*visible/
  );
  assert.match(
    welcomeCss,
    /story-mask:first-child[\s\S]*?#101426[\s\S]*?#4d63ff[\s\S]*?#a83cf0[\s\S]*?-webkit-text-stroke:\s*0\.5px/
  );
  assert.match(
    welcomeCss,
    /story-mask__line--accent[\s\S]*?#625bff[\s\S]*?#a83cf0[\s\S]*?#f43f8c[\s\S]*?#ff4e9a[\s\S]*?-webkit-text-stroke:\s*0\.46px/
  );
  assert.doesNotMatch(welcomeCss, /story-welcome__title[\s\S]{0,2600}?filter:\s*drop-shadow/);
  assert.doesNotMatch(
    welcomeCss,
    /story-welcome__title[\s\S]{0,2600}?background-blend-mode:\s*screen/
  );
  assert.match(
    welcomeCss,
    /story-welcome__support strong[\s\S]*?rgb\(98 91 255 \/ 22%\)[\s\S]*?rgb\(248 249 255 \/ 78%\)/
  );
  assert.match(welcomeCss, /story-welcome__support p[\s\S]*?white-space:\s*nowrap/);
  assert.match(
    welcomeCss,
    /story-welcome__scroll-cue[\s\S]*?flex-direction:\s*column[\s\S]*?story-welcome__scroll-label/
  );
  assert.match(welcomeCss, /@keyframes about-welcome-scroll-cue[\s\S]*?translateY\(5px\)/);
});

test("About welcome video keeps balanced contrast without a milky white shader", () => {
  const css = read("frontend/src/styles/about-welcome-motion.css");

  assert.match(css, /filter:\s*saturate\(1\.045\) contrast\(1\.035\) brightness\(1\.005\)/);
  assert.match(
    css,
    /\.about-welcome-motion__scrim\s*\{[\s\S]*?rgb\(10 16 38 \/ 5%\)[\s\S]*?rgb\(8 13 32 \/ 10%\)/
  );
  assert.doesNotMatch(
    css,
    /\.about-welcome-motion__scrim\s*\{[\s\S]{0,600}?rgb\(255 255 255 \/ 18%\)/
  );
  assert.match(css, /\.about-welcome-motion__edge-light\s*\{[\s\S]*?opacity:\s*0\.34/);
});

test("About welcome-to-catalog handoff uses a vertical scrubbed fade without a visible edge bar", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const welcomeCss = read("frontend/src/styles/about-welcome-motion.css");
  const catalogCss = read("frontend/src/styles/about-catalog-intelligence.css");

  assert.match(
    discover,
    /if \(isAboutExperience\)[\s\S]*?\.about-welcome-motion[\s\S]*?opacity:\s*0\.5[\s\S]*?story-welcome__handoff[\s\S]*?autoAlpha:\s*0[\s\S]*?yPercent:\s*28[\s\S]*?autoAlpha:\s*1/
  );
  assert.match(
    welcomeCss,
    /--about-welcome-catalog-seam:\s*linear-gradient\([\s\S]*?#b9ccef[\s\S]*?#d3b9e8/
  );
  assert.match(
    welcomeCss,
    /story-welcome__handoff[\s\S]*?height:\s*clamp\(7\.5rem, 16vh, 11rem\)[\s\S]*?background:\s*var\(--about-welcome-catalog-seam\)[\s\S]*?mask-image:\s*linear-gradient\(to bottom, transparent 0%, #000 54%, #000 100%\)/
  );
  assert.doesNotMatch(
    welcomeCss,
    /story-welcome__handoff[\s\S]{0,700}?linear-gradient\(90deg, var\(--story-blue\)/
  );
  assert.match(
    catalogCss,
    /story-catalog::after[\s\S]*?background:\s*var\(--about-welcome-catalog-seam\)[\s\S]*?mask-image:\s*linear-gradient\(to bottom, #000 0%, #000 18%, transparent 100%\)/
  );
});

test("About chapter 03 uses the approved sales and inventory motion story", () => {
  const aboutPage = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const motion = read("frontend/src/components/customer/about/AboutSalesInventoryMotion.tsx");
  const css = read("frontend/src/styles/about-sales-inventory.css");

  assert.match(aboutPage, /about-sales-inventory\.css/);
  assert.match(discover, /Sales &amp; Inventory/);
  assert.match(discover, /Every Sale/);
  assert.match(discover, /Updates the Store\./);
  assert.match(discover, /label: "Sale recorded"/);
  assert.match(discover, /label: "Stock deducted"/);
  assert.match(discover, /label: "Inventory updated"/);
  assert.match(discover, /label: "History saved"/);
  assert.match(discover, /Sales history becomes the foundation for forecasting\./);
  assert.match(motion, /gemini_generated_video_2e78399f\.mp4/);
  assert.match(motion, /CROSSFADE_LEAD_SECONDS = 0\.85/);
  assert.match(
    css,
    /story-sales__steps[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/
  );
  assert.match(css, /--about-catalog-sales-seam/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("About chapter labels diverge from legacy Discover only where chapters are rebuilt", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(discover, /const storyScenes = \[[\s\S]*?discover-location", label: "Our location"/);
  assert.match(
    discover,
    /const aboutStoryScenes = \[[\s\S]*?discover-location", label: "Forecast intelligence"/
  );
});

test("About chapter 03 matches chapter 02 desktop scroll pacing", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(
    discover,
    /const salesTimeline = gsap\.timeline\([\s\S]*?trigger:\s*essentials[\s\S]*?start:\s*"top top\+=76"[\s\S]*?Math\.max\(1100, Math\.round\(window\.innerHeight \* 1\.4\)\)[\s\S]*?pin:\s*essentials[\s\S]*?pinSpacing:\s*true[\s\S]*?anticipatePin:\s*1[\s\S]*?scrub:\s*0\.45/
  );
  assert.match(
    discover,
    /salesHandoff[\s\S]*?autoAlpha:\s*0\.82[\s\S]*?0\.9[\s\S]*?settle\(salesTimeline, 0\.99\)/
  );
});

test("About chapter 03 pre-reveals before pinning so the catalog-to-sales handoff does not pop", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const css = read("frontend/src/styles/about-sales-inventory.css");

  assert.match(
    discover,
    /const salesPrelude = gsap\.timeline\([\s\S]*?start:\s*"top 94%"[\s\S]*?end:\s*"top top\+=76"[\s\S]*?scrub:\s*0\.2/
  );
  assert.match(
    discover,
    /salesPrelude[\s\S]*?salesKicker[\s\S]*?autoAlpha:\s*0\.68[\s\S]*?salesSystem[\s\S]*?autoAlpha:\s*0\.68/
  );
  assert.match(
    discover,
    /fromTo\(\s*salesKicker[\s\S]*?desktop \? 0\.68 : 0[\s\S]*?fromTo\(\s*salesSystem[\s\S]*?desktop \? 0\.994 : 0\.985/
  );
  assert.doesNotMatch(css, /story-sales__system[\s\S]{0,900}?backdrop-filter:\s*blur\(/);
  assert.match(
    css,
    /story-sales__system[\s\S]*?background:\s*rgb\(15 21 49 \/ 91%\)[\s\S]*?translateZ\(0\)/
  );
});

test("Discover imports the canonical storefront category presentation utility", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(
    discover,
    /getEssentialShelfItems \} from "@\/utils\/storefrontCategoryPresentation"/
  );
  assert.doesNotMatch(discover, /storefrontCategoryTodayation/);
});

test("About chapter 04 renders the approved live SARIMA preview instead of a background video", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const motion = read("frontend/src/components/customer/about/AboutForecastMotion.tsx");
  const css = read("frontend/src/styles/about-forecast-intelligence.css");

  assert.match(discover, /className="story-forecast__visual"/);
  assert.match(discover, /<AboutForecastMotion \/>/);
  assert.match(discover, /From Sales History/);
  assert.match(discover, /To Future Demand\./);
  assert.match(discover, /Forecast model/);
  assert.match(discover, />SARIMA<\/strong>/);
  assert.match(motion, /about-forecast-demo/);
  assert.match(motion, /Annual demand forecast/);
  assert.match(motion, /Next restock recommendation/);
  assert.match(motion, /Canned goods/);
  assert.doesNotMatch(motion, /<video|\.mp4/);
  assert.match(css, /story-forecast__visual[\s\S]*?width:\s*min\(100%, 1180px\)/);
});

test("About chapter 04 uses a stacked cinematic layout distinct from chapters 02 and 03", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const css = read("frontend/src/styles/about-forecast-intelligence.css");

  assert.match(discover, /<header className="story-forecast__header">/);
  assert.match(discover, /<footer className="story-forecast__footer">/);
  assert.doesNotMatch(discover, /className="story-forecast__system"/);
  assert.match(css, /story-forecast__stage[\s\S]*?grid-template-rows:\s*auto auto auto/);
  assert.match(css, /story-forecast__footer[\s\S]*?justify-content:\s*space-between/);
  assert.doesNotMatch(css, /grid-template-columns:\s*minmax\(0, 1\.15fr\)/);
});

test("About chapter 04 holds on desktop until the forecast animation completes", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(
    discover,
    /const forecastTimeline = gsap\.timeline\([\s\S]*?start:\s*"top top\+=76"[\s\S]*?Math\.max\(1500, Math\.round\(window\.innerHeight \* 1\.85\)\)[\s\S]*?pin:\s*location[\s\S]*?pinSpacing:\s*true[\s\S]*?scrub:\s*0\.32/
  );
  assert.match(discover, /settle\(forecastTimeline, desktop \? 0\.64 : 0\.92\)/);
});

test("Forecast preview is StrictMode-safe because it is a declarative DOM chart", () => {
  const main = read("frontend/src/main.tsx");
  const motion = read("frontend/src/components/customer/about/AboutForecastMotion.tsx");

  assert.match(main, /<React\.StrictMode>/);
  assert.match(motion, /const annualForecast = \[/);
  assert.match(motion, /<svg className="about-forecast-demo__chart"/);
  assert.match(motion, /about-forecast-demo__recommendation/);
  assert.doesNotMatch(motion, /useEffect|requestAnimationFrame|<video/);
});
