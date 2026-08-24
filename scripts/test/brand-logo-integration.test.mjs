import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("web shell uses cache-safe canonical Ysabelle favicon and touch icon assets", () => {
  const html = read("frontend/index.html");

  assert.match(html, /rel="icon"[^>]+href="\/brand\/favicon\.ico\?v=fullmark-[^"]+"/);
  assert.match(html, /href="\/brand\/favicon-32x32\.png\?v=fullmark-[^"]+"/);
  assert.match(html, /rel="apple-touch-icon"[\s\S]*?href="\/brand\/apple-touch-icon\.png\?v=[^"]+"/);
  assert.match(html, /<title>Ysabelle Store<\/title>/);
});

test("customer and staff brand marks use shared bundled logo components", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const footer = read("frontend/src/components/customer/CustomerFooter.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const sharedCustomerMark = read("frontend/src/components/customer/YsabelleBrandMark.tsx");

  assert.match(app, /import "@\/styles\/brand\.css";/);
  assert.match(header, /YsabelleBrandMark/);
  assert.match(footer, /YsabelleBrandMark/);
  assert.match(sidebar, /BrandLogo/);
  assert.match(
    sharedCustomerMark,
    /import officialLogoUrl from "@\/assets\/brand\/ysabelle-logo-official\.webp";/
  );
  assert.doesNotMatch(sidebar, /\/brand\/ysabelle-logo-v2\.png/);
  assert.doesNotMatch(sidebar, />\s*YS\s*</);
});

test("About story branding keeps the real Ysabelle mark with a visible fallback", () => {
  const brandMark = read("frontend/src/components/customer/YsabelleBrandMark.tsx");
  const discoverIdentity = read("frontend/src/components/customer/DiscoverBrandIdentity.tsx");
  const handoff = read("frontend/src/components/customer/about/AboutStorefrontHandoff.tsx");
  const styles = read("frontend/src/styles/brand.css");

  assert.match(brandMark, /<Store className="ysabelle-brand-mark__fallback" \/>/);
  assert.match(discoverIdentity, /YsabelleBrandMark/);
  assert.match(handoff, /<YsabelleBrandMark variant="mini" \/>/);
  assert.match(styles, /\.ysabelle-brand-mark__fallback/);
  assert.match(styles, /\.ysabelle-brand-mark__image\[hidden\]/);
});

test("Electron uses canonical runtime PNG and generated packaged Windows ICO", () => {
  const builder = read("electron/electron-builder.config.cjs");
  const windowSource = read("electron/src/main/window.ts");
  const paths = read("electron/src/config/paths.ts");

  assert.match(builder, /icon:\s*"build\/icon\.ico"/);
  assert.match(windowSource, /icon:\s*getApplicationIconPath\(app\.isPackaged\)/);
  assert.match(paths, /export function getApplicationIconPath\(isPackaged:\s*boolean\)/);
  assert.match(paths, /frontend",\s*"brand",\s*"favicon-48x48\.png"/);
  assert.match(paths, /frontend\/public\/brand\/favicon-48x48\.png/);
});
