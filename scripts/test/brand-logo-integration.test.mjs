import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("web shell declares the Ysabelle favicon and touch icon", () => {
  const html = read("frontend/index.html");

  assert.match(html, /rel="icon"[^>]+href="\/brand\/favicon-32\.png"/);
  assert.match(html, /rel="apple-touch-icon"[^>]+href="\/brand\/apple-touch-icon\.png"/);
  assert.match(html, /<title>Ysabelle Store<\/title>/);
});

test("customer and staff brand marks use the canonical logo asset at readable sizes", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const footer = read("frontend/src/components/customer/CustomerFooter.tsx");
  const sidebar = read("frontend/src/components/app/AppSidebar.tsx");
  const styles = read("frontend/src/styles/brand.css");

  assert.match(app, /import "@\/styles\/brand\.css";/);
  assert.match(header, /src="\/brand\/ysabelle-logo\.png"/);
  assert.match(footer, /src="\/brand\/ysabelle-logo\.png"/);
  assert.match(sidebar, /src="\/brand\/ysabelle-logo\.png"/);
  assert.doesNotMatch(header, /<Store aria-hidden="true" size=\{22\}/);
  assert.doesNotMatch(footer, /<Store aria-hidden="true" size=\{22\}/);
  assert.doesNotMatch(sidebar, />\s*YS\s*</);
  assert.match(styles, /\.customer-brand__logo[\s\S]*?width:\s*3\.1rem/);
});

test("Electron uses explicit runtime and packaged Windows icons", () => {
  const builder = read("electron/electron-builder.config.cjs");
  const windowSource = read("electron/src/main/window.ts");
  const paths = read("electron/src/config/paths.ts");

  assert.match(builder, /icon:\s*"build\/icon\.ico"/);
  assert.match(windowSource, /icon:\s*getWindowIconPath\(app\.isPackaged\)/);
  assert.match(paths, /export function getWindowIconPath\(packaged:\s*boolean\)/);
  assert.match(paths, /frontend",\s*"brand",\s*"ysabelle-logo\.png"/);
  assert.match(paths, /frontend\/public\/brand\/ysabelle-logo\.png/);
});
