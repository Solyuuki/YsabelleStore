import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandRoot = join(repoRoot, "frontend", "public", "brand");
const cacheVersion = "20260821";

const assets = new Map([
  [
    join(brandRoot, "ysabelle-store-logo.png"),
    {
      width: 112,
      height: 112,
      sha256: "fe154b85dbe4bbbfa900c12881c8fd5861a0b3da0325b9bb01f09a567ed37b8f"
    }
  ],
  [
    join(brandRoot, "ysabelle-store-mark.png"),
    {
      width: 88,
      height: 88,
      sha256: "32312841bb91a72d8f02a176c88de0f8b0cd297c9e7e0444a6a002bbcef540d1"
    }
  ],
  [
    join(brandRoot, "favicon-16x16.png"),
    {
      width: 16,
      height: 16,
      sha256: "fbf91a7e9016809ccae2215ed98de601c572c90762a84ba611a80014bd4aa930"
    }
  ],
  [
    join(brandRoot, "favicon-32x32.png"),
    {
      width: 32,
      height: 32,
      sha256: "a882e7be1c8f10844485f39369cd98de3cd2b056341b55280441618f1298f9d5"
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

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

async function readText(relativePath) {
  return readFile(join(repoRoot, relativePath), "utf8");
}

test("ships the approved non-blank Ysabelle Store web exports", async () => {
  for (const [assetPath, expected] of assets) {
    const asset = await readFile(assetPath);
    assert.deepEqual(readPngInfo(asset), {
      width: expected.width,
      height: expected.height
    });
    assert.equal(sha256(asset), expected.sha256);
    assert.ok(asset.length > 500, `${assetPath} must not be empty or a placeholder`);
  }
});

test("uses explicit cache-busted browser favicon and brand paths", async () => {
  const indexHtml = await readText("frontend/index.html");
  const brandCss = await readText("frontend/src/styles/brand.css");
  const customerApp = await readText("frontend/src/app/CustomerApp.tsx");

  assert.match(indexHtml, /<title>Ysabelle Store<\/title>/);
  assert.match(indexHtml, new RegExp(`/brand/favicon-32x32\\.png\\?v=${cacheVersion}`));
  assert.match(indexHtml, new RegExp(`/brand/favicon-16x16\\.png\\?v=${cacheVersion}`));
  assert.doesNotMatch(indexHtml, /favicon\.ico/);
  assert.match(brandCss, new RegExp(`/brand/ysabelle-store-mark\\.png\\?v=${cacheVersion}`));
  assert.match(brandCss, new RegExp(`/brand/ysabelle-store-logo\\.png\\?v=${cacheVersion}`));

  const customerCssImport = customerApp.indexOf('import "@/styles/customer.css";');
  const brandCssImport = customerApp.indexOf('import "@/styles/brand.css";');
  assert.ok(customerCssImport >= 0, "customer.css must remain imported");
  assert.ok(brandCssImport > customerCssImport, "brand.css must load after customer.css");
});

test("retains the existing Store icons as a non-blank fallback", async () => {
  const brandCss = await readText("frontend/src/styles/brand.css");

  assert.match(brandCss, /\.customer-brand__mark::after/);
  assert.match(brandCss, /\.story-welcome__mark::after/);
  assert.match(brandCss, /\.customer-brand__mark > svg/);
  assert.match(brandCss, /\.story-welcome__mark > svg/);
  assert.doesNotMatch(
    brandCss,
    /(?:customer-brand__mark|story-welcome__mark)[^{]*\{[^}]*display:\s*none/s
  );
});

test("uses the compact official mark for Electron development and packaged windows", async () => {
  const paths = await readText("electron/src/config/paths.ts");
  const windowSource = await readText("electron/src/main/window.ts");

  assert.match(paths, /export function getApplicationIconPath\(isPackaged: boolean\)/);
  assert.match(paths, /frontend", "brand", "ysabelle-store-mark\.png/);
  assert.match(paths, /frontend\/public\/brand\/ysabelle-store-mark\.png/);
  assert.match(windowSource, /icon: getApplicationIconPath\(app\.isPackaged\)/);
});

test("records the supplied master artwork provenance", async () => {
  const readme = await readText("frontend/public/brand/README.md");

  assert.match(
    readme,
    /f2ee9b4fb0184df39eabcbef116a70cc74db3100c9910a448e5e74b5df7e0be3/
  );
  assert.match(readme, /no artwork was redrawn or generated/i);
  assert.match(readme, /Do not replace these files with generated approximations/);
});
