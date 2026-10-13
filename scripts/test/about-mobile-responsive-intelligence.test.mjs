import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("About phone Forecast chart uses a separate non-scrolling drawing with real example data", () => {
  const motion = read("frontend/src/components/customer/about/AboutForecastMotion.tsx");
  const css = read("frontend/src/styles/about-mobile-intelligence.css");
  const page = read("frontend/src/pages/customer/AboutExperiencePage.tsx");

  assert.match(page, /import "@\/styles\/about-mobile-intelligence\.css"/);
  assert.match(motion, /className="about-forecast-demo__chart-mobile"/);
  assert.match(motion, /viewBox="0 0 320 186"/);
  assert.match(motion, /role="img"/);
  assert.match(motion, /18\.4 thousand units in 2023/);
  assert.match(motion, /31\.1 thousand in 2028/);
  assert.match(motion, /className="about-forecast-demo__chart"/);
  assert.match(motion, /annualForecast\.map/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /\.about-experience \.about-forecast-demo__chart\s*\{\s*display: none;/);
  assert.match(css, /\.about-experience \.about-forecast-demo__chart-mobile\s*\{\s*display: block;[^}]*width: 100%;[^}]*height: auto;/);
  assert.match(css, /\.about-experience \.about-forecast-demo__chart-wrap\s*\{[^}]*overflow-x: hidden;/);
  assert.match(css, /\.about-experience \.about-forecast-demo__recommendation-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.about-experience \.about-forecast-demo__metrics\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("System intelligence mobile selector preserves all seven stages and actions", () => {
  const component = read("frontend/src/components/customer/discover/SystemIntelligenceScene.tsx");
  const css = read("frontend/src/styles/about-mobile-intelligence.css");

  assert.match(component, /className="system-preview__mobile-stage-picker"/);
  assert.match(component, /aria-label="Choose a system intelligence stage"/);
  assert.match(component, /onChange=\{\(event\) => selectStage\(Number\(event\.target\.value\)\)\}/);
  assert.match(component, /value=\{activeStage\}/);
  assert.match(component, /previewStages\.map\(\(\{ label, title \}, index\) => \(/);
  assert.match(component, /aria-current=\{index === activeStage \? "step" : undefined\}/);
  assert.match(component, /<StageContent stageIndex=\{activeStage\}/);
  assert.match(css, /\.about-experience \.system-preview__nav ol\s*\{\s*display: none;/);
  assert.match(css, /\.about-experience \.system-preview__mobile-stage-picker\s*\{\s*display: grid;/);
  assert.match(css, /\.about-experience \.system-preview__mobile-stage-picker select\s*\{[^}]*min-height: 44px;/);
  assert.match(css, /\.about-experience \.system-preview__metrics\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
});

test("phone three-KPI groups fill their two-row grid without an empty fourth slot", () => {
  const css = read("frontend/src/styles/about-mobile-intelligence.css");
  const desktop = read("frontend/src/styles/customer.css");
  const component = read("frontend/src/components/customer/discover/SystemIntelligenceScene.tsx");
  const phone = css.split("@media (max-width: 700px) {")[1]?.split("@media (max-width: 359px)")[0];

  assert.ok(phone, "Expected scoped phone styles");
  assert.match(phone, /\.about-experience \.system-preview__metrics\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(phone, /\.about-experience \.system-preview__metrics > \.system-preview__metric:first-child:nth-last-child\(3\)\s*\{\s*grid-column: 1 \/ -1;/);
  assert.match(desktop, /\.system-preview__metrics\s*\{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(component, /<Metric label="Today's sales" value="₱2,993\.00" note="Demo value" \/>/);
  assert.match(component, /<Metric label="Transactions" value="3" \/>/);
  assert.match(component, /<Metric label="Units sold" value="50" \/>/);
  assert.doesNotMatch(phone, /overflow-x: auto/);
});

test("Forecast and Delivery show immediately on phones, retaining desktop scroll motion", () => {
  const discover = read("frontend/src/pages/customer/DiscoverPage.tsx");
  const delivery = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");
  const deliveryCss = read("frontend/src/styles/about-storefront-handoff-layout.css");

  assert.match(discover, /if \(isAboutExperience\) \{[\s\S]*?if \(!mobile\) \{[\s\S]*?const forecastKicker/);
  assert.match(discover, /pin: location/);
  assert.match(delivery, /media\.add\("\(min-width: 701px\) and \(prefers-reduced-motion: no-preference\)"/);
  assert.match(delivery, /src=\{DELIVERY_VIDEO_SRC\}/);
  assert.match(delivery, /onEnded=\{\(\) => beginDeliveryCrossfade\(index\)\}/);
  assert.match(deliveryCss, /@media \(max-width: 700px\)/);
  assert.match(deliveryCss, /\.about-experience \.story-delivery\s*\{[^}]*min-height: 0;/);
  assert.match(deliveryCss, /\.about-experience \.story-delivery__stage\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(deliveryCss, /\.about-experience \.story-delivery__frame\s*\{[^}]*aspect-ratio: 16 \/ 9;/);
  assert.match(deliveryCss, /\.about-experience \.story-delivery__video\s*\{[^}]*object-fit: contain;/);
});
