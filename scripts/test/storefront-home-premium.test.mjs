import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const customerAppSource = await readFile(
  new URL("../../frontend/src/app/CustomerApp.tsx", import.meta.url),
  "utf8"
);
const entranceSource = await readFile(
  new URL("../../frontend/src/components/customer/StoreEntrance.tsx", import.meta.url),
  "utf8"
);
const homeSource = await readFile(
  new URL("../../frontend/src/pages/customer/CustomerHomePage.tsx", import.meta.url),
  "utf8"
);
const productCardSource = await readFile(
  new URL("../../frontend/src/components/customer/ProductCard.tsx", import.meta.url),
  "utf8"
);
const quantitySource = await readFile(
  new URL("../../frontend/src/components/customer/QuantityControl.tsx", import.meta.url),
  "utf8"
);
const premiumCss = await readFile(
  new URL("../../frontend/src/styles/customer-home-premium.css", import.meta.url),
  "utf8"
);
const railCss = await readFile(
  new URL("../../frontend/src/styles/customer-home-product-rail.css", import.meta.url),
  "utf8"
);
const headerCss = await readFile(
  new URL("../../frontend/src/styles/customer-header-actions.css", import.meta.url),
  "utf8"
);
const checkoutSource = await readFile(
  new URL("../../frontend/src/pages/customer/CheckoutPage.tsx", import.meta.url),
  "utf8"
);
const commerceCss = await readFile(
  new URL("../../frontend/src/styles/customer-commerce-premium.css", import.meta.url),
  "utf8"
);

