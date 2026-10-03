import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cssPath = resolve(process.cwd(), "src/styles/customer-home-premium.css");
const homePath = resolve(process.cwd(), "src/pages/customer/CustomerHomePage.tsx");

const css = readFileSync(cssPath, "utf8");
const home = readFileSync(homePath, "utf8");

assert.doesNotMatch(
  css,
  /shop-category-background\.webp|storefront-merchandising-background\.webp|home-next-step-background\.(?:avif|webp)/,
  "Storefront home sections must not depend on photographic background assets."
);

assert.match(
  css,
  /\.customer-home\s*\{[\s\S]*?linear-gradient\(145deg, #f4f6fb 0%, #f1f0f8 50%, #f7f2f6 100%\)/,
  "Storefront home must use the Shop/Catalog canvas."
);

assert.match(
  css,
  /\.home-categories\s*\{[\s\S]*?--retail-bg-a:\s*#edf8ff[\s\S]*?--retail-object-blue:\s*#78c7ff[\s\S]*?--retail-object-violet:\s*#a88cff[\s\S]*?linear-gradient\([\s\S]*?var\(--retail-bg-a\)[\s\S]*?var\(--retail-bg-c\)/,
  "Shop by Category must use theme-ready cold retail color tokens."
);

assert.doesNotMatch(
  css,
  /\.home-categories::(?:before|after)\s*\{/,
  "Shop by Category must not use decorative pseudo-element patterns."
);

assert.doesNotMatch(
  css,
  /\.home-categories[\s\S]*?(?:repeating-linear-gradient|url\(["']?\/)/,
  "Shop by Category must remain pattern-free and independent of raster backgrounds."
);

assert.match(
  home,
  /<CategoryRetailBackdrop \/>/,
  "Shop by Category must render the responsive vector retail ambience."
);

assert.match(
  home,
  /function CategoryRetailBackdrop\(\)[\s\S]*?aria-hidden="true"[\s\S]*?home-categories__center-light[\s\S]*?home-categories__scene--left[\s\S]*?home-categories__scene--right/,
  "Retail ambience must keep the center light behind two independent decorative side scenes."
);

assert.match(
  home,
  /categoryLeftBlurNear[\s\S]*?stdDeviation="2\.5"[\s\S]*?categoryLeftBlurMid[\s\S]*?stdDeviation="4\.5"[\s\S]*?categoryLeftBlurFar[\s\S]*?stdDeviation="7\.5"/,
  "Left retail scene must use the restrained near-mid-far blur hierarchy."
);

assert.match(
  home,
  /categoryRightBlurNear[\s\S]*?stdDeviation="2\.5"[\s\S]*?categoryRightBlurMid[\s\S]*?stdDeviation="4\.5"[\s\S]*?categoryRightBlurFar[\s\S]*?stdDeviation="7\.5"/,
  "Right retail scene must use the restrained near-mid-far blur hierarchy."
);

assert.doesNotMatch(
  home,
  /stdDeviation="12"/,
  "Retail ambience must not restore the destructive 12px far blur."
);

assert.match(
  css,
  /\.home-categories__scene\s*\{[\s\S]*?width:\s*clamp\(20rem, 30vw, 31rem\)[\s\S]*?height:\s*100%/,
  "Retail side scenes must scale responsively with the category section."
);

assert.match(
  css,
  /\.home-categories__scene--left[\s\S]*?mask-image:\s*linear-gradient[\s\S]*?\.home-categories__scene--right[\s\S]*?mask-image:\s*linear-gradient/,
  "Each retail side scene must fade toward the clean center with its own mask."
);

assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*?\.home-categories__scene-far\s*\{[\s\S]*?display:\s*none[\s\S]*?\.home-categories__scene-mid[\s\S]*?opacity:\s*0\.42/,
  "Retail ambience must simplify and reduce depth on small screens."
);

assert.match(
  css,
  /\.home-merchandising-stage\s*\{[\s\S]*?background:\s*transparent/,
  "Outer merchandising stage must stay neutral so the CTA can remain separate."
);

assert.match(
  css,
  /\.home-merchandising-canvas\s*\{[\s\S]*?--merch-bg-top:\s*#edf6ff[\s\S]*?--merch-blue-rgb:\s*82 177 255[\s\S]*?--merch-violet-rgb:\s*177 102 241[\s\S]*?radial-gradient\([\s\S]*?linear-gradient\(/,
  "Trending through Everyday Essentials must share the calm cold editorial merchandising canvas."
);

assert.doesNotMatch(
  css,
  /\.home-merchandising-canvas[\s\S]*?(?:url\(|repeating-linear-gradient)/,
  "Merchandising canvas must remain CSS-only and pattern-free."
);

assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*?\.home-merchandising-canvas\s*\{[\s\S]*?rgb\(var\(--merch-blue-rgb\) \/ 14%\)[\s\S]*?rgb\(var\(--merch-violet-rgb\) \/ 8%\)/,
  "Merchandising ambience must reduce edge intensity on small screens."
);

assert.doesNotMatch(
  css,
  /\.home-merchandising-stage::before\s*\{|\.home-merchandising-stage::after\s*\{/,
  "Outer merchandising stage must not create image or overlay layers."
);

assert.match(
  css,
  /\.home-merchandising-canvas::before,[\s\S]*?\.home-merchandising-canvas::after[\s\S]*?content:\s*""[\s\S]*?pointer-events:\s*none/,
  "Merchandising canvas must use non-interactive CSS-only ambient ribbon layers."
);

assert.match(
  css,
  /\.home-merchandising-canvas::before[\s\S]*?linear-gradient\([\s\S]*?\.home-merchandising-canvas::after[\s\S]*?linear-gradient\(/,
  "Merchandising canvas must include visible blue-violet wave geometry from CSS gradients."
);

assert.doesNotMatch(
  css,
  /\.home-next-step::before\s*\{/,
  "Next-step CTA must not create a photographic background layer."
);

assert.doesNotMatch(
  css,
  /\.home-next-step::after\s*\{/,
  "Next-step CTA must not create a dark image overlay."
);

assert.match(home, /<div className="home-merchandising-stage">/);
assert.match(
  home,
  /<div className="home-merchandising-stage">[\s\S]*?<div className="home-merchandising-canvas">[\s\S]*?<MerchandisingArea[\s\S]*?<section className="customer-section home-essentials">[\s\S]*?<\/div>[\s\S]*?<HomeNextStep/,
  "Trending, Best Sellers, and Everyday Essentials must share one canvas while the next-step CTA stays outside it."
);

console.log("Storefront Shop/Catalog background contract passed.");
