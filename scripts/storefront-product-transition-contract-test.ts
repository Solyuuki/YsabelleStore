import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const detailSource = readFileSync(
  resolve(process.cwd(), "src/pages/customer/ProductDetailPage.tsx"),
  "utf8"
);
const imageSource = readFileSync(
  resolve(process.cwd(), "src/utils/storefrontImages.ts"),
  "utf8"
);
const customerCss = readFileSync(resolve(process.cwd(), "src/styles/customer.css"), "utf8");

assert.doesNotMatch(detailSource, /setProduct\(null\)/);
assert.match(detailSource, /const productRef = useRef<StorefrontProductDetail \| null>\(null\)/);
assert.match(detailSource, /setIsProductTransitioning\(Boolean\(displayedProduct\)\)/);
assert.match(detailSource, /await preloadCatalogImage\(/);
assert.match(detailSource, /if \(controller\.signal\.aborted\) return/);
assert.match(detailSource, /const displayedProductId = product\?\.id \?\? null/);
assert.match(detailSource, /fetchStorefrontProductReviews\(\s*displayedProductId,/);
assert.match(detailSource, /fetchStorefrontRelatedProducts\(displayedProductId, 4,/);
assert.doesNotMatch(detailSource, /setRelatedResource\(\{ data: null/);
assert.match(
  detailSource,
  /setRelatedResource\(\(current\) => \(\{ \.\.\.current, error: "", status: "loading" \}\)\)/
);
assert.match(detailSource, /const hasCurrentData = dataMatchesCategory && Boolean\(resource\.data\)/);
assert.match(detailSource, /resource\.status === "loading" && !hasCurrentData/);
assert.match(detailSource, /resource\.status === "error" && !hasCurrentData/);
assert.match(detailSource, /resource\.status === "error" && !resource\.data/);
assert.match(detailSource, /hasCurrentData && hasProducts/);
assert.match(detailSource, /currentProductId=\{productId\}/);
assert.match(detailSource, /key=\{product\.id\}/);
assert.match(detailSource, /disabled=\{isProductTransitioning\}/);
assert.match(detailSource, /aria-busy=\{isProductTransitioning\}/);

assert.match(imageSource, /export async function preloadCatalogImage\(/);
assert.match(imageSource, /signal\?: AbortSignal/);
assert.match(imageSource, /image\.decoding = "async"/);
assert.match(imageSource, /await image\.decode\(\)/);
assert.match(imageSource, /createImagePreloadAbortError/);

assert.match(customerCss, /@keyframes customer-product-detail-enter/);
assert.match(customerCss, /data-product-transitioning="true"/);
assert.match(customerCss, /will-change: opacity, transform/);
assert.match(customerCss, /data-revalidating="true"/);
assert.match(customerCss, /prefers-reduced-motion: reduce/);

console.log("Storefront product transition contract passed.");
