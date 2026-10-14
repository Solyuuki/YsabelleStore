import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("brand components use only verified approved circular Ysabelle logo sources", async () => {
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

  for (const component of [brandLogo, customerMark]) {
    assert.match(
      component,
      /import\s*officialMark128Url\s*from\s*"@\/assets\/brand\/ysabelle-approved-mark-128\.png";/
    );
    assert.match(
      component,
      /import\s*officialMark180Url\s*from\s*"@\/assets\/brand\/ysabelle-approved-mark-180\.png";/
    );
    assert.match(component, /src=\{officialMark180Url\}/);
    assert.match(component, /srcSet=\{APPROVED_MARK_SOURCES\}/);
    assert.doesNotMatch(component, /ysabelle-store-mark-256\.png|ysabelle-logo-official\.webp/);
    assert.doesNotMatch(component, /<svg[\s>]|ysabelle-brand-mark__fallback/);
    assert.doesNotMatch(component, /M18\s*21h28|#625bff|#008cff/);
  }

  for (const consumer of [header, footer, sidebar]) {
    assert.match(consumer, /YsabelleBrandMark/);
  }
  assert.match(statusScreen, /StatusIllustration/);
  assert.match(statusScreen, /variant\s*!==\s*"system"/);
  assert.match(statusScreen, /status-screen-main--system/);
  assert.doesNotMatch(statusScreen, /status-system-brand-mark/);

  assert.match(styles, /\.ysabelle-brand-mark[\s\S]*?background:\s*transparent/);
  assert.doesNotMatch(styles, /ysabelle-brand-mark__fallback/);
  assert.doesNotMatch(styles, /--ysabelle-brand-fallback/);
});
