import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("web shell uses cache-safe Ysabelle favicon and touch icon assets", () => {
  const html = read("frontend/index.html");

  assert.match(html, /rel="icon"[^>]+href="\/brand\/favicon-v2-32\.png"/);
  assert.match(html, /rel="apple-touch-icon"[^>]+href="\/brand\/apple-touch-icon-v2\.png"/);
  assert.match(html, /<title>Ysabelle Store<\/title>/);
});

test("customer and staff brand marks use the cache-safe canonical logo at readable sizes", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const footer = read("frontend/src/components/customer/CustomerFooter.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const styles = read("frontend/src/styles/brand.css");

  assert.match(app, /import "@\/styles\/brand\.css";/);
  assert.match(header, /src="\/brand\/ysabelle-logo-v2\.png"/);
  assert.match(footer, /src="\/brand\/ysabelle-logo-v2\.png"/);
  assert.match(sidebar, /src="\/brand\/ysabelle-logo-v2\.png"/);
  assert.doesNotMatch(sidebar, />\s*YS\s*</);
  assert.match(styles, /--ys-brand-logo:\s*url\("\/brand\/ysabelle-logo-v2\.png"\)/);
  assert.match(styles, /\.customer-brand__mark[\s\S]*?width:\s*3\.4rem/);
  assert.match(styles, /\.customer-brand__logo[\s\S]*?width:\s*100%/);
  assert.match(styles, /\.customer-brand__logo[\s\S]*?height:\s*100%/);
});

test("About story branding replaces decorative store glyphs with the real Ysabelle logo", () => {
  const styles = read("frontend/src/styles/brand.css");

  assert.match(styles, /\.story-welcome__mark > svg[\s\S]*?display:\s*none/);
  assert.match(styles, /\.story-welcome__mark::before[\s\S]*?background-image:\s*var\(--ys-brand-logo\)/);
  assert.match(
    styles,
    /\.story-live-store__bar > span:first-child > svg:first-child[\s\S]*?display:\s*none/
  );
  assert.match(
    styles,
    /\.story-live-store__bar > span:first-child::before[\s\S]*?background-image:\s*var\(--ys-brand-logo\)/
  );
});

test("Electron uses cache-safe runtime and packaged Windows icons", () => {
  const builder = read("electron/electron-builder.config.cjs");
  const windowSource = read("electron/src/main/window.ts");
  const paths = read("electron/src/config/paths.ts");

  assert.match(builder, /icon:\s*"build\/icon-v2\.ico"/);
  assert.match(windowSource, /icon:\s*getWindowIconPath\(app\.isPackaged\)/);
  assert.match(paths, /export function getWindowIconPath\(packaged:\s*boolean\)/);
  assert.match(paths, /frontend",\s*"brand",\s*"ysabelle-logo-v2\.png"/);
  assert.match(paths, /frontend\/public\/brand\/ysabelle-logo-v2\.png/);
});
