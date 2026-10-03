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
  /\.home-categories\s*\{[\s\S]*?--retail-bg-a:\s*#edf8ff[\s\S]*?--category-portal-blue:\s*#7fc7ff[\s\S]*?--category-portal-violet:\s*#c89cff[\s\S]*?linear-gradient\([\s\S]*?var\(--retail-bg-a\)[\s\S]*?var\(--retail-bg-c\)/,
  "Shop by Category must use the cold showroom-portal palette."
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
  "Shop by Category must render the responsive vector showroom ambience."
);

assert.match(
  home,
  /function CategoryRetailBackdrop\(\)[\s\S]*?aria-hidden="true"[\s\S]*?viewBox="0 0 1600 900"[\s\S]*?home-categories__portal-ceiling[\s\S]*?home-categories__portal-side--left[\s\S]*?home-categories__portal-side--right[\s\S]*?home-categories__handoff/,
  "Category backdrop must use architectural portal framing and a merchandising handoff wave."
);

assert.doesNotMatch(
  home,
  /function CategoryRetailBackdrop\(\)[\s\S]*?home-categories__(?:products|podiums|leaves|shelf)/,
  "Category showroom backdrop must not restore literal retail-object silhouettes."
);

assert.match(
  css,
  /\.home-categories__portal-scene\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%/,
  "Category portal scene must scale with the entire section."
);

assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*?\.home-categories__portal-ceiling[\s\S]*?opacity:\s*0\.42[\s\S]*?\.home-categories__portal-side[\s\S]*?opacity:\s*0\.38/,
  "Category portal must simplify its architecture on small screens."
);

