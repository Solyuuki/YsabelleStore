import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const brandRoot = join(repoRoot, "frontend", "public", "brand");
const assetVersion = "a4f0dde2";
const faviconVersion = "fullmark-2e25e00f";

const assets = new Map([
  ["ysabelle-store-mark.png", { width: 256, height: 256 }],
  ["ysabelle-store-logo.png", { width: 256, height: 256 }],
  ["ysabelle-store-mark-128.png", { width: 128, height: 128 }],
  ["ysabelle-store-mark-256.png", { width: 256, height: 256 }],
  ["apple-touch-icon.png", { width: 180, height: 180 }],
  ["favicon-16x16.png", { width: 16, height: 16, sha256: "8dfca68ace9f8ab35f98c8d0fc1d7ddee2d293213391452762948eddff9106c6" }],
  ["favicon-32x32.png", { width: 32, height: 32, sha256: "a8581b880e36f17bfc92d0af631263d28ae9797dfee7cab554775f6056657fee" }],
  ["favicon-48x48.png", { width: 48, height: 48, sha256: "6ad17f910db9a2a31bee671d53d325c02fe1f736fa0f39baa448fe07795dbf88" }]
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
  assert.equal(buffer.readUInt16LE(0), 0, "ICO reserved field must be zero");
  assert.equal(buffer.readUInt16LE(2), 1, "ICO type must be icon");

  const count = buffer.readUInt16LE(4);
  const directoryEnd = 6 + count * 16;
  assert.ok(count > 0, "ICO must contain at least one frame");
  assert.ok(buffer.length >= directoryEnd, "ICO directory must fit inside the file");

  const frames = [];
  for (let index = 0; index < count; index += 1) {
    const entryOffset = 6 + index * 16;
    const width = buffer[entryOffset] === 0 ? 256 : buffer[entryOffset];
    const height = buffer[entryOffset + 1] === 0 ? 256 : buffer[entryOffset + 1];
    const dataSize = buffer.readUInt32LE(entryOffset + 8);
    const dataOffset = buffer.readUInt32LE(entryOffset + 12);

    assert.ok(dataSize > 0, `ICO frame ${index} must contain image data`);
    assert.ok(dataOffset >= directoryEnd, `ICO frame ${index} data must follow the directory`);
    assert.ok(
      dataOffset + dataSize <= buffer.length,
      `ICO frame ${index} data must fit inside the file`
    );

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
    assert.ok(asset.length > 100, `${name} must not be empty or a placeholder`);
    const digest = sha256(asset);
    if (expected.sha256) assert.equal(digest, expected.sha256, `${name} must match the approved full-logo export`);
    if (["ysabelle-store-mark.png", "ysabelle-store-logo.png", "ysabelle-store-mark-256.png"].includes(name)) {
      canonicalDigest ??= digest;
      assert.equal(digest, canonicalDigest, `${name} must match the approved canonical mark`);
    }
  }
});

test("browser favicon uses full-logo 16, 32, and 48 px frames", async () => {
  const ico = await readFile(join(brandRoot, "favicon.ico"));
  const frames = readIcoFrames(ico);
  assert.deepEqual(frames.map((frame) => `${frame.width}x${frame.height}`), ["16x16", "32x32", "48x48"]);
  assert.equal(sha256(ico), "492eb9e198fb7cc3038293c96ea24898fc1427f10d0873eea08444981bdd0a67");
  const html = await readText("frontend/index.html");
  assert.match(html, new RegExp(`/brand/favicon\\.ico\\?v=${faviconVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-16x16\\.png\\?v=${faviconVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-32x32\\.png\\?v=${faviconVersion}`));
  assert.match(html, new RegExp(`/brand/favicon-48x48\\.png\\?v=${faviconVersion}`));
  assert.doesNotMatch(html, /sizes="256x256"/);
  assert.match(html, /<title>Ysabelle Store<\/title>/);
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
  for (const path of ["frontend/src/components/customer/CustomerHeader.tsx", "frontend/src/components/customer/CustomerFooter.tsx"]) {
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
  assert.match(layout, /<DiscoverBrandIdentity pathname=\{pathname\} \/>/);
  assert.match(css, /\.story-welcome__mark--branded > svg/);
  assert.match(css, /\.story-live-store__identity--branded > svg/);
  assert.doesNotMatch(css, /story-welcome__mark::after/);
  assert.doesNotMatch(css, /story-live-store__bar > span:first-child::before/);
});

test("Windows Electron icon generator builds a bounded multi-resolution ICO without re-encoding artwork", async () => {
  const generatorPath = join(repoRoot, "electron", "scripts", "prepare-windows-icon.mjs");
  const { buildWindowsIco } = await import(pathToFileURL(generatorPath).href);
  const frameSpecs = [[16, "favicon-16x16.png"], [32, "favicon-32x32.png"], [48, "favicon-48x48.png"], [256, "ysabelle-store-mark.png"]];
  const sources = [];
  for (const [size, name] of frameSpecs) {
    sources.push({ size, name, png: await readFile(join(brandRoot, name)) });
  }
  const ico = buildWindowsIco(sources);
  const frames = readIcoFrames(ico);
  assert.deepEqual(frames.map((frame) => `${frame.width}x${frame.height}`), ["16x16", "32x32", "48x48", "256x256"]);
  frames.forEach((frame, index) => {
    assert.ok(frame.data.equals(sources[index].png), `${frame.width}x${frame.height} frame must embed the approved PNG bytes unchanged`);
  });
});

test("Windows Electron dev and packaging prepare and use the generated ICO", async () => {
  const packageJson = JSON.parse(await readText("electron/package.json"));
  const paths = await readText("electron/src/config/paths.ts");
  const windowSource = await readText("electron/src/main/window.ts");
  const builder = await readText("electron/electron-builder.config.cjs");
  assert.match(packageJson.scripts.dev, /^node scripts\/prepare-windows-icon\.mjs && /);
  assert.match(packageJson.scripts.package, /^node scripts\/prepare-windows-icon\.mjs && /);
  assert.match(builder, /electronVersion:\s*"42\.8\.1"/);
  assert.match(builder, /icon:\s*"build\/icon\.ico"/);
  assert.match(builder, /from:\s*"build\/icon\.ico"[\s\S]*to:\s*"app-icon\.ico"/);
  assert.match(paths, /app-icon\.ico/);
  assert.match(paths, /\.\.\/\.\.\/build\/icon\.ico/);
  assert.match(windowSource, /nativeImage\.createFromPath/);
  assert.match(windowSource, /mainWindow\.setIcon/);
  assert.match(windowSource, /mainWindow\.setAppDetails/);
});

test("brand CSS loads after the customer stylesheet", async () => {
  const customerApp = await readText("frontend/src/app/CustomerApp.tsx");
  assert.ok(customerApp.indexOf('import "@/styles/brand.css";') > customerApp.indexOf('import "@/styles/customer.css";'));
});
