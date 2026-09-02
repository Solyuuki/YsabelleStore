import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildCatalogDriveMaterializationPlan,
  materializeCatalogDriveImages
} from "../src/modules/catalog/catalog-image-drive-materialization.js";

const rows = [
  {
    productId: "p022",
    sku: "SARIMA-P022",
    sarimaSourceProductId: "P022",
    name: "Gardenia Enriched White Bread 600g",
    status: "READY" as const,
    proposedAction: "CREATE_ENGINE_ASSET" as const,
    catalogImageStatus: "EXACT_MATCH" as const,
    catalogImageFileIds: ["drive-p022"],
    catalogImageFilenames: ["Gardenia Enriched White Bread 600g.jpg"],
    catalogImageReason: "exact",
    existingImageAssetIds: [],
    activeImageAssetId: null,
    matchedExistingImageAssetId: null,
    crossProductConflictCodes: []
  },
  {
    productId: "p091",
    sku: "SARIMA-P091",
    sarimaSourceProductId: "P091",
    name: "Star Nutri-Meats Giniling Afritada 100g",
    status: "BLOCKED_VARIANT_SIZE_MISMATCH" as const,
    proposedAction: "NONE" as const,
    catalogImageStatus: "VARIANT_SIZE_MISMATCH" as const,
    catalogImageFileIds: ["wrong-a", "wrong-b"],
    catalogImageFilenames: ["Classic.png", "Oyster.webp"],
    catalogImageReason: "variant conflict",
    existingImageAssetIds: [],
    activeImageAssetId: null,
    matchedExistingImageAssetId: null,
    crossProductConflictCodes: []
  }
];

const driveAssets = [
  {
    fileId: "drive-p022",
    filename: "Gardenia Enriched White Bread 600g.jpg",
    folderId: "folder",
    folderName: "Bread",
    mimeType: "image/jpeg",
    extension: ".jpg",
    normalizedStem: "gardenia enriched white bread 600g"
  }
];

test("materialization plan contains only exact Drive create candidates with deterministic staging paths", () => {
  const plan = buildCatalogDriveMaterializationPlan({ rows, driveAssets });

  assert.deepEqual(plan, [
    {
      productCode: "P022",
      fileId: "drive-p022",
      filename: "Gardenia Enriched White Bread 600g.jpg",
      mimeType: "image/jpeg",
      sourcePath: ".data/catalog-image-staging/P022/source.jpg",
      downloadUrl: "https://drive.usercontent.google.com/download?id=drive-p022&export=download&confirm=t"
    }
  ]);
});

test("materialization writes downloaded bytes and records SHA-256 provenance", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ysabelle-drive-materialize-"));
  try {
    const plan = buildCatalogDriveMaterializationPlan({ rows, driveAssets });
    const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
    const result = await materializeCatalogDriveImages({
      plan,
      repositoryRoot: root,
      download: async () => ({ bytes: imageBytes, contentType: "image/jpeg" })
    });

    assert.equal(result.length, 1);
    assert.equal(result[0]?.usable, true);
    assert.equal(result[0]?.sha256, "9416fc2274882b4ca28374362f6496957c6268a90580d66ac3a5f8d0dab16132");
    assert.equal(result[0]?.sizeBytes, imageBytes.length);
    assert.equal(result[0]?.error, null);
    assert.deepEqual(
      await readFile(path.join(root, ".data/catalog-image-staging/P022/source.jpg")),
      imageBytes
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("failed or non-image downloads are recorded unusable and do not create trusted materialization", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ysabelle-drive-materialize-fail-"));
  try {
    const plan = buildCatalogDriveMaterializationPlan({ rows, driveAssets });
    const result = await materializeCatalogDriveImages({
      plan,
      repositoryRoot: root,
      download: async () => ({ bytes: Buffer.from("<html>login</html>"), contentType: "text/html" })
    });

    assert.equal(result[0]?.usable, false);
    assert.equal(result[0]?.sha256, null);
    assert.match(result[0]?.error ?? "", /non-image response/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("plan fails closed when an exact-match file ID is absent from the Drive manifest", () => {
  assert.throws(
    () => buildCatalogDriveMaterializationPlan({ rows, driveAssets: [] }),
    /CATALOG_IMAGE_DRIVE_MATERIALIZATION_ASSET_MISSING/
  );
});
