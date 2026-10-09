import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const customerCss = await readFile(
  new URL("../../frontend/src/styles/customer.css", import.meta.url),
  "utf8"
);
const detailSource = await readFile(
  new URL("../../frontend/src/pages/customer/ProductDetailPage.tsx", import.meta.url),
  "utf8"
);
const adaptiveTitleSource = await readFile(
  new URL("../../frontend/src/components/customer/AdaptiveProductTitle.tsx", import.meta.url),
  "utf8"
);
const discoverSource = await readFile(
  new URL("../../frontend/src/pages/customer/DiscoverPage.tsx", import.meta.url),
  "utf8"
);
const storefrontImagesSource = await readFile(
  new URL("../../frontend/src/utils/storefrontImages.ts", import.meta.url),
  "utf8"
);

assert.match(customerCss, /customer-filter-panel > a:hover:not\(\.is-active\)/);
assert.match(customerCss, /max-height:\s*calc\(100dvh - 126px\)/);
assert.match(customerCss, /customer-related-products__viewport/);
assert.match(detailSource, /Previous related products/);
assert.match(detailSource, /Next related products/);
assert.match(detailSource, /More from \{productCategory\.name\}/);
assert.doesNotMatch(detailSource, /From other aisles/);
assert.match(detailSource, /<AdaptiveProductTitle name=\{product\.name\} \/>/);
assert.match(adaptiveTitleSource, /ResizeObserver/);
assert.match(adaptiveTitleSource, /DESKTOP_MAX_LINES = 3/);
assert.match(adaptiveTitleSource, /MOBILE_MAX_LINES = 4/);
assert.match(adaptiveTitleSource, /document\.fonts\.ready/);
assert.doesNotMatch(adaptiveTitleSource, /Nature(?:’|'|)s Spring|Absolute Pure/i);
assert.match(customerCss, /customer-product-detail__title\[data-title-density="minimum"\]/);
assert.match(discoverSource, /className="story-welcome__mark story-welcome__mark--branded"/);
assert.match(discoverSource, /<YsabelleBrandMark[\s\S]*variant="display"/);
assert.doesNotMatch(
  discoverSource,
  /<div className="story-welcome__mark story-welcome__mark--branded">/
);
assert.match(storefrontImagesSource, /sarima-p219-b7553e591e41/);
assert.match(storefrontImagesSource, /edge-artifact-20260928/);
assert.doesNotMatch(customerCss, /data-image-cleanup="trim-top-edge"/);


/* Cart dark-only styling must not inherit the old background shader or white
   pagination panel; existing AppPagination/QuantityControl behavior is retained. */
const cartCss = await readFile(
  new URL("../../frontend/src/styles/customer-cart-premium.css", import.meta.url),
  "utf8"
);
const cartSource = await readFile(
  new URL("../../frontend/src/pages/customer/CartPage.tsx", import.meta.url),
  "utf8"
);
assert.match(
  cartCss,
  /:root\.dark \.customer-app \.customer-cart-page\s*\{[^}]*background-image:[\s\S]*?var\(--storefront-galaxy-background\) !important;/,
  "Cart must reuse the exact approved Trending → Essentials galaxy palette."
);
assert.match(
  cartCss,
  /\.customer-cart-page\s*\{[^}]*#101827 100%/,
  "Cart background must reach the approved footer handoff color."
);
assert.match(
  cartCss,
  /\.customer-cart-page\s*\{[^}]*background-repeat:\s*no-repeat !important;/,
  "The Cart backdrop must never repeat the old shader."
);
assert.match(
  cartCss,
  /\.customer-cart-page__artwork\s*\{[^}]*display:\s*none;/,
  "Cart artwork must not appear in light mode."
);
assert.match(
  cartCss,
  /\.customer-cart-page__cosmos\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/,
  "Cart starfield must fill its own layer without distorting SVG geometry."
);
assert.match(
  cartSource,
  /<div aria-hidden="true" className="customer-cart-page__artwork">\s*<StorefrontGalaxyArtwork className="customer-cart-page__cosmos" \/>/,
  "Cart must reuse the shared vector constellation without exposing decorations to screen readers."
);
assert.match(
  cartCss,
  /\.customer-cart-page > \.customer-container\s*\{[^}]*z-index:\s*1;/,
  "Empty and populated Cart UI must render above galaxy artwork."
);
assert.match(
  cartCss,
  /\.customer-cart-page__artwork\s*\{[^}]*mask-image:[\s\S]*?transparent 100%/,
  "Cart constellation must fade into the footer rather than ending abruptly."
);
assert.match(cartCss, /\.customer-cart-pagination\s*\{[^}]*background:\s*#202d44 !important;/);
assert.match(cartCss, /\.customer-cart-pagination nav button\[aria-current="page"\]\s*\{[^}]*background:\s*#473c73 !important;/);
assert.match(cartCss, /\.customer-cart-pagination nav button:disabled:not\(\[aria-current="page"\]\)\s*\{[^}]*opacity:\s*0\.55;/);
assert.match(cartCss, /\.customer-cart-page \.customer-quantity > input\[type="number"\]\s*\{[^}]*background:\s*transparent !important;/);
assert.match(cartSource, /<AppPagination[\s\S]*?className="customer-cart-pagination"/);
assert.match(cartSource, /pageSize=\{CART_PAGE_SIZE\}/);
assert.match(cartSource, /<QuantityControl[\s\S]*?updateQuantity\(product\.id, value\)/);

/* A populated cart already exposes Shop through the global navigation.
   Avoid a duplicate "Continue shopping" link and its empty spacing wrapper. */
assert.doesNotMatch(
  cartSource,
  /Continue shopping|customer-continue-link|customer-cart-actions/,
  "Populated Cart must not render redundant Continue shopping UI."
);
assert.doesNotMatch(
  cartCss,
  /\.customer-cart-actions\b/,
  "Removed Cart action must not leave an empty reserved row."
);
assert.match(
  cartSource,
  /<CustomerLink className="customer-button" href="\/shop" navigate=\{navigate\}>\s*Start shopping/,
  "Empty Cart must retain its useful Start shopping action."
);
assert.match(
  cartSource,
  /Proceed to checkout/,
  "Cart checkout must remain available."
);

console.log("storefront customer QoL UI contract passed");
