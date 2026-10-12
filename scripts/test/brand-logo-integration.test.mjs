import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("web shell uses cache-safe canonical Ysabelle favicon and touch icon assets", () => {
  const html = read("frontend/index.html");

  assert.match(html, /rel="icon"[^>]+href="\/brand\/favicon\.ico\?v=fullmark-[^"]+"/);
  assert.match(html, /href="\/brand\/favicon-32x32\.png\?v=fullmark-[^"]+"/);
  assert.match(
    html,
    /rel="apple-touch-icon"[\s\S]*?href="\/brand\/apple-touch-icon\.png\?v=[^"]+"/
  );
  assert.match(html, /<title>Ysabelle Store<\/title>/);
});

test("customer and staff brand marks use bundled integrity-checked responsive assets", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const footer = read("frontend/src/components/customer/CustomerFooter.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const sharedMark = read("frontend/src/components/customer/YsabelleBrandMark.tsx");

  assert.match(app, /import "@\/styles\/brand\.css";/);
  for (const source of [header, footer, sidebar]) {
    assert.match(source, /YsabelleBrandMark/);
  }
  assert.match(sharedMark, /ysabelle-approved-mark-128\.png/);
  assert.match(sharedMark, /ysabelle-approved-mark-180\.png/);
  assert.match(sharedMark, /src=\{officialMark180Url\}/);
  assert.match(sharedMark, /srcSet=\{APPROVED_MARK_SOURCES\}/);
  assert.doesNotMatch(sharedMark, /ysabelle-store-mark-256\.png/);
  assert.doesNotMatch(sidebar, /\/brand\/ysabelle-logo-v2\.png/);
  assert.doesNotMatch(sidebar, />\s*YS\s*</);
});

test("About story branding preserves the approved Ysabelle mark", () => {
  const mark = read("frontend/src/components/customer/YsabelleBrandMark.tsx");
  const identity = read("frontend/src/components/customer/DiscoverBrandIdentity.tsx");
  const styles = read("frontend/src/styles/brand.css");

  assert.match(mark, /src=\{officialMark180Url\}/);
  assert.match(mark, /srcSet=\{APPROVED_MARK_SOURCES\}/);
  assert.doesNotMatch(mark, /ysabelle-brand-mark__fallback|\bStore\b|<BrandLogo/);
  assert.match(identity, /YsabelleBrandMark/);
  assert.doesNotMatch(identity, /<BrandLogo|ysabelle-brand-mark__fallback/);
  assert.match(styles, /background:\s*transparent/);
});

test("Electron uses canonical window icon and generated packaged Windows ICO", () => {
  const builder = read("electron/electron-builder.config.cjs");
  const windowSource = read("electron/src/main/window.ts");
  const paths = read("electron/src/config/paths.ts");

  assert.match(builder, /icon:\s*"build\/icon\.ico"/);
  assert.match(windowSource, /const applicationIconPath = getApplicationIconPath\(app\.isPackaged\)/);
  assert.match(windowSource, /nativeImage\.createFromPath\(applicationIconPath\)/);
  assert.match(windowSource, /\.\.\.\(applicationIcon\.isEmpty\(\) \? \{\} : \{ icon: applicationIcon \}\)/);
  assert.match(paths, /export function getApplicationIconPath\(isPackaged:\s*boolean\)/);
  assert.match(paths, /frontend",\s*"brand",\s*"favicon-48x48\.png"/);
  assert.match(paths, /frontend\/public\/brand\/favicon-48x48\.png/);
});
