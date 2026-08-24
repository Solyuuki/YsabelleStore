import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const REFRESH_SCRIPT = path.join(REPO_ROOT, "scripts", "refresh_ligo_product_image.py");
const PACKAGE_JSON = path.join(REPO_ROOT, "package.json");
const SOURCES_DOC = path.join(REPO_ROOT, "frontend", "public", "images", "products", "SOURCES.md");

test("the final product-image pipeline always replaces the legacy Ligo silhouette result", () => {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8"));

  assert.match(
    packageJson.scripts["product-images:process"],
    /product_image_cutouts\.py.*refresh_ligo_product_image\.py/
  );
  assert.match(
    packageJson.scripts["product-images:cutouts:verify"],
    /product_image_cutouts\.py --verify.*refresh_ligo_product_image\.py --verify/
  );
  assert.match(
    packageJson.scripts["product-images:ligo:refresh"],
    /refresh_ligo_product_image\.py --download/
  );
});

test("Ligo replacement workflow fetches an exact 155g full-can retail packshot and normalizes it to a safe fixed canvas", () => {
  const source = fs.readFileSync(REFRESH_SCRIPT, "utf8");

  assert.match(source, /https:\/\/www\.dmc\.com\.ph\/shop\//);
  assert.match(source, /ligo-sardines-in-tomato-sauce-with-chili-red-155g-x-100-1099/);
  assert.match(source, /MIN_SOURCE_DIMENSION\s*=\s*500/);
  assert.match(source, /OUTPUT_CANVAS\s*=\s*800/);
  assert.match(source, /validate_light_background/);
  assert.match(source, /validate_full_can_margin/);
  assert.match(source, /ligo-sardines-tomato-sauce-chili-added-155g\.webp/);
});

test("Ligo provenance explicitly avoids assuming a blanket redistribution license", () => {
  const source = fs.readFileSync(SOURCES_DOC, "utf8");

  assert.match(source, /DMC/);
  assert.match(source, /155g/);
  assert.match(source, /full-can/i);
  assert.match(source, /rights basis/i);
  assert.match(source, /not described here as copyright[- ]free/i);
  assert.match(
    source,
    /does not infer a blanket\s+copyright license from public web availability/i
  );
});
