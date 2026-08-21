import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandRoot = join(repoRoot, "frontend", "public", "brand");
const assetVersion = "a4f0dde2";
const faviconVersion = "approved-a4f0dde2";

const assets = new Map([
  ["ysabelle-store-mark.png", { width: 256, height: 256 }],
  ["ysabelle-store-logo.png", { width: 256, height: 256 }],
  ["ysabelle-store-mark-128.png", { width: 128, height: 128 }],
  ["ysabelle-store-mark-256.png", { width: 256, height: 256 }],
  ["apple-touch-icon.png", { width: 180, height: 180 }]
]);

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function readPngInfo(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.subarray(0, 8).equals(signature), "asset must be a valid PNG");
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", "PNG must start with IHDR");
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function readText(relativePath) {
  return readFile(join(repoRoot, relativePath), "utf8");
}

test("ships the approved Ysabelle brand mark exports", async () => {
  let canonicalDigest;

  for (const [name, expected] of assets) {
    const asset = await readFile(join(brandRoot, name));
    assert.deepEqual(readPngInfo(asset), expected);
    assert.ok(asset.length > 500, `${name} must not be empty or a placeholder`);

    if (["ysabelle-store-mark.png", "ysabelle-store-logo.png", "ysabelle-store-mark-256.png"].includes(name)) {
      const digest = sha256(asset);
      canonicalDigest ??= digest;
      assert.equal(digest, canonicalDigest, `${name} must match the approved canonical mark`);
    }
  }
});

test("uses a real responsive image with a visible error fallback", async () => {
  const component = await readText("frontend/src/components/customer/YsabelleBrandMark.tsx");
  assert.match(component, /<img/);
  assert.match(component, /srcSet=\{BRAND_MARK_SRC_SET\}/);
  assert.match(component, /event\.currentTarget\.hidden = true/);
  assert.match(component, /ysabelle-brand-mark__fallback/);
  assert.match(component, new RegExp(assetVersion));
});

test("keeps the already-approved header and footer on the shared mark", async () => {
  for (const path of [
    "frontend/src/components/customer/CustomerHeader.tsx",
    "frontend/src/components/customer/CustomerFooter.tsx"
  ]) {
    const source = await readText(path);
    assert.match(source, /YsabelleBrandMark/);
    assert.doesNotMatch(source, /customer-brand__mark/);
  }
});

test("renders the approved mark in both remaining Discover brand slots", async () => {
  const bridge = await readText("frontend/src/components/customer/DiscoverBrandIdentity.tsx");
  const layout = await readText("frontend/src/layouts/CustomerLayout.tsx");
  const css = await readText("frontend/src/styles/brand.css");

  assert.match(bridge, /createPortal\(<YsabelleBrandMark eager variant="display"/);
  assert.match(bridge, /createPortal\(<YsabelleBrandMark variant="mini"/);
  assert.match(bridge, /\.story-welcome__mark/);
  assert.match(bridge, /\.story-live-store__bar > span:first-child/);
  assert.match(layout, /<DiscoverBrandIdentity pathname=\{pathname\} \/>/);
  assert.match(css, /\.story-welcome__mark--branded > svg/);
  assert.match(css, /\.story-live-store__identity--branded > svg/);
  assert.doesNotMatch(css, /story-welcome__mark::after/);
  assert.doesNotMatch(css, /story-live-store__bar > span:first-child::before/);
});

test("uses the approved full mark as the only browser favicon", async () => {
  const html = await readText("frontend/index.html");

  assert.match(
    html,
    new RegExp(`/brand/ysabelle-store-mark\\.png\\?v=${faviconVersion}`)
  );
  assert.doesNotMatch(html, /favicon-16x16\.png/);
  assert.doesNotMatch(html, /favicon-32x32\.png/);
  assert.doesNotMatch(html, /favicon\.ico/);
  assert.match(html, /<title>Ysabelle Store<\/title>/);
});

test("uses the approved mark for Electron runtime and Windows packaging", async () => {
  const paths = await readText("electron/src/config/paths.ts");
  const windowSource = await readText("electron/src/main/window.ts");
  const builder = await readText("electron/electron-builder.config.cjs");

  assert.match(paths, /ysabelle-store-mark\.png/);
  assert.match(windowSource, /icon: getApplicationIconPath\(app\.isPackaged\)/);
  assert.match(builder, /icon:\s*"\.\.\/frontend\/public\/brand\/ysabelle-store-mark\.png"/);
});

test("brand CSS loads after the customer stylesheet", async () => {
  const customerApp = await readText("frontend/src/app/CustomerApp.tsx");
  assert.ok(
    customerApp.indexOf('import "@/styles/brand.css";') >
      customerApp.indexOf('import "@/styles/customer.css";')
  );
});
