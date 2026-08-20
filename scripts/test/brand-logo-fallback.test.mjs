import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("customer brand marks retain a visible fallback when the PNG is unavailable", async () => {
  const [component, header, footer, styles] = await Promise.all([
    source("frontend/src/components/brand/BrandLogo.tsx"),
    source("frontend/src/components/customer/CustomerHeader.tsx"),
    source("frontend/src/components/customer/CustomerFooter.tsx"),
    source("frontend/src/styles/brand.css")
  ]);

  assert.match(
    component,
    /onError=\{[^}]*setImageFailed\(true\)/s,
    "BrandLogo must swap to its fallback when the PNG cannot load."
  );
  assert.match(component, /<svg[\s>]/, "BrandLogo must contain a built-in vector fallback.");
  assert.match(
    component,
    /\/brand\/ysabelle-logo-v2\.png/,
    "BrandLogo must keep the real Ysabelle logo as the primary source."
  );

  for (const [name, value] of [
    ["header", header],
    ["footer", footer]
  ]) {
    assert.match(value, /BrandLogo/, `${name} must render the shared BrandLogo component.`);
    assert.doesNotMatch(
      value,
      /<img[^>]+ysabelle-logo-v2\.png/,
      `${name} must not render the fragile brand PNG directly.`
    );
  }

  assert.doesNotMatch(
    styles,
    /story-welcome__mark\s*>\s*svg\s*\{[^}]*display:\s*none/s,
    "The About welcome scene must keep its vector Store mark visible as a resilient fallback."
  );
  assert.doesNotMatch(
    styles,
    /story-live-store__bar[^{}]*svg:first-child\s*\{[^}]*display:\s*none/s,
    "The live-store identity must keep its vector Store mark visible as a resilient fallback."
  );
  assert.doesNotMatch(
    styles,
    /background-image:\s*var\(--ys-brand-logo\)/,
    "Story identity marks must not disappear when the static PNG is unavailable."
  );
});
