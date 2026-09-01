import assert from "node:assert/strict";
import test from "node:test";

import {
  assertExpectedDriveImageCount,
  buildDriveImageManifest,
  normalizeDriveImageStem,
  type DriveImageMetadata
} from "../src/modules/catalog/drive-image-manifest.js";

function asset(overrides: Partial<DriveImageMetadata> = {}): DriveImageMetadata {
  return {
    fileId: "file-1",
    filename: "Brand Choco 100g.jpg",
    folderId: "folder-snacks",
    folderName: "Snacks / Biscuits & Confectionery",
    mimeType: "image/jpeg",
    ...overrides
  };
}

test("normalizes only filename presentation and extension while preserving variant and size", () => {
  assert.equal(normalizeDriveImageStem("  Brand — Choco 100G.JPG  "), "brand choco 100g");
  assert.notEqual(
    normalizeDriveImageStem("Brand Choco 100g.jpg"),
    normalizeDriveImageStem("Brand Choco 200g.jpg")
  );
  assert.notEqual(
    normalizeDriveImageStem("Brand Choco.jpg"),
    normalizeDriveImageStem("Brand Vanilla.jpg")
  );
});

test("preserves duplicate-format assets instead of collapsing them during ingestion", () => {
  const manifest = buildDriveImageManifest([
    asset({ fileId: "webp", filename: "Lemon Square Lava Cake.webp", mimeType: "image/webp" }),
    asset({ fileId: "jpg", filename: "Lemon Square Lava Cake.jpg" })
  ]);

  assert.equal(manifest.length, 2);
  assert.equal(manifest[0]?.normalizedStem, "lemon square lava cake");
  assert.equal(manifest[1]?.normalizedStem, "lemon square lava cake");
  assert.deepEqual(
    manifest.map((entry) => entry.fileId).sort(),
    ["jpg", "webp"]
  );
});

test("preserves Drive provenance needed for later reconciliation", () => {
  const manifest = buildDriveImageManifest([
    asset({ fileId: "source-file", filename: "Gardenia Enriched White Bread 600g.jpg" })
  ]);

  assert.deepEqual(manifest[0], {
    extension: ".jpg",
    fileId: "source-file",
    filename: "Gardenia Enriched White Bread 600g.jpg",
    folderId: "folder-snacks",
    folderName: "Snacks / Biscuits & Confectionery",
    mimeType: "image/jpeg",
    normalizedStem: "gardenia enriched white bread 600g"
  });
});

test("rejects duplicate Drive file IDs", () => {
  assert.throws(
    () => buildDriveImageManifest([asset(), asset({ filename: "Another Product.jpg" })]),
    /Drive image metadata contains duplicate file ID file-1/
  );
});

test("rejects non-image metadata from the raw image inventory", () => {
  assert.throws(
    () => buildDriveImageManifest([asset({ mimeType: "application/pdf" })]),
    /Expected image metadata for file-1/
  );
});

test("accepts the authoritative Phase 9 Drive inventory count of 430", () => {
  assert.doesNotThrow(() => assertExpectedDriveImageCount({ length: 430 }));
});

test("rejects stale or incomplete Drive inventory counts", () => {
  assert.throws(
    () => assertExpectedDriveImageCount({ length: 429 }),
    /Expected exactly 430 unique raw Drive images; received 429/
  );
  assert.throws(
    () => assertExpectedDriveImageCount({ length: 431 }),
    /Expected exactly 430 unique raw Drive images; received 431/
  );
});
