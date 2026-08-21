import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("customer brand marks use the bundled official logo and retain a visible fallback", async () => {
  const [component, header, footer, styles] = await Promise.all([
    source("frontend/src/components/brand/BrandLogo.tsx"),
    source("frontend/src/components/customer/CustomerHeader.tsx"),
    source("frontend/src/components/customer/CustomerFooter.tsx"),
    source("frontend/src/styles/brand.css")
  ]);

  assert.match(
    component,
    /import officialLogoUrl from ["']@\/assets\/brand\/ysabelle-logo-official\.webp["'];/,
    "BrandLogo must import the approved bundled Ysabelle logo."
  );
  assert.match(
    component,
    /onError=\{[^}]*setImageFailed\(true\)/s,
    "BrandLogo must swap to its fallback if the bundled image cannot render."
  );
  assert.match(component, /<svg[\s>]/, "BrandLogo must contain a built-in vector fallback.");
  assert.doesNotMatch(
    component,
    /\/brand\/ysabelle-logo-v2\.png/,
    "BrandLogo must not depend on the legacy public logo path."
  );

  for (const [name, value] of [
    ["header", header],
    ["footer", footer]
  ]) {
    assert.match(value, /BrandLogo/, `${name} must render the shared BrandLogo component.`);
    assert.doesNotMatch(
      value,
      /<img[^>]+ysabelle-logo-v2\.png/,
      `${name} must not render the fragile legacy brand PNG directly.`
    );
  }

  assert.match(
    styles,
    /url\(["']\.\.\/assets\/brand\/ysabelle-logo-official\.webp["']\)/,
    "About/Discover identity marks must use the bundled official logo."
  );
  assert.doesNotMatch(
    styles,
    /story-welcome__mark\s*>\s*svg\s*\{[^}]*display:\s*none/s,
    "The About welcome scene must keep its vector Store mark available as a fallback."
  );
  assert.doesNotMatch(
    styles,
    /story-live-store__bar[^{}]*svg:first-child\s*\{[^}]*display:\s*none/s,
    "The live-store identity must keep its vector Store mark available as a fallback."
  );
});
