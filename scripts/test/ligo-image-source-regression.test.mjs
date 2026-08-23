import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const CUTOUT_SCRIPT = path.join(REPO_ROOT, "scripts", "product_image_cutouts.py");
const REFRESH_SCRIPT = path.join(REPO_ROOT, "scripts", "refresh_ligo_product_image.py");
const SOURCES_DOC = path.join(
  REPO_ROOT,
  "frontend",
  "public",
  "images",
  "products",
  "SOURCES.md"
);

test("Ligo no longer depends on the legacy manual silhouette crop", () => {
  const source = fs.readFileSync(CUTOUT_SCRIPT, "utf8");

  assert.doesNotMatch(source, /MANUAL_PRODUCT_POLYGONS/);
  assert.doesNotMatch(source, /manual sealed-product silhouette/);
  assert.doesNotMatch(source, /isolate_manual_product/);
});

test("Ligo replacement workflow fetches an exact 155g full-can retail packshot and re-runs deterministic processing", () => {
  const source = fs.readFileSync(REFRESH_SCRIPT, "utf8");

  assert.match(
    source,
    /https:\/\/www\.dmc\.com\.ph\/shop\/ligo-sardines-in-tomato-sauce-with-chili-red-155g-x-100-1099/
  );
  assert.match(source, /MIN_SOURCE_DIMENSION\s*=\s*500/);
  assert.match(source, /validate_light_background/);
  assert.match(source, /product_image_cutouts\.py/);
  assert.match(source, /ligo-sardines-tomato-sauce-chili-added-155g\.webp/);
});

test("Ligo provenance documents the replacement source without calling third-party imagery copyright-free", () => {
  const source = fs.readFileSync(SOURCES_DOC, "utf8");

  assert.match(source, /DMC/);
  assert.match(source, /155g/);
  assert.match(source, /full-can/i);
  assert.doesNotMatch(source, /copyright[- ]free/i);
});
