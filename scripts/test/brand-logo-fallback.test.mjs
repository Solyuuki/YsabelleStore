import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("brand components use only the bundled approved circular Ysabelle logo", async () => {
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
  assert.doesNotMatch(brandLogo, /WEB_BRAND_MARK_SRC|FILE_BRAND_MARK_SRC|<svg[\s>]/);

  assert.match(customerMark, /favicon-48x48\.png/);
  assert.match(customerMark, /apple-touch-icon\.png/);
  assert.match(customerMark, /new URL\(relativeSource, document\.baseURI\)\.href/);
  assert.doesNotMatch(customerMark, /officialLogoUrl|<BrandLogo|WEB_BRAND_MARK_SRC|FILE_BRAND_MARK_SRC/);

  for (const consumer of [header, footer, sidebar]) {
    assert.match(consumer, /YsabelleBrandMark/);
  }

  assert.match(statusScreen, /status-screen-main--system/);
  assert.doesNotMatch(statusScreen, /status-system-brand-mark/);

  assert.match(styles, /\.ysabelle-brand-mark[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(styles, /ysabelle-brand-mark__fallback|--ysabelle-brand-fallback/);
});
