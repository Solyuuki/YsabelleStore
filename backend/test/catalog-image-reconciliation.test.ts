import assert from "node:assert/strict";
import test from "node:test";

import { buildDriveImageManifest, type DriveImageMetadata } from "../src/modules/catalog/drive-image-manifest.js";
import {
  reconcileCatalogImages,
  type ImageReconciliationStatus
} from "../src/modules/catalog/catalog-image-reconciliation.js";
import { normalizeSarimaSourceName, type SarimaSourceIdentity } from "../src/modules/catalog/sarima-source-manifest.js";

function source(productCode: string, sourceName: string): SarimaSourceIdentity {
  return {
    category: "Test",
    productCode,
    sourceName,
    sourceNameNormalized: normalizeSarimaSourceName(sourceName),
    yearsPresent: [2024, 2025]
  };
}

function image(fileId: string, filename: string, mimeType = "image/jpeg") {
  const metadata: DriveImageMetadata = {
    fileId,
    filename,
    folderId: "folder-test",
    folderName: "Test",
    mimeType
  };

  return buildDriveImageManifest([metadata])[0]!;
}

function statusFor(
  status: ImageReconciliationStatus,
  productCode: string,
  sources: SarimaSourceIdentity[],
  images: ReturnType<typeof image>[]
) {
  const result = reconcileCatalogImages(sources, images);
  const outcome = result.sourceOutcomes.find((entry) => entry.productCode === productCode);
  assert.ok(outcome, `Missing reconciliation outcome for ${productCode}`);
  assert.equal(outcome.status, status);
  return { outcome, result };
}

test("auto-matches exact identity after punctuation and case normalization", () => {
  const sources = [source("P001", "Gardenia Enriched White Bread 600g")];
  const images = [image("gardenia", "GARDENIA — Enriched White Bread 600G.JPG")];

  const { outcome, result } = statusFor("EXACT_MATCH", "P001", sources, images);
  assert.deepEqual(outcome.assetFileIds, ["gardenia"]);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("auto-matches a unique identity when all tokens agree but word order differs", () => {
  const sources = [source("P001", "Alpha Spicy Paksiw Tuna")];
  const images = [image("alpha", "Alpha Tuna Spicy Paksiw.webp", "image/webp")];

  const { outcome, result } = statusFor("EXACT_MATCH", "P001", sources, images);
  assert.deepEqual(outcome.assetFileIds, ["alpha"]);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("classifies a conflicting package size as VARIANT_SIZE_MISMATCH", () => {
  const sources = [source("P001", "Gardenia Enriched White Bread 600g")];
  const images = [image("gardenia-400", "Gardenia Enriched White Bread 400g.jpg")];

  const { outcome, result } = statusFor("VARIANT_SIZE_MISMATCH", "P001", sources, images);
  assert.deepEqual(outcome.assetFileIds, ["gardenia-400"]);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("keeps a related image in NEEDS_REVIEW when source size evidence is absent from the filename", () => {
  const sources = [source("P144", "Ligo Sardines in Tomato Sauce Chili Added 155g")];
  const images = [image("ligo", "Ligo Sardines in Tomato Sauce Chili Added.webp", "image/webp")];

  const { outcome, result } = statusFor("NEEDS_REVIEW", "P144", sources, images);
  assert.deepEqual(outcome.assetFileIds, ["ligo"]);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("classifies a conflicting flavor in the same product family as VARIANT_SIZE_MISMATCH", () => {
  const sources = [source("P001", "Fudgee Barr Chocolate")];
  const images = [image("vanilla", "Fudgee Barr Vanilla.jpg")];

  const { outcome, result } = statusFor("VARIANT_SIZE_MISMATCH", "P001", sources, images);
  assert.deepEqual(outcome.assetFileIds, ["vanilla"]);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("keeps equivalent image formats explicit as DUPLICATE_IMAGE", () => {
  const sources = [source("P001", "Lemon Square Lava Cake")];
  const images = [
    image("lava-jpg", "Lemon Square Lava Cake.jpg"),
    image("lava-webp", "Lemon Square Lava Cake.webp", "image/webp")
  ];

  const { outcome, result } = statusFor("DUPLICATE_IMAGE", "P001", sources, images);
  assert.deepEqual(outcome.assetFileIds, ["lava-jpg", "lava-webp"]);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("does not assign a second image to a token-equivalent historical source identity", () => {
  const sources = [
    source("P012", "555 Tuna Spicy Paksiw"),
    source("P143", "555 Spicy Paksiw Tuna")
  ];
  const images = [image("paksiw", "555 Tuna Spicy Paksiw.webp", "image/webp")];

  const result = reconcileCatalogImages(sources, images);
  const primary = result.sourceOutcomes.find((entry) => entry.productCode === "P012");
  const duplicateSource = result.sourceOutcomes.find((entry) => entry.productCode === "P143");

  assert.equal(primary?.status, "EXACT_MATCH");
  assert.deepEqual(primary?.assetFileIds, ["paksiw"]);
  assert.equal(duplicateSource?.status, "NEEDS_REVIEW");
  assert.deepEqual(duplicateSource?.assetFileIds, []);
  assert.match(duplicateSource?.reason ?? "", /P012/);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("keeps an ambiguous generic family with multiple plausible assets in NEEDS_REVIEW", () => {
  const sources = [source("P001", "Bottled Water")];
  const images = [
    image("wilkins", "Wilkins Pure Drinking Water 500ml.jpg"),
    image("nature", "Nature’s Spring Purified Drinking Water 500ml.jpg")
  ];

  const { outcome, result } = statusFor("NEEDS_REVIEW", "P001", sources, images);
  assert.deepEqual(outcome.assetFileIds, ["nature", "wilkins"]);
  assert.equal(result.driveOnlyAssets.length, 0);
});

test("reports an unrelated asset as DRIVE_ONLY and leaves the source MISSING_IMAGE", () => {
  const sources = [source("P001", "Gardenia Enriched White Bread 600g")];
  const images = [image("plate", "Disposable Paper Plate Pack.jpg")];

  const { outcome, result } = statusFor("MISSING_IMAGE", "P001", sources, images);
  assert.deepEqual(outcome.assetFileIds, []);
  assert.deepEqual(result.driveOnlyAssets.map((entry) => entry.fileId), ["plate"]);
});
