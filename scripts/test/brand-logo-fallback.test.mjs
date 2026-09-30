import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("brand components use one canonical circular Ysabelle mark source", async () => {
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

  assert.match(brandLogo, /ysabelle-store-mark-256\.png/);
  assert.match(brandLogo, /new URL\(FILE_BRAND_MARK_SRC, document\.baseURI\)\.href/);
  assert.doesNotMatch(brandLogo, /officialLogoUrl|ysabelle-logo-official\.webp/);
  assert.doesNotMatch(brandLogo, /<svg[\s>]|M18 21h28|#625bff|#008cff/);

  assert.match(customerMark, /BrandLogo/);
  assert.match(customerMark, /variant="mark"/);
  assert.doesNotMatch(customerMark, /officialLogoUrl|ysabelle-logo-official\.webp/);

  for (const consumer of [header, footer, sidebar]) {
    assert.match(consumer, /YsabelleBrandMark/);
  }

  assert.match(statusScreen, /status-screen-main--system/);
  assert.doesNotMatch(statusScreen, /status-system-brand-mark/);

  assert.match(styles, /\.ysabelle-brand-mark[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(styles, /ysabelle-brand-mark__fallback|--ysabelle-brand-fallback/);
});
