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

console.log("storefront customer QoL UI contract passed");
