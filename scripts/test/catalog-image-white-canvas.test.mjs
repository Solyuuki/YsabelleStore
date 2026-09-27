import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const normalizeSource = await readFile(
  new URL("../../catalog-image-engine/ciqe/normalize.py", import.meta.url),
  "utf8"
);
const customerCss = await readFile(
  new URL("../../frontend/src/styles/customer.css", import.meta.url),
  "utf8"
);

assert.match(normalizeSource, /CATALOG_CANVAS_RGBA\s*=\s*\(255, 255, 255, 255\)/);
assert.match(
  normalizeSource,
  /Image\.new\("RGBA", \(side, side\), CATALOG_CANVAS_RGBA\)/
);
assert.doesNotMatch(
  normalizeSource,
  /background_rgba\s*=\s*\(\*detection\.background_rgb/
);

assert.match(customerCss, /--product-media-surface:\s*#fff;/);
assert.match(customerCss, /background:\s*var\(--product-media-surface\);/);

console.log("catalog image white-canvas contract passed");
