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
const discoverSource = await readFile(
  new URL("../../frontend/src/pages/customer/DiscoverPage.tsx", import.meta.url),
  "utf8"
);

assert.match(customerCss, /customer-filter-panel > a:hover:not\(\.is-active\)/);
assert.match(customerCss, /max-height:\s*calc\(100dvh - 126px\)/);
assert.match(customerCss, /customer-related-products__viewport/);
assert.match(detailSource, /Previous related products/);
assert.match(detailSource, /Next related products/);
assert.match(detailSource, /More from \{productCategory\.name\}/);
assert.doesNotMatch(detailSource, /From other aisles/);
assert.match(discoverSource, /story-welcome__mark--branded/);
assert.match(discoverSource, /<YsabelleBrandMark eager variant="display" \/>/);

console.log("storefront customer QoL UI contract passed");
