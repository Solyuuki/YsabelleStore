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

test("About ScrollTrigger setup avoids aggressive catch-up during native wheel scrolling", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(discover, /discover-smarter", "0px 0px 220% 0px"/);
  assert.doesNotMatch(discover, /fastScrollEnd:\s*true/);
  assert.match(discover, /const scrub = desktop \? 0\.45 : tablet \? 0\.32 : 0\.22/);
  assert.match(discover, /scrub:\s*0\.35/);
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
  assert.match(discover, /label: "Image quality"/);
  assert.match(discover, /label: "Normalize"/);
  assert.match(discover, /label: "Catalog ready"/);
  assert.doesNotMatch(discover, /story-catalog__index/);
  assert.match(discover, /Sales &amp; Inventory/);
  assert.match(discover, /Forecast Intelligence/);
  assert.match(discover, /hideSectionNumber=\{isAboutExperience\}/);
  assert.match(discover, /isAboutExperience \? "Shop with Ysabelle" : "06 \/ Shop with Ysabelle"/);
  assert.match(discover, /discover-progress__dot/);
  assert.match(motion, /gemini_generated_video_a80f6413\.mp4/);
  assert.match(motion, /CROSSFADE_LEAD_SECONDS = 0\.85/);
  assert.match(css, /story-catalog__steps[\s\S]*?grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
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
  assert.match(discover, /story-welcome__scroll-label">Scroll to continue<\/span>[\s\S]*?<ChevronDown/);
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
  assert.doesNotMatch(
    welcomeCss,
    /story-welcome__title[\s\S]{0,2600}?filter:\s*drop-shadow/
  );
  assert.doesNotMatch(
    welcomeCss,
    /story-welcome__title[\s\S]{0,2600}?background-blend-mode:\s*screen/
  );
  assert.match(
    welcomeCss,
    /story-welcome__support strong[\s\S]*?rgb\(98 91 255 \/ 22%\)[\s\S]*?rgb\(248 249 255 \/ 78%\)/
  );
  assert.match(
    welcomeCss,
    /story-welcome__support p[\s\S]*?white-space:\s*nowrap/
  );
  assert.match(
    welcomeCss,
    /story-welcome__scroll-cue[\s\S]*?flex-direction:\s*column[\s\S]*?story-welcome__scroll-label/
  );
  assert.match(
    welcomeCss,
    /@keyframes about-welcome-scroll-cue[\s\S]*?translateY\(5px\)/
  );
});


test("About welcome video keeps balanced contrast without a milky white shader", () => {
  const css = read("frontend/src/styles/about-welcome-motion.css");

  assert.match(
    css,
    /filter:\s*saturate\(1\.045\) contrast\(1\.035\) brightness\(1\.005\)/
  );
  assert.match(
    css,
    /\.about-welcome-motion__scrim\s*\{[\s\S]*?rgb\(10 16 38 \/ 5%\)[\s\S]*?rgb\(8 13 32 \/ 10%\)/
  );
  assert.doesNotMatch(
    css,
    /\.about-welcome-motion__scrim\s*\{[\s\S]{0,600}?rgb\(255 255 255 \/ 18%\)/
  );
  assert.match(
    css,
    /\.about-welcome-motion__edge-light\s*\{[\s\S]*?opacity:\s*0\.34/
  );
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
  assert.match(css, /story-sales__steps[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /--about-catalog-sales-seam/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});


test("About chapter 04 uses a full-width forecast canvas instead of the chapter 02/03 card pattern", () => {
  const aboutPage = read("frontend/src/pages/customer/AboutExperiencePage.tsx");
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const motion = read("frontend/src/components/customer/about/AboutForecastMotion.tsx");
  const css = read("frontend/src/styles/about-forecast-intelligence.css");

  assert.match(aboutPage, /about-forecast-intelligence\.css/);
  assert.match(discover, /Forecast Intelligence/);
  assert.match(discover, /Past Sales Shape/);
  assert.match(discover, /What Comes Next\./);
  assert.match(discover, /SARIMA can estimate future demand/);
  assert.match(discover, /Historical sales/);
  assert.match(discover, /Forecast horizon/);
  assert.match(discover, /data-forecast-history/);
  assert.match(discover, /data-forecast-future/);
  assert.match(discover, /Forecasts help prepare the next inventory decision\./);
  assert.match(motion, /gemini_generated_video_9d3956f0\.mp4/);
  assert.match(motion, /data-forecast-video/);
  assert.doesNotMatch(motion, /autoPlay/);
  assert.doesNotMatch(motion, /CROSSFADE_LEAD_SECONDS/);
  assert.match(css, /story-forecast__stage[\s\S]*?position:\s*relative/);
  assert.match(
    css,
    /about-forecast-motion[\s\S]*?position:\s*absolute[\s\S]*?left:\s*50%[\s\S]*?width:\s*100vw[\s\S]*?translateX\(-50%\)/
  );
  assert.match(css, /story-forecast[\s\S]*?min-height:\s*max\(720px, calc\(100svh - 76px\)\)/);
  assert.match(css, /story-forecast__stage[\s\S]*?height:\s*calc\(100svh - 76px\)[\s\S]*?isolation:\s*isolate/);
  assert.match(css, /about-forecast-motion__video\.is-active,[\s\S]*?opacity:\s*1/);
  assert.doesNotMatch(css, /about-forecast-motion__wash[\s\S]{0,700}?rgb\(255 255 255 \/ 62%\)/);
  assert.match(css, /story-forecast::after[\s\S]*?width:\s*auto[\s\S]*?border-radius:\s*0/);
  assert.match(css, /story-forecast__zone[\s\S]*?border-radius:\s*0/);
  assert.match(css, /story-forecast__plot/);
  assert.doesNotMatch(css, /story-forecast__system/);
  assert.match(css, /--about-sales-forecast-seam/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("About chapter labels diverge from legacy Discover only where chapters are rebuilt", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");

  assert.match(
    discover,
    /const storyScenes = \[[\s\S]*?discover-location", label: "Our location"/
  );
  assert.match(
    discover,
    /const aboutStoryScenes = \[[\s\S]*?discover-location", label: "Forecast intelligence"/
  );
});


test("About forecast uses dark-video typography and keeps the chart framework visible on entry", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const css = read("frontend/src/styles/about-forecast-intelligence.css");

  assert.match(discover, /gsap\.set\(forecastPlot, \{ autoAlpha: 1, y: 0 \}\)/);
  assert.doesNotMatch(
    discover,
    /forecastPlot,[\s\S]{0,180}?autoAlpha:\s*1[\s\S]{0,120}?0\.18/
  );
  assert.match(discover, /historyPath[\s\S]*?strokeDashoffset:\s*0[\s\S]*?0\.2/);
  assert.match(discover, /futurePath[\s\S]*?strokeDashoffset:\s*0[\s\S]*?0\.42/);
  assert.match(css, /story-forecast__copy h2[\s\S]*?max-width:\s*16ch[\s\S]*?color:\s*#f7f9ff/);
  assert.match(css, /story-forecast__lead[\s\S]*?color:\s*#d8def4/);
  assert.match(css, /story-forecast__intro::before[\s\S]*?rgb\(7 13 34 \/ 54%\)/);
  assert.match(css, /story-forecast__baseline,[\s\S]*?rgb\(219 229 255 \/ 21%\)/);
});


test("About forecast keeps the approved Gemini plate unshaded and dark through sticky release", () => {
  const css = read("frontend/src/styles/about-forecast-intelligence.css");

  assert.match(
    css,
    /story-forecast\s*\{[\s\S]*?linear-gradient\(135deg, #10182f 0%, #182141 46%, #21194a 76%, #171a37 100%\)/
  );
  assert.match(
    css,
    /about-forecast-motion__video\.is-active,[\s\S]*?opacity:\s*1/
  );
  assert.match(
    css,
    /about-forecast-motion__wash\s*\{[\s\S]*?background:\s*none/
  );
  assert.doesNotMatch(
    css,
    /about-forecast-motion__fallback[\s\S]{0,650}?#eaf5ff/
  );
  assert.doesNotMatch(
    css,
    /story-forecast\s*\{[\s\S]{0,650}?#eef6ff/
  );
});




test("About forecast uses one pinned viewport scene and releases directly into system intelligence", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const css = read("frontend/src/styles/about-forecast-intelligence.css");

  assert.match(discover, /const forecastStage = location\.querySelector<HTMLElement>\("\.story-forecast__stage"\)/);
  assert.match(
    discover,
    /pin:\s*desktop \? forecastStage : false[\s\S]*?pinSpacing:\s*desktop[\s\S]*?anticipatePin:\s*desktop \? 1 : 0/
  );
  assert.match(
    discover,
    /Math\.max\(1200, Math\.round\(window\.innerHeight \* 1\.45\)\)/
  );
  assert.doesNotMatch(discover, /const forecastExitTimeline = gsap\.timeline/);
  assert.match(discover, /settle\(forecastTimeline, 0\.82\)/);
  assert.match(
    css,
    /story-forecast__stage[\s\S]*?position:\s*relative[\s\S]*?height:\s*calc\(100svh - 76px\)/
  );
  assert.match(css, /story-forecast::before[\s\S]*?display:\s*none/);
});


test("About forecast scrubs the Gemini motion with section progress and holds the completed frame", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const motion = read("frontend/src/components/customer/about/AboutForecastMotion.tsx");

  assert.match(motion, /data-forecast-video/);
  assert.doesNotMatch(motion, /autoPlay/);
  assert.match(discover, /const syncForecastVideo = \(progress: number\) =>/);
  assert.match(discover, /progress \/ 0\.82/);
  assert.match(discover, /forecastVideo\.duration - 0\.04/);
  assert.match(
    discover,
    /onUpdate:\s*\(self\) => syncForecastVideo\(self\.progress\)[\s\S]*?onLeave:\s*\(\) => syncForecastVideo\(1\)/
  );
  assert.match(
    discover,
    /Math\.max\(1200, Math\.round\(window\.innerHeight \* 1\.45\)\)/
  );
  assert.match(discover, /settle\(forecastTimeline, 0\.82\)/);
});