assert.match(
  css,
  /\.home-merchandising-stage\s*\{[\s\S]*?background:\s*transparent/,
  "Outer merchandising stage must stay neutral so the CTA can remain separate."
);

assert.match(
  home,
  /<div aria-hidden="true" className="home-category-merch-handoff" \/>/,
  "Category and merchandising sections must render an explicit decorative transition bridge."
);

assert.match(
  css,
  /\.home-category-merch-handoff\s*\{[\s\S]*?margin-top:\s*calc\(-1 \* clamp\([\s\S]*?margin-bottom:\s*calc\(-1 \* clamp\([\s\S]*?linear-gradient\([\s\S]*?#eef7ff 100%/,
  "Category-to-merchandising bridge must overlap both sections and crossfade into the merchandising top color."
);

assert.match(
  css,
  /\.home-category-merch-handoff::after[\s\S]*?#eef7ff 100%/,
  "Transition bridge must finish with the exact merchandising top color to prevent a visible seam."
);

assert.match(
  css,
  /\.home-merchandising-canvas\s*\{[\s\S]*?--merch-bg-top:\s*#eef7ff[\s\S]*?--merch-wave-blue:\s*#7fc7ff[\s\S]*?--merch-wave-violet:\s*#c89cff[\s\S]*?background:\s*var\(--merch-bg-mid\)/,
  "Trending through Everyday Essentials must share the cold vertical merchandising canvas."
);

assert.match(
  home,
  /<MerchandisingBackdrop \/>/,
  "Merchandising canvas must render the dedicated decorative backdrop."
);

assert.match(
  home,
  /function MerchandisingBackdrop\(\)[\s\S]*?aria-hidden="true"[\s\S]*?viewBox="0 0 1600 2400"[\s\S]*?home-merchandising-canvas__waves--top[\s\S]*?home-merchandising-canvas__waves--bottom/,
  "Merchandising backdrop must be a tall, full-height vector scene with top and bottom wave zones."
);

assert.match(
  css,
  /\.home-merchandising-canvas__backdrop\s*\{[\s\S]*?position:\s*absolute[\s\S]*?inset:\s*0[\s\S]*?pointer-events:\s*none/,
  "Merchandising vector backdrop must stay decorative and non-interactive."
);

assert.match(
  css,
  /\.home-merchandising-canvas__scene\s*\{[\s\S]*?width:\s*100%[\s\S]*?height:\s*100%/,
  "Tall merchandising vector scene must scale with the entire canvas."
);

assert.match(
  css,
  /@media \(max-width: 700px\)[\s\S]*?\.home-merchandising-canvas__waves--top[\s\S]*?opacity:\s*0\.68[\s\S]*?\.home-merchandising-canvas__waves--bottom[\s\S]*?opacity:\s*0\.72/,
  "Tall merchandising atmosphere must reduce intensity on small screens."
);

assert.doesNotMatch(
  css,
  /\.home-merchandising-canvas::before|\.home-merchandising-canvas::after|repeating-linear-gradient|background-image:\s*url\(/,
  "Merchandising canvas must not depend on pseudo-element ribbons, repeating patterns, or raster background images."
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

assert.match(
  home,
  /function HomeNextStep\([\s\S]*?Shop your way[\s\S]*?Pay when it&apos;s delivered\.[\s\S]*?Cash on Delivery[\s\S]*?Start shopping[\s\S]*?See our story/,
  "Closing CTA must use the approved Cash on Delivery hierarchy."
);

assert.doesNotMatch(
  home,
  /className="home-next-step__story"/,
  "Closing CTA must not restore the removed Discover Ysabelle story strip."
);

assert.doesNotMatch(
  home,
  /Start shopping\s*<ArrowRight/,
  "Primary shop CTA must not render the old arrow icon."
);

assert.match(
  home,
  /className="customer-button home-next-step__shop-button"[\s\S]*?>\s*Start shopping\s*<\/CustomerLink>/,
  "Primary shop CTA must use the dedicated shine-animation button class."
);

assert.doesNotMatch(
  home,
  /Simple store pickup|Cash on pickup|Pay When You Collect It/,
  "Closing CTA must not restore pickup-only messaging."
);

assert.match(
  home,
  /function HomeNextStepVisual\(\)[\s\S]*?viewBox="0 0 720 520"[\s\S]*?nextStepBasket[\s\S]*?home-next-step__cart/,
  "Closing CTA must render the scalable shopping-cart visual rather than a raster background."
);

assert.match(
  css,
  /\.home-next-step__main\s*\{[\s\S]*?grid-template-columns:[\s\S]*?border:\s*0;[\s\S]*?border-radius:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/,
  "Closing CTA must remain a full-width section composition without a floating card shell."
);

assert.match(
  css,
  /\.home-next-step\s*\{[\s\S]*?url\("\/media\/home-delivery-closing-background\.svg"\) center \/ cover no-repeat/,
  "Closing CTA must use the approved balanced blue-violet background artwork."
);

assert.match(
  css,
  /\.home-next-step__visual::before[\s\S]*?radial-gradient\([\s\S]*?filter:\s*blur\(20px\)/,
  "Delivery illustration may use ambient glow but must not recreate a bordered card."
);

assert.doesNotMatch(
  css,
  /\.home-next-step__story(?:\s|\{|:)/,
  "Removed story strip styles must not remain in the premium home stylesheet."
);

assert.match(
  css,
  /\.home-next-step__shop-button::after[\s\S]*?rgb\(255 255 255 \/ 62%\)[\s\S]*?transform:\s*translateX\(-260%\) skewX\(-18deg\)/,
  "Primary shop CTA must render a restrained shine layer."
);

assert.match(
  css,
  /@keyframes home-next-step-button-shine[\s\S]*?translateX\(650%\) skewX\(-18deg\)[\s\S]*?@media \(prefers-reduced-motion: no-preference\)[\s\S]*?home-next-step__shop-button::after[\s\S]*?animation:\s*home-next-step-button-shine 4\.8s ease-in-out infinite/,
  "Primary shop CTA shine must animate only when motion is allowed."
);

assert.match(home, /<div className="home-merchandising-stage">/);
assert.match(
  home,
  /<div className="home-merchandising-stage">[\s\S]*?<div className="home-merchandising-canvas">[\s\S]*?<MerchandisingArea[\s\S]*?<section className="customer-section home-essentials">[\s\S]*?<\/div>[\s\S]*?<HomeNextStep/,
  "Trending, Best Sellers, and Everyday Essentials must share one canvas while the next-step CTA stays outside it."
);

console.log("Storefront Shop/Catalog background contract passed.");
