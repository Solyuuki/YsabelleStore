import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandRoot = join(repoRoot, "frontend", "public", "brand");
const cacheVersion = "a4f0dde2";

const assets = new Map([
  ["ysabelle-store-mark.png", { width: 256, height: 256 }],
  ["ysabelle-store-logo.png", { width: 256, height: 256 }],
  [
    "ysabelle-store-mark-128.png",
    {
      width: 128,
      height: 128,
      sha256: "52d25c66d9c85c5255c80f4b2026cb1ffc7bc7403512b5770af1b95ca0ba35a1"
    }
  ],
  ["ysabelle-store-mark-256.png", { width: 256, height: 256 }],
  [
    "favicon-16x16.png",
    {
      width: 16,
      height: 16,
      sha256: "fd3e3895cebf188aeb32083ae7ad4fbb4d205ca39cb5146c5a0e47ff2bc9c62b"
    }
  ],
  [
    "favicon-32x32.png",
    {
      width: 32,
      height: 32,
      sha256: "4e5a6d4cf974dccc9efcbaed8f6ec136dae78c64a199ba1f6462fda3ee7b6075"
    }
  ],
  [
    "favicon-48x48.png",
    {
      width: 48,
      height: 48,
      sha256: "28c1dc17bcabc807e4ee90819108976089fe74ecc4b07a77ded872dc0ac9494d"
    }
  ],
  [
    "apple-touch-icon.png",
    {
      width: 180,
      height: 180,
      sha256: "b0dbbeb356ba0e67db545d3ebd75e0059053f3e9421764a4ac354d8cd2fbee03"
    }
  ]
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

test("ships approved textless Ysabelle mark exports", async () => {
  const canonicalNames = [
    "ysabelle-store-mark.png",
    "ysabelle-store-logo.png",
    "ysabelle-store-mark-256.png"
  ];
  let canonicalDigest;

  for (const [name, expected] of assets) {
    const asset = await readFile(join(brandRoot, name));
    assert.deepEqual(readPngInfo(asset), { width: expected.width, height: expected.height });
    assert.ok(asset.length > 500, `${name} must not be empty or a placeholder`);

    const digest = sha256(asset);
    if (expected.sha256) {
      assert.equal(digest, expected.sha256, `${name} must match the approved export`);
    }
    if (canonicalNames.includes(name)) {
      canonicalDigest ??= digest;
      assert.equal(digest, canonicalDigest, `${name} must match the canonical approved mark`);
    }
  }
});

test("ships a multi-size ICO fallback", async () => {
  const ico = await readFile(join(brandRoot, "favicon.ico"));
  assert.deepEqual([...ico.subarray(0, 4)], [0, 0, 1, 0]);
  assert.equal(ico.readUInt16LE(4), 3);
  assert.equal(sha256(ico), "17ae4aa152fd357b726ddfbe579b8516720858d318ec4cb918d35ccbdb614b4c");
});

test("uses a real responsive image with a visible error fallback", async () => {
  const component = await readText("frontend/src/components/customer/YsabelleBrandMark.tsx");
  assert.match(component, /<img/);
  assert.match(component, /srcSet=\{BRAND_MARK_SRC_SET\}/);
  assert.match(component, /event\.currentTarget\.hidden = true/);
  assert.match(component, /ysabelle-brand-mark__fallback/);
  assert.match(component, new RegExp(cacheVersion));
});

test("header and footer use the shared mark instead of a generic Store logo", async () => {
  for (const path of [
    "frontend/src/components/customer/CustomerHeader.tsx",
    "frontend/src/components/customer/CustomerFooter.tsx"
  ]) {
    const source = await readText(path);
    assert.match(source, /YsabelleBrandMark/);
    assert.doesNotMatch(source, /customer-brand__mark/);
    assert.doesNotMatch(source, /\bStore\b[^\n]*from "lucide-react"/);
  }
});

test("legacy Discover slots cannot collapse into blank white circles", async () => {
  const css = await readText("frontend/src/styles/brand.css");
  assert.match(css, /\.story-welcome__mark::after/);
  assert.match(css, /\.story-live-store__bar > span:first-child::before/);
  assert.match(css, /--ysabelle-brand-fallback: linear-gradient/);
  assert.doesNotMatch(css, /\.story-welcome__mark[^{]*\{[^}]*background:\s*#fff/s);
  assert.match(css, /\.story-welcome__mark > svg/);
  assert.match(css, /\.story-live-store__bar > span:first-child > svg/);
  assert.match(
    css,
    /\.ysabelle-brand-mark__image\[hidden\]\s*\{[^}]*display:\s*none/s
  );
  assert.match(
    css,
    /\.story-live-store__bar > span:first-child::before\s*\{[^}]*display:\s*block/s
  );
});

test("uses explicit cache-busted favicon and preload paths", async () => {
  const html = await readText("frontend/index.html");
  assert.match(html, new RegExp(`/brand/favicon\\.ico\\?v=${cacheVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-16x16\\.png\\?v=${cacheVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-32x32\\.png\\?v=${cacheVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-48x48\\.png\\?v=${cacheVersion}`));
  assert.match(html, new RegExp(`/brand/apple-touch-icon\\.png\\?v=${cacheVersion}`));
  assert.match(html, new RegExp(`/brand/ysabelle-store-mark-256\\.png\\?v=${cacheVersion}`));
  assert.match(html, /<title>Ysabelle Store<\/title>/);
});

test("brand CSS loads after customer CSS", async () => {
  const customerApp = await readText("frontend/src/app/CustomerApp.tsx");
  assert.ok(
    customerApp.indexOf('import "@/styles/brand.css";') >
      customerApp.indexOf('import "@/styles/customer.css";')
  );
});

test("Electron uses the canonical approved mark", async () => {
  const paths = await readText("electron/src/config/paths.ts");
  const windowSource = await readText("electron/src/main/window.ts");
  assert.match(paths, /ysabelle-store-mark\.png/);
  assert.match(windowSource, /icon: getApplicationIconPath/);
});

test("documents approved-artwork provenance and no-white fallback rule", async () => {
  const readme = await readText("frontend/public/brand/README.md");
  assert.match(readme, /approved source artwork/i);
  assert.match(readme, /No new artwork is generated/i);
  assert.match(readme, /must never produce a blank white circle/i);
});
