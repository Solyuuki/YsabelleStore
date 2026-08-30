import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("brand components use the bundled official logo and retain visible fallbacks", async () => {
  const [legacySharedLogo, customerMark, header, footer, sidebar, styles] = await Promise.all([
    source("frontend/src/components/brand/BrandLogo.tsx"),
    source("frontend/src/components/customer/YsabelleBrandMark.tsx"),
    source("frontend/src/components/customer/CustomerHeader.tsx"),
    source("frontend/src/components/customer/CustomerFooter.tsx"),
    source("frontend/src/components/app/AppSidebar.tsx"),
    source("frontend/src/styles/brand.css")
  ]);

  for (const [name, component] of [
    ["BrandLogo", legacySharedLogo],
    ["YsabelleBrandMark", customerMark]
  ]) {
    assert.match(
      component,
      /import officialLogoUrl from ["']@\/assets\/brand\/ysabelle-logo-official\.webp["'];/,
      `${name} must import the approved bundled Ysabelle logo.`
    );
    assert.doesNotMatch(
      component,
      /\/brand\/ysabelle-logo-v2\.png/,
      `${name} must not depend on the legacy public logo path.`
    );
  }

  assert.match(
    legacySharedLogo,
    /onError=\{[^}]*setImageFailed\(true\)/s,
    "BrandLogo must swap to its vector fallback if the bundled image cannot render."
  );
  assert.match(legacySharedLogo, /<svg[\s>]/, "BrandLogo must contain a built-in vector fallback.");
  assert.match(
    customerMark,
    /event\.currentTarget\.hidden = true/,
    "YsabelleBrandMark must reveal its Store fallback if the bundled image cannot render."
  );
  assert.match(customerMark, /<Store className="ysabelle-brand-mark__fallback" \/>/);

  assert.match(header, /YsabelleBrandMark/, "header must render the shared customer mark.");
  assert.match(footer, /YsabelleBrandMark/, "footer must render the shared customer mark.");
  assert.match(sidebar, /YsabelleBrandMark/, "staff sidebar must render the canonical shared mark.");
  assert.doesNotMatch(sidebar, /\/brand\/ysabelle-logo-v2\.png/);

  assert.match(styles, /\.ysabelle-brand-mark__fallback/);
  assert.match(styles, /\.ysabelle-brand-mark__image\[hidden\]/);
});
