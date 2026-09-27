import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const normalizeSource = await readFile(
  new URL("../../catalog-image-engine/ciqe/normalize.py", import.meta.url),
  "utf8"
);
const mainSource = await readFile(
  new URL("../../catalog-image-engine/app/main.py", import.meta.url),
  "utf8"
);
const batchSource = await readFile(
  new URL("../../catalog-image-engine/app/batch.py", import.meta.url),
  "utf8"
);
const customerCss = await readFile(
  new URL("../../frontend/src/styles/customer.css", import.meta.url),
  "utf8"
);

assert.match(normalizeSource, /CANVAS_POLICIES\s*=\s*\{"legacy", "white"\}/);
assert.match(normalizeSource, /WHITE_CANVAS_RGBA\s*=\s*\(255, 255, 255, 255\)/);
assert.match(normalizeSource, /canvas_policy:\s*str\s*=\s*"legacy"/);
assert.match(mainSource, /normalize_image_path\(source, output, canvas_policy="white"\)/);
assert.match(
  batchSource,
  /normalize_image_path\(source, output_directory, canvas_policy="legacy"\)/
);

assert.match(customerCss, /--product-media-surface:\s*#fff;/);
assert.match(customerCss, /background:\s*var\(--product-media-surface\);/);

console.log("catalog image white-canvas contract passed");
