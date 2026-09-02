import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadDriveImageMetadataSnapshot } from "../src/modules/catalog/drive-image-snapshot.js";
import { buildDriveImageManifest } from "../src/modules/catalog/drive-image-manifest.js";

const snapshotDir = path.resolve("artifacts/catalog/phase9/drive-image-metadata");

test("loads the authoritative Phase 9 Drive snapshot with all 430 unique raw image files", async () => {
  const metadata = await loadDriveImageMetadataSnapshot(snapshotDir);
  const manifest = buildDriveImageManifest(metadata);

  assert.equal(metadata.length, 430);
  assert.equal(manifest.length, 430);
  assert.equal(new Set(manifest.map((entry) => entry.fileId)).size, 430);
  assert.ok(manifest.every((entry) => entry.mimeType.startsWith("image/")));
});

test("preserves AVIF assets that the Drive image-search path can omit", async () => {
  const metadata = await loadDriveImageMetadataSnapshot(snapshotDir);

  const snackAvif = metadata.find(
    (entry) => entry.fileId === "1MY7Qi0mGt0dafyc6QtQKXc3LSXSthke4"
  );
  assert.ok(snackAvif);
  assert.equal(snackAvif.filename, "Hi-Ho O’Puffly BBQ Snack.avif");
  assert.equal(snackAvif.mimeType, "image/avif");
});

test("keeps all 12 source category folders represented in the snapshot", async () => {
  const metadata = await loadDriveImageMetadataSnapshot(snapshotDir);
  const folderIds = new Set(metadata.map((entry) => entry.folderId));

  assert.equal(folderIds.size, 12);
});
