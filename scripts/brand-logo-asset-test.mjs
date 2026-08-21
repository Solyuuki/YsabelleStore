import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const assetPath = path.join(root, "frontend/src/assets/brand/ysabelle-logo-official.webp");
const componentPath = path.join(root, "frontend/src/components/brand/BrandLogo.tsx");
const cssPath = path.join(root, "frontend/src/styles/brand.css");
const expectedSha256 = "b62e9d932778a4c3f4d1fe1651fa0638380a7ad6d86800a46a80448965b4085c";

assert.equal(existsSync(assetPath), true, "Official bundled Ysabelle logo asset must exist.");

const component = readFileSync(componentPath, "utf8");
const css = readFileSync(cssPath, "utf8");
const asset = readFileSync(assetPath);

assert.match(
  component,
  /import officialLogoUrl from ["']@\/assets\/brand\/ysabelle-logo-official\.webp["'];/
);
assert.doesNotMatch(component, /\/brand\/ysabelle-logo-v2\.png/);
assert.match(css, /url\(["']\.\.\/assets\/brand\/ysabelle-logo-official\.webp["']\)/);
assert.doesNotMatch(css, /\/brand\/ysabelle-logo-v2\.png/);

const digest = createHash("sha256").update(asset).digest("hex");
assert.equal(digest, expectedSha256, "Bundled logo must match the approved official Ysabelle logo asset.");

console.log("Official Ysabelle brand asset checks passed.");
