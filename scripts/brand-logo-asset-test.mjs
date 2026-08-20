import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const assetPath = path.join(root, "frontend/src/assets/brand/ysabelle-logo-official.svg");
const componentPath = path.join(root, "frontend/src/components/brand/BrandLogo.tsx");
const cssPath = path.join(root, "frontend/src/styles/brand.css");
const expectedSha256 = "f2ee9b4fb0184df39eabcbef116a70cc74db3100c9910a448e5e74b5df7e0be3";

assert.equal(existsSync(assetPath), true, "Official bundled Ysabelle logo asset must exist.");

const component = readFileSync(componentPath, "utf8");
const css = readFileSync(cssPath, "utf8");
const asset = readFileSync(assetPath, "utf8");

assert.match(
  component,
  /import officialLogoUrl from ["']@\/assets\/brand\/ysabelle-logo-official\.svg["'];/
);
assert.doesNotMatch(component, /\/brand\/ysabelle-logo-v2\.png/);
assert.match(css, /url\(["']\.\.\/assets\/brand\/ysabelle-logo-official\.svg["']\)/);
assert.doesNotMatch(css, /\/brand\/ysabelle-logo-v2\.png/);

const embeddedPng = asset.match(/href="data:image\/png;base64,([^"]+)"/);
assert.ok(embeddedPng, "Official SVG wrapper must embed the uploaded PNG.");
const digest = createHash("sha256").update(Buffer.from(embeddedPng[1], "base64")).digest("hex");
assert.equal(
  digest,
  expectedSha256,
  "Bundled logo must exactly match the uploaded official logo bytes."
);

console.log("Official Ysabelle brand asset checks passed.");
