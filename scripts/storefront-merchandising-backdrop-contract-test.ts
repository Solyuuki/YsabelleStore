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
  /\.home-categories\s*\{[\s\S]*?rgb\(0 140 255 \/ 16%\)[\s\S]*?rgb\(98 91 255 \/ 17%\)[\s\S]*?rgb\(168 60 240 \/ 10%\)[\s\S]*?var\(--home-category-bg-end\)/,
  "Shop by Category must use the branded cool retail canvas."
);

assert.match(
  css,
  /\.home-categories::before\s*\{[\s\S]*?repeating-linear-gradient\([\s\S]*?var\(--home-category-shelf-line\)[\s\S]*?var\(--home-category-stock-blue\)[\s\S]*?mask-image:/,
  "Shop by Category must render the retail shelf abstraction with scalable CSS gradients."
);

assert.match(
  css,
  /\.home-categories > \.customer-container\s*\{[\s\S]*?z-index:\s*1/,
  "Category content must remain above the decorative retail backdrop."
);

assert.doesNotMatch(
  css,
  /\.home-categories[\s\S]*?url\(/,
  "Shop by Category must not depend on raster or photographic backgrounds."
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
