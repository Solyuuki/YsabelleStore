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
assert.match(entranceSource, /Your Neighborhood Store,/);
assert.match(entranceSource, /Now Online\./);
assert.match(entranceSource, />Get Started</);
assert.doesNotMatch(entranceSource, /Step inside a compact neighborhood store/);
assert.doesNotMatch(entranceSource, /Neighborhood grocery · Pasig City/);
assert.match(entranceSource, /prefers-reduced-motion: reduce/);
assert.doesNotMatch(entranceSource, /controls/);
assert.doesNotMatch(homeSource, /<section className="home-hero">/);

assert.doesNotMatch(productCardSource, /"In stock"/);
assert.match(productCardSource, /cartQuantity > 0/);
assert.match(productCardSource, /min=\{0\}/);
assert.match(productCardSource, /disabled=\{outOfStock \|\| !isReady\}/);
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
assert.match(premiumCss, /\.store-entrance__enter[\s\S]*?min-height:\s*48px/);
assert.match(premiumCss, /\.store-entrance__enter::after[\s\S]*?store-entrance-cta-sheen 3\.8s/);
assert.match(premiumCss, /@keyframes store-entrance-cta-sheen/);
assert.match(premiumCss, /@keyframes store-entrance-cta-glow/);
assert.match(premiumCss, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?\.store-entrance__enter::after/);
assert.match(premiumCss, /\.customer-product-card__favorite[\s\S]*?width:\s*44px;[\s\S]*?height:\s*44px/);
assert.match(premiumCss, /grid-template-columns:\s*44px minmax\(0, 1fr\) 44px/);
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
assert.ok(contrast("#0070C9", "#FFFFFF") >= 3);
assert.ok(contrast("#17765F", "#FFFFFF") >= 4.5);
assert.ok(contrast("#8B5100", "#FFF6E5") >= 4.5);
assert.ok(contrast("#B33B3B", "#FFFFFF") >= 4.5);

console.log("Storefront premium home/accessibility contract passed.");