assert.match(customerAppSource, /<StoreEntrance/);
assert.match(customerAppSource, /sessionStorage\.setItem\(STORE_ENTRANCE_SESSION_KEY/);
assert.match(customerAppSource, /pathname === "\/" && !storeEntranceDismissed/);
assert.match(entranceSource, /autoPlay/);
assert.doesNotMatch(entranceSource, /\sloop(?:\s|=|>)/);
assert.match(entranceSource, /muted/);
assert.match(entranceSource, /playsInline/);
assert.match(entranceSource, /store-entrance\.mp4\?v=53360d48/);
assert.match(entranceSource, /import \{ YsabelleBrandMark \} from "\.\/YsabelleBrandMark"/);
assert.match(entranceSource, /<YsabelleBrandMark[\s\S]*className="store-entrance__brand-mark"[\s\S]*eager[\s\S]*variant="display"/);
assert.doesNotMatch(entranceSource, /STORE_ENTRANCE_LOGO_DATA_URL|logoFailed|BrandLogo|entranceLogoUrl/);
assert.doesNotMatch(entranceSource, /sceneCurtainOpacity/);
assert.doesNotMatch(entranceSource, /requestAnimationFrame/);
assert.doesNotMatch(entranceSource, /store-entrance__scene-curtain/);
assert.match(entranceSource, /LOOP_FADE_LEAD_SECONDS\s*=\s*0\.55/);
assert.match(entranceSource, /LOOP_FADE_MS\s*=\s*420/);
assert.match(entranceSource, /LOOP_REVEAL_DELAY_MS\s*=\s*30/);
assert.match(entranceSource, /video\.currentTime\s*=\s*0/);
assert.match(entranceSource, /maybeFadeForLoop/);
assert.match(entranceSource, /store-entrance__loop-curtain/);
assert.match(entranceSource, /Your Neighborhood Store/);
assert.doesNotMatch(entranceSource, /Your Neighborhood Store,/);
assert.match(entranceSource, /Now Online\./);
assert.match(entranceSource, />Get Started</);
assert.doesNotMatch(entranceSource, /Step inside a compact neighborhood store/);
assert.doesNotMatch(entranceSource, /Neighborhood grocery · Pasig City/);
assert.match(entranceSource, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(entranceSource, /controls/);
assert.doesNotMatch(homeSource, /<section className="home-hero">/);

assert.doesNotMatch(productCardSource, /"In stock"/);
assert.match(productCardSource, /selectedQuantity/);
assert.match(productCardSource, /min=\{1\}/);
assert.match(productCardSource, /ShoppingCart aria-hidden="true" size=\{17\} strokeWidth=\{2\}/);
assert.match(productCardSource, /customer-product-card__purchase-row/);
assert.match(productCardSource, /data-tooltip=\{isFavorite \? "Remove from favorites" : "Save to favorites"\}/);
assert.match(productCardSource, /customer-product-card__cart-button/);
assert.match(productCardSource, /customer-product-badge__fire/);
assert.match(productCardSource, /customer-product-badge__medal/);
assert.match(productCardSource, /customer-product-card__rating \$\{hasReviews \? "" : "is-empty"\}/);
assert.match(productCardSource, /fill=\{hasReviews \? "currentColor" : "none"\}/);
assert.match(productCardSource, /No reviews yet/);
assert.match(quantitySource, /min = 1/);
assert.match(quantitySource, /Math\.max\(min, value - 1\)/);

assert.match(premiumCss, /--customer-focus:\s*#0070c9/);
assert.match(premiumCss, /--customer-warning:\s*#8b5100/);
assert.doesNotMatch(premiumCss, /\.store-entrance__scene-curtain/);
assert.match(premiumCss, /--store-entrance-shade:\s*0\.08/);
assert.match(premiumCss, /\.store-entrance__video[\s\S]*?filter:\s*blur\(2\.8px\)[\s\S]*?transform:\s*scale\(1\.025\)/);
assert.match(premiumCss, /\.store-entrance__loop-curtain[\s\S]*?transition:\s*opacity 420ms/);
assert.match(premiumCss, /\.store-entrance__loop-curtain\.is-visible[\s\S]*?opacity:\s*1/);
assert.match(premiumCss, /\.store-entrance__content[\s\S]*?align-items:\s*center[\s\S]*?justify-content:\s*center/);
assert.match(premiumCss, /\.store-entrance__brand-mark[\s\S]*?width:\s*clamp\(132px, 10vw, 156px\)/);
assert.match(premiumCss, /\.store-entrance h1[\s\S]*?font-size:\s*clamp\(2\.2rem, 3\.7vw, 3\.1rem\)/);
assert.match(premiumCss, /\.store-entrance h1[\s\S]*?-webkit-text-stroke:\s*0\.55px rgb\(151 139 255 \/ 58%\)/);
assert.match(premiumCss, /\.store-entrance h1[\s\S]*?0 0 12px rgb\(113 92 255 \/ 16%\)/);
assert.match(premiumCss, /\.store-entrance__enter[\s\S]*?min-height:\s*48px/);
assert.match(premiumCss, /\.store-entrance__enter[\s\S]*?border:\s*1\.5px solid transparent[\s\S]*?linear-gradient\(110deg, #5b7cff 0%, #7657f6 54%, #cf4fc8 100%\) border-box/);
assert.match(premiumCss, /\.store-entrance__enter:hover[\s\S]*?linear-gradient\(110deg, #6d88ff 0%, #865df8 52%, #dd5fd0 100%\) border-box/);
assert.match(premiumCss, /\.store-entrance__enter > span[\s\S]*?linear-gradient\(100deg, #243fbd 0%, #6548e8 52%, #b832b4 100%\)[\s\S]*?-webkit-text-fill-color:\s*transparent/);
assert.match(premiumCss, /\.store-entrance__enter > span[\s\S]*?font-weight:\s*850/);
assert.match(premiumCss, /\.store-entrance__enter::after[\s\S]*?store-entrance-cta-sheen 3\.8s/);
assert.match(premiumCss, /@keyframes store-entrance-cta-sheen/);
assert.match(premiumCss, /@keyframes store-entrance-cta-glow/);
assert.match(premiumCss, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?\.store-entrance__enter::after/);
assert.match(
  premiumCss,
  /\.customer-home\s*\{[\s\S]*?linear-gradient\(145deg, #f4f6fb 0%, #f1f0f8 50%, #f7f2f6 100%\)/
);
assert.match(
  premiumCss,
  /\.home-categories\s*\{[\s\S]*?rgb\(0 140 255 \/ 9%\)[\s\S]*?rgb\(98 91 255 \/ 10%\)[\s\S]*?rgb\(168 60 240 \/ 5%\)[\s\S]*?var\(--home-category-bg-end\)/
);
assert.doesNotMatch(premiumCss, /\.home-categories::(?:before|after)/);
assert.doesNotMatch(
  premiumCss,
  /\.home-categories[\s\S]*?(?:repeating-linear-gradient|url\()/
);
assert.match(homeSource, /<CategoryRetailBackdrop \/>/);
assert.match(
  homeSource,
  /function CategoryRetailBackdrop\(\)[\s\S]*?aria-hidden="true"[\s\S]*?home-categories__backdrop-side--left[\s\S]*?home-categories__backdrop-side--right/
);
assert.match(
  premiumCss,
  /\.home-categories__backdrop-side[\s\S]*?width:\s*clamp\([\s\S]*?opacity:\s*0\.58/
);
assert.match(
  premiumCss,
  /@media \(max-width: 700px\)[\s\S]*?\.home-categories__backdrop-side[\s\S]*?opacity:\s*0\.42/
);
assert.match(
  premiumCss,
  /\.home-categories \.home-section-heading h2[\s\S]*?color:\s*var\(--customer-dark\)[\s\S]*?-webkit-text-stroke:\s*0/
);
assert.match(
  premiumCss,
  /\.home-categories \.home-section-heading p:last-child[\s\S]*?color:\s*var\(--customer-muted\)/
);
assert.match(homeSource, /<div className="home-merchandising-stage">[\s\S]*?<MerchandisingArea[\s\S]*?<section className="customer-section home-essentials">[\s\S]*?<HomeNextStep[\s\S]*?<\/div>/);
assert.match(
  premiumCss,
  /\.home-merchandising-stage\s*\{[\s\S]*?background:\s*transparent/
);
assert.match(
  premiumCss,
  /\.home-merchandising-stage > \.customer-section,[\s\S]*?background:\s*transparent !important/
);
assert.match(
  premiumCss,
  /\.home-merchandising-stage \.home-section-heading h2[\s\S]*?color:\s*var\(--customer-dark\)[\s\S]*?-webkit-text-stroke:\s*0/
);
assert.doesNotMatch(
  premiumCss,
  /shop-category-background\.webp|storefront-merchandising-background\.webp|home-next-step-background\.(?:avif|webp)/
);
assert.doesNotMatch(premiumCss, /\.home-merchandising-stage::before/);
assert.doesNotMatch(premiumCss, /\.home-merchandising-stage::after/);
assert.doesNotMatch(premiumCss, /\.home-merchandising--trending::before/);
assert.doesNotMatch(premiumCss, /\.home-merchandising--best-seller::before/);
assert.doesNotMatch(premiumCss, /\.home-essentials::before/);
assert.doesNotMatch(premiumCss, /\.home-next-step::before/);
assert.doesNotMatch(premiumCss, /\.home-next-step::after/);
assert.match(premiumCss, /\.customer-product-card__visual-link[\s\S]*?background:\s*var\(--product-media-surface\)/);
assert.match(premiumCss, /\.customer-product-card \.customer-product-visual[\s\S]*?background:\s*var\(--product-media-surface\)/);
assert.doesNotMatch(premiumCss, /\.customer-product-card__visual-link[\s\S]*?background:\s*#f5f4f0/);
assert.match(premiumCss, /\.customer-product-card__favorite[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px/);
assert.match(premiumCss, /\.customer-product-card__favorite\[aria-pressed="true"\][\s\S]*?linear-gradient\(135deg, #4f46e5 0%, #7c3aed 58%, #b832d0 100%\)/);
assert.match(premiumCss, /\.customer-product-badge--trending[\s\S]*?linear-gradient\(110deg, #4938e8 0%, #6748f5 60%, #a13cd4 100%\)/);
assert.match(premiumCss, /\.customer-product-badge__fire-outer[\s\S]*?color:\s*#ff343f/);
assert.match(premiumCss, /\.customer-product-badge__fire-inner[\s\S]*?color:\s*#ffb020/);
assert.match(premiumCss, /\.customer-product-badge--best-seller[\s\S]*?#ffcf5a[\s\S]*?#ffb43f/);
assert.match(premiumCss, /\.customer-product-badge__medal[\s\S]*?color:\s*#17120a/);
assert.match(premiumCss, /\.customer-product-badge__medal-center[\s\S]*?background:\s*#ffbf47/);
assert.match(premiumCss, /\.customer-product-card__cart-button[\s\S]*?linear-gradient\(110deg, #4f46e5 0%, #7c3aed 56%, #b832d0 100%\)/);
assert.match(premiumCss, /@keyframes customer-merchandising-shine/);
assert.match(premiumCss, /\.customer-product-card__rating[\s\S]*?font-size:\s*0\.74rem/);
assert.match(premiumCss, /\.customer-product-card__rating svg[\s\S]*?width:\s*15px;[\s\S]*?color:\s*#f5a623/);
assert.match(premiumCss, /\.customer-product-card__rating span[\s\S]*?border-left:\s*1px solid #c9ceda/);
assert.match(premiumCss, /\.customer-product-card__rating\.is-empty svg[\s\S]*?color:\s*#9aa6c4/);
assert.match(premiumCss, /\.customer-product-card__rating\.is-empty span[\s\S]*?border-left:\s*0/);
assert.match(premiumCss, /\.customer-product-card__price-row[\s\S]*?margin-top:\s*0\.54rem/);
assert.match(premiumCss, /\.customer-product-card__purchase-row[\s\S]*?grid-template-columns:\s*112px minmax\(0, 1fr\)/);
assert.match(premiumCss, /grid-template-columns:\s*44px minmax\(20px, 1fr\) 44px/);
assert.match(railCss, /width:\s*44px;[\s\S]*?height:\s*44px/);

function relativeLuminance(hex) {
  const channels = hex
    .replace("#", "")
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(left, right) {
  const leftLuminance = relativeLuminance(left);
  const rightLuminance = relativeLuminance(right);
  const lighter = Math.max(leftLuminance, rightLuminance);
  const darker = Math.min(leftLuminance, rightLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

// WCAG evidence for the primary CTA, focus ring, and semantic status colors.
assert.ok(contrast("#625BFF", "#FFFFFF") >= 4.5);
assert.ok(contrast("#4F46E5", "#FFFFFF") >= 4.5);
assert.ok(contrast("#7C3AED", "#FFFFFF") >= 4.5);
assert.ok(contrast("#B832D0", "#FFFFFF") >= 4.5);
assert.ok(contrast("#4938E8", "#FFFFFF") >= 4.5);
assert.ok(contrast("#A13CD4", "#FFFFFF") >= 4.5);
assert.ok(contrast("#0070C9", "#FFFFFF") >= 3);
assert.ok(contrast("#17765F", "#FFFFFF") >= 4.5);
assert.ok(contrast("#8B5100", "#FFF6E5") >= 4.5);
assert.ok(contrast("#B33B3B", "#FFFFFF") >= 4.5);

console.log("Storefront premium home/accessibility contract passed.");
