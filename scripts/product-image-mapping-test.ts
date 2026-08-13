import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { SARIMA_CATALOG_CANDIDATES } from "../backend/src/modules/forecasting/sarima-catalog-candidates";
import {
  describeCatalogImage,
  getCatalogImageMetadata
} from "../frontend/src/utils/catalogImageMetadata";
import {
  ABOUT_STORE_ESSENTIAL_PRODUCT_IDS,
  ABOUT_STORE_ESSENTIAL_SLOT_COUNT
} from "../frontend/src/utils/storefrontCuratedShowcase";

const expectedMappings = [
  {
    imageUrl: "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp",
    sourceProductId: "P144"
  },
  {
    imageUrl: "/images/products/sunsilk-anti-dandruff-silky-shampoo-sachet-13-5ml.webp",
    sourceProductId: "P054"
  },
  {
    imageUrl: "/images/products/gardenia-enriched-white-bread-600g.webp",
    sourceProductId: "P022"
  }
] as const;

const mappedCandidates = SARIMA_CATALOG_CANDIDATES.filter((candidate) => candidate.imageUrl);
const candidateBySourceId = new Map(
  SARIMA_CATALOG_CANDIDATES.map((candidate) => [candidate.sourceProductId, candidate])
);
assert.equal(SARIMA_CATALOG_CANDIDATES.length, 20);
assert.equal(mappedCandidates.length, expectedMappings.length);
assert.deepEqual(
  mappedCandidates.map(({ imageUrl, sourceProductId }) => ({ imageUrl, sourceProductId })),
  expectedMappings
);
assert.equal(
  candidateBySourceId.get("P261")?.imageUrl,
  undefined,
  "Coke Mismo must not be assigned to the canonical Coca-Cola 1.5L product."
);
assert.equal(
  candidateBySourceId.get("P443")?.imageUrl,
  undefined,
  "Nissin Ramen must not be assigned to the canonical Payless Yakisoba product."
);
assert.equal(
  candidateBySourceId.get("P022")?.imageUrl,
  "/images/products/gardenia-enriched-white-bread-600g.webp",
  "The 400g California Raisin Loaf must not replace the exact 600g Enriched White Bread image."
);
assert.equal(
  SARIMA_CATALOG_CANDIDATES.filter((candidate) => !candidate.imageUrl).length,
  17,
  "Unmatched products must retain the shared imageUrl=null fallback path."
);

async function verifyAssets() {
  execFileSync("python", ["scripts/product_image_cutouts.py", "--verify"], {
    cwd: process.cwd(),
    stdio: "pipe"
  });
  for (const mapping of expectedMappings) {
    assert.match(mapping.imageUrl, /^\/images\/products\/[a-z0-9-]+\.webp$/);
    const assetPath = path.join(process.cwd(), "frontend", "public", mapping.imageUrl);
    const asset = await readFile(assetPath);
    const metadata = getCatalogImageMetadata(mapping.imageUrl);
    assert.ok(metadata, `${mapping.imageUrl} requires intrinsic UI metadata.`);
    assert.ok(metadata.width > 0 && metadata.height > 0);
    assert.equal(metadata.background, "transparent");
    assert.equal(describeCatalogImage(metadata.width, metadata.height).resolution, "low");
    assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF", `${assetPath} is not WebP.`);
    assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP", `${assetPath} is not WebP.`);
  }
}

assert.deepEqual(describeCatalogImage(164, 412), { resolution: "low", shape: "tall" });
assert.deepEqual(describeCatalogImage(80, 128), { resolution: "low", shape: "tall" });
assert.deepEqual(describeCatalogImage(137, 68), { resolution: "low", shape: "wide" });

assert.equal(ABOUT_STORE_ESSENTIAL_PRODUCT_IDS.length, ABOUT_STORE_ESSENTIAL_SLOT_COUNT);
assert.deepEqual(
  ABOUT_STORE_ESSENTIAL_PRODUCT_IDS,
  ["P022", "P144", "P054", "P022"].map(
    (sourceProductId) =>
      SARIMA_CATALOG_CANDIDATES.find((candidate) => candidate.sourceProductId === sourceProductId)
        ?.id
  ),
  "Scene 06 must use only exact image-backed catalog products."
);

void verifyAssets().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
