import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("brand components use only the approved circular Ysabelle logo", async () => {
  const [brandLogo, customerMark, header, footer, sidebar, statusScreen, styles] =
    await Promise.all([
      source("frontend/src/components/brand/BrandLogo.tsx"),
      source("frontend/src/components/customer/YsabelleBrandMark.tsx"),
      source("frontend/src/components/customer/CustomerHeader.tsx"),
      source("frontend/src/components/customer/CustomerFooter.tsx"),
      source("frontend/src/components/app/AppSidebar.tsx"),
      source("frontend/src/components/shared/StatusScreen.tsx"),
      source("frontend/src/styles/brand.css")
    ]);

  assert.match(
    brandLogo,
    /import officialLogoUrl from ["']@\/assets\/brand\/ysabelle-logo-official\.webp["'];/
  );
  assert.match(brandLogo, /src=\{officialLogoUrl\}/);
  assert.doesNotMatch(brandLogo, /<svg[\s>]/);
  assert.doesNotMatch(brandLogo, /M18 21h28|#625bff|#008cff/);

  assert.match(
    customerMark,
    /import officialLogoUrl from ["']@\/assets\/brand\/ysabelle-logo-official\.webp["'];/
  );
  assert.match(customerMark, /src=\{officialLogoUrl\}/);
  assert.doesNotMatch(customerMark, /<BrandLogo|\bStore\b/);
  assert.doesNotMatch(customerMark, /ysabelle-brand-mark__fallback/);

  for (const consumer of [header, footer, sidebar]) {
    assert.match(consumer, /YsabelleBrandMark/);
  }
  assert.match(statusScreen, /BrandLogo/);

  assert.match(styles, /\.ysabelle-brand-mark[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(styles, /ysabelle-brand-mark__fallback/);
  assert.doesNotMatch(styles, /--ysabelle-brand-fallback/);
});
