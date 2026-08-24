import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandRoot = join(repoRoot, "frontend", "public", "brand");
const faviconVersion = "fullmark-2e25e00f";

const assets = new Map([
  ["ysabelle-store-mark.png", { width: 256, height: 256 }],
  ["ysabelle-store-logo.png", { width: 256, height: 256 }],
  ["ysabelle-store-mark-128.png", { width: 128, height: 128 }],
  ["ysabelle-store-mark-256.png", { width: 256, height: 256 }],
  ["apple-touch-icon.png", { width: 180, height: 180 }],
  [
    "favicon-16x16.png",
    {
      width: 16,
      height: 16,
      sha256: "8dfca68ace9f8ab35f98c8d0fc1d7ddee2d293213391452762948eddff9106c6"
    }
  ],
  [
    "favicon-32x32.png",
    {
      width: 32,
      height: 32,
      sha256: "a8581b880e36f17bfc92d0af631263d28ae9797dfee7cab554775f6056657fee"
    }
  ],
  [
    "favicon-48x48.png",
    {
      width: 48,
      height: 48,
      sha256: "6ad17f910db9a2a31bee671d53d325c02fe1f736fa0f39baa448fe07795dbf88"
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
function readIcoFrames(buffer) {
  assert.ok(buffer.length >= 6, "ICO must contain a complete header");
  assert.equal(buffer.readUInt16LE(0), 0);
  assert.equal(buffer.readUInt16LE(2), 1);
  const count = buffer.readUInt16LE(4);
  const directoryEnd = 6 + count * 16;
  assert.ok(count > 0 && buffer.length >= directoryEnd);
  const frames = [];
  for (let i = 0; i < count; i += 1) {
    const e = 6 + i * 16;
    const width = buffer[e] === 0 ? 256 : buffer[e];
    const height = buffer[e + 1] === 0 ? 256 : buffer[e + 1];
    const dataSize = buffer.readUInt32LE(e + 8);
    const dataOffset = buffer.readUInt32LE(e + 12);
    assert.ok(dataSize > 0 && dataOffset >= directoryEnd && dataOffset + dataSize <= buffer.length);
    frames.push({ width, height, data: buffer.subarray(dataOffset, dataOffset + dataSize) });
  }
  return frames;
}
async function readText(relativePath) {
  return readFile(join(repoRoot, relativePath), "utf8");
}

test("ships the approved Ysabelle brand mark and full-logo favicon exports", async () => {
  let canonicalDigest;
  for (const [name, expected] of assets) {
    const asset = await readFile(join(brandRoot, name));
    assert.deepEqual(readPngInfo(asset), { width: expected.width, height: expected.height });
    assert.ok(asset.length > 100);
    const digest = sha256(asset);
    if (expected.sha256) assert.equal(digest, expected.sha256);
    if (
      [
        "ysabelle-store-mark.png",
        "ysabelle-store-logo.png",
        "ysabelle-store-mark-256.png"
      ].includes(name)
    ) {
      canonicalDigest ??= digest;
      assert.equal(digest, canonicalDigest);
    }
  }
});

test("browser favicon uses full-logo 16, 32, and 48 px frames", async () => {
  const ico = await readFile(join(brandRoot, "favicon.ico"));
  const frames = readIcoFrames(ico);
  assert.deepEqual(
    frames.map((f) => `${f.width}x${f.height}`),
    ["16x16", "32x32", "48x48"]
  );
  assert.equal(sha256(ico), "492eb9e198fb7cc3038293c96ea24898fc1427f10d0873eea08444981bdd0a67");
  const html = await readText("frontend/index.html");
  assert.match(html, new RegExp(`/brand/favicon\\.ico\\?v=${faviconVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-16x16\\.png\\?v=${faviconVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-32x32\\.png\\?v=${faviconVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-48x48\\.png\\?v=${faviconVersion}`));
  assert.doesNotMatch(html, /sizes="256x256"/);
});

test("uses exact approved public mark in web and bundled mark only for Electron file protocol", async () => {
  const customerMark = await readText("frontend/src/components/customer/YsabelleBrandMark.tsx");
  const staffMark = await readText("frontend/src/components/brand/BrandLogo.tsx");

  for (const source of [customerMark, staffMark]) {
    assert.match(source, /import officialLogoUrl from "@\/assets\/brand\/ysabelle-logo-official\.webp";/);
    assert.match(source, /\/brand\/ysabelle-store-mark-256\.png\?v=fullmark-2e25e00f/);
    assert.match(source, /window\.location\.protocol === "file:"/);
    assert.match(source, /officialLogoUrl/);
  }

  assert.match(customerMark, /ysabelle-store-mark-128\.png\?v=fullmark-2e25e00f 128w/);
  assert.match(customerMark, /ysabelle-store-mark-256\.png\?v=fullmark-2e25e00f 256w/);
  assert.match(customerMark, /event\.currentTarget\.hidden = true/);
  assert.match(customerMark, /<Store className="ysabelle-brand-mark__fallback" \/>/);
});

test("keeps approved header and footer on shared mark", async () => {
  for (const p of [
    "frontend/src/components/customer/CustomerHeader.tsx",
    "frontend/src/components/customer/CustomerFooter.tsx"
  ]) {
    const s = await readText(p);
    assert.match(s, /YsabelleBrandMark/);
    assert.doesNotMatch(s, /customer-brand__mark/);
  }
});

test("renders the approved mark in both Discover brand slots", async () => {
  const bridge = await readText("frontend/src/components/customer/DiscoverBrandIdentity.tsx");
  const layout = await readText("frontend/src/layouts/CustomerLayout.tsx");
  const css = await readText("frontend/src/styles/brand.css");
  assert.match(bridge, /createPortal\(<YsabelleBrandMark eager variant="display"/);
  assert.match(bridge, /createPortal\(<YsabelleBrandMark variant="mini"/);
  assert.match(layout, /<DiscoverBrandIdentity pathname=\{pathname\} \/>/);
  assert.match(css, /\.story-welcome__mark--branded > svg/);
  assert.match(css, /\.story-live-store__identity--branded > svg/);
});

test("Windows Electron icon generator builds a bounded multi-resolution ICO without re-encoding artwork", async () => {
  const generatorPath = join(repoRoot, "electron", "scripts", "prepare-windows-icon.mjs");
  const { buildWindowsIco } = await import(pathToFileURL(generatorPath).href);
  const specs = [
    [16, "favicon-16x16.png"],
    [32, "favicon-32x32.png"],
    [48, "favicon-48x48.png"],
    [256, "ysabelle-store-mark.png"]
  ];
  const sources = [];
  for (const [size, name] of specs)
    sources.push({ size, name, png: await readFile(join(brandRoot, name)) });
  const frames = readIcoFrames(buildWindowsIco(sources));
  assert.deepEqual(
    frames.map((f) => `${f.width}x${f.height}`),
    ["16x16", "32x32", "48x48", "256x256"]
  );
  frames.forEach((f, i) => assert.ok(f.data.equals(sources[i].png)));
});

test("Windows packaging uses generated ICO while runtime uses approved PNG", async () => {
  const packageJson = JSON.parse(await readText("electron/package.json"));
  const paths = await readText("electron/src/config/paths.ts");
  const windowSource = await readText("electron/src/main/window.ts");
  const builder = await readText("electron/electron-builder.config.cjs");
  assert.match(packageJson.scripts.dev, /^node scripts\/prepare-windows-icon\.mjs && /);
  assert.match(packageJson.scripts.package, /^node scripts\/prepare-windows-icon\.mjs && /);
  assert.match(builder, /electronVersion:\s*"42\.8\.1"/);
  assert.match(builder, /icon:\s*"build\/icon\.ico"/);
  assert.doesNotMatch(builder, /app-icon\.ico/);
  assert.match(paths, /favicon-48x48\.png/);
  assert.doesNotMatch(paths, /app-icon\.ico/);
  assert.match(windowSource, /nativeImage\.createFromPath/);
  assert.match(windowSource, /applicationIcon\.isEmpty\(\) \? \{\} : \{ icon: applicationIcon \}/);
  assert.doesNotMatch(windowSource, /appIconPath:/);
});

test("brand CSS loads after the customer stylesheet", async () => {
  const customerApp = await readText("frontend/src/app/CustomerApp.tsx");
  assert.ok(
    customerApp.indexOf('import "@/styles/brand.css";') >
      customerApp.indexOf('import "@/styles/customer.css";')
  );
});
