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
  /\.home-categories\s*\{[\s\S]*?rgb\(0 140 255 \/ 8%\)[\s\S]*?rgb\(98 91 255 \/ 9%\)[\s\S]*?rgb\(168 60 240 \/ 4\.5%\)[\s\S]*?var\(--home-category-bg-end\)/,
  "Shop by Category must use the calm cold blue-indigo-violet canvas."
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
  /function CategoryRetailBackdrop\(\)[\s\S]*?aria-hidden="true"[\s\S]*?home-categories__retail-depth--left[\s\S]*?home-categories__retail-depth--right/,
  "Retail ambience must stay decorative, inaccessible to assistive tech, and balanced on both sides."
);

assert.match(
  home,
  /id="categoryBlurFar"[\s\S]*?<feGaussianBlur stdDeviation="12" \/>[\s\S]*?id="categoryCenterWash"/,
  "Retail ambience must use soft-focus depth and a clean center wash."
);

assert.match(
  css,
  /\.home-categories__retail-scene[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%[\s\S]*?opacity:\s*0\.78/,
  "Retail scene must scale with the category section at restrained opacity."
);

assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*?\.home-categories__retail-scene[\s\S]*?opacity:\s*0\.56[\s\S]*?\.home-categories__retail-near[\s\S]*?opacity:\s*0\.38/,
  "Retail atmosphere must reduce intensity on small screens."
);

assert.match(
  css,
  /\.home-merchandising-stage\s*\{[\s\S]*?background:\s*transparent/,
  "Merchandising stage must inherit the Shop/Catalog canvas."
);

assert.doesNotMatch(
  css,
  /\.home-merchandising-stage::before\s*\{/,
  "Merchandising stage must not create a photographic background layer."
);

assert.doesNotMatch(
  css,
  /\.home-merchandising-stage::after\s*\{/,
  "Merchandising stage must not create a dark image overlay."
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
  /<div className="home-merchandising-stage">[\s\S]*?<MerchandisingArea[\s\S]*?<section className="customer-section home-essentials">[\s\S]*?<HomeNextStep/,
  "Trending, Best Sellers, Everyday Essentials, and the next-step CTA must stay within one storefront stage."
);

console.log("Storefront Shop/Catalog background contract passed.");
