import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const assetPath = resolve(
  process.cwd(),
  "public/images/home/storefront-merchandising-background.webp"
);
const nextStepAssetPath = resolve(
  process.cwd(),
  "public/images/home/home-next-step-background.avif"
);
const cssPath = resolve(process.cwd(), "src/styles/customer-home-premium.css");
const homePath = resolve(process.cwd(), "src/pages/customer/CustomerHomePage.tsx");

const asset = readFileSync(assetPath);
const nextStepAsset = readFileSync(nextStepAssetPath);
const css = readFileSync(cssPath, "utf8");
const home = readFileSync(homePath, "utf8");

assert.ok(asset.length > 1024, "Merchandising backdrop is unexpectedly small.");
assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF");
assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP");
assert.equal(
  asset.readUInt32LE(4) + 8,
  asset.length,
  "Merchandising WebP is truncated or has an invalid RIFF size."
);

assert.ok(nextStepAsset.length >= 7000, "Next-step AVIF is unexpectedly small or over-compressed.");
assert.equal(nextStepAsset.subarray(4, 8).toString("ascii"), "ftyp");
assert.match(
  nextStepAsset.subarray(0, 32).toString("ascii"),
  /avif/,
  "Next-step backdrop is not an AVIF image."
);

const ispeIndex = nextStepAsset.indexOf(Buffer.from("ispe"));
assert.ok(ispeIndex >= 0, "Next-step AVIF is missing image dimensions.");
const nextStepWidth = nextStepAsset.readUInt32BE(ispeIndex + 8);
const nextStepHeight = nextStepAsset.readUInt32BE(ispeIndex + 12);
assert.ok(
  nextStepWidth >= 1900 && nextStepHeight >= 800,
  "Next-step backdrop must remain at least 1900x800."
);

const stageBeforeMatch = css.match(
  /\.home-merchandising-stage::before\s*\{([\s\S]*?)\n\}/
);
assert.ok(stageBeforeMatch, "Merchandising background layer is missing.");
const stageBefore = stageBeforeMatch[1];

assert.match(
  stageBefore,
  /storefront-merchandising-background\.webp/,
  "Merchandising stage must use the approved backdrop asset."
);
assert.doesNotMatch(stageBefore, /shop-category-background\.webp/);
assert.match(stageBefore, /background-repeat:\s*no-repeat/);
assert.match(stageBefore, /background-size:\s*100%\s+100%/);
assert.doesNotMatch(stageBefore, /filter:\s*[^;]*blur\(/);
assert.doesNotMatch(stageBefore, /transform:\s*[^;]*scale\(/);
assert.doesNotMatch(stageBefore, /background-size:\s*cover/);

const nextStepBeforeMatch = css.match(/\.home-next-step::before\s*\{([\s\S]*?)\n\}/);
assert.ok(nextStepBeforeMatch, "Next-step background layer is missing.");
const nextStepBefore = nextStepBeforeMatch[1];
assert.match(nextStepBefore, /home-next-step-background\.avif/);
assert.match(nextStepBefore, /background-size:\s*cover/);
assert.match(nextStepBefore, /background-repeat:\s*no-repeat/);
assert.doesNotMatch(nextStepBefore, /home-next-step-background\.webp/);
assert.doesNotMatch(nextStepBefore, /filter:\s*[^;]*blur\(/);
assert.doesNotMatch(nextStepBefore, /backdrop-filter:/);
assert.doesNotMatch(nextStepBefore, /transform:\s*[^;]*scale\(/);
assert.doesNotMatch(nextStepBefore, /mask-image:/);

assert.match(home, /<div className="home-merchandising-stage">/);
assert.match(
  home,
  /<div className="home-merchandising-stage">[\s\S]*?<MerchandisingArea[\s\S]*?<section className="customer-section home-essentials">[\s\S]*?<HomeNextStep/,
  "Trending, Best Sellers, Everyday Essentials, and the next-step CTA must share one backdrop stage."
);

console.log("Storefront merchandising backdrop contract passed.");
