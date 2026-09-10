import assert from "node:assert/strict";
import test from "node:test";

import { reconcileCatalogImages } from "../src/modules/catalog/catalog-image-reconciliation.js";
import {
  assertReviewedCatalogImageMaterialization,
  buildReviewedCatalogImageExecutionTarget
} from "../src/modules/catalog/catalog-reviewed-image-execution.js";
import {
  buildDriveImageManifest,
  type DriveImageAsset,
  type DriveImageMetadata
} from "../src/modules/catalog/drive-image-manifest.js";
import {
  normalizeSarimaSourceName,
  type SarimaSourceIdentity
} from "../src/modules/catalog/sarima-source-manifest.js";

const P132_FILE_ID = "17ZwteNRUJ1ShzSyU3YNoSDb1xOJTsJzZ";
const P132_FOLDER_ID = "1NY76Nb4AlGqXcpW5B99_STKlN1hhX4M6";
const P132_SHA256 = "359dd332c8c239951ebd0e55e1857f93879bb8e6bf123de55675d1dd7fc1e1f0";
const P132_SIZE_BYTES = 15877;

function p132Source(): SarimaSourceIdentity {
  return {
    category: "Tissue & Cotton",
    productCode: "P132",
    sourceName: "Bathroom Tissue Roll Tissue Pack",
    sourceNameNormalized: normalizeSarimaSourceName("Bathroom Tissue Roll Tissue Pack"),
    yearsPresent: [2024, 2025]
  };
}

function p132Image(overrides: Partial<DriveImageMetadata> = {}) {
  return buildDriveImageManifest([
    {
      fileId: P132_FILE_ID,
      filename: "athroom Tissue Roll  Tissue Pack.jpg",
      folderId: P132_FOLDER_ID,
      folderName: "Tissue & Cotton",
      mimeType: "image/jpeg",
      ...overrides
    }
  ])[0]!;
}

function p132Target() {
  const sources = [p132Source()];
  const images = [p132Image()];
  return buildReviewedCatalogImageExecutionTarget({
    productCode: "P132",
    sources,
    images,
    reconciliation: reconcileCatalogImages(sources, images)
  });
}

test("builds a current-catalog execution target only after reviewed reconciliation is exact", () => {
  assert.deepEqual(p132Target(), {
    productCode: "P132",
    expectedSku: "SARIMA-P132",
    sourceName: "Bathroom Tissue Roll Tissue Pack",
    sourceNameNormalized: "bathroom tissue roll tissue pack",
    category: "Tissue & Cotton",
    fileId: P132_FILE_ID,
    filename: "athroom Tissue Roll  Tissue Pack.jpg",
    mimeType: "image/jpeg",
    extension: ".jpg",
    folderId: P132_FOLDER_ID,
    folderName: "Tissue & Cotton",
    reviewedSha256: P132_SHA256,
    reviewedFileSizeBytes: P132_SIZE_BYTES
  });
});

test("accepts materialized P132 bytes only when hash, size, and MIME match reviewed evidence", () => {
  assert.doesNotThrow(() =>
    assertReviewedCatalogImageMaterialization(p132Target(), {
      sha256: P132_SHA256,
      sizeBytes: P132_SIZE_BYTES,
      contentType: "image/jpeg"
    })
  );
});

test("fails closed when materialized P132 bytes differ from reviewed evidence", () => {
  assert.throws(
    () =>
      assertReviewedCatalogImageMaterialization(p132Target(), {
        sha256: "0".repeat(64),
        sizeBytes: P132_SIZE_BYTES,
        contentType: "image/jpeg"
      }),
    /CATALOG_REVIEWED_IMAGE_CONTENT_MISMATCH/
  );
});

test("refuses execution when the Drive asset no longer satisfies the reviewed P132 identity", () => {
  const sources = [p132Source()];
  const images = [p132Image({ fileId: "unexpected-file-id" })];
  const reconciliation = reconcileCatalogImages(sources, images);

  assert.throws(
    () =>
      buildReviewedCatalogImageExecutionTarget({
        productCode: "P132",
        sources,
        images,
        reconciliation
      }),
    /CATALOG_REVIEWED_IMAGE_NOT_APPROVED/
  );
});

test("refuses non-image Drive assets even when reconciliation input is forged as exact", () => {
  const sources = [p132Source()];
  const images: DriveImageAsset[] = [
    {
      fileId: P132_FILE_ID,
      filename: "Tissue and Cotton.pdf",
      folderId: P132_FOLDER_ID,
      folderName: "Tissue & Cotton",
      mimeType: "application/pdf",
      extension: ".pdf",
      normalizedStem: normalizeSarimaSourceName("Tissue and Cotton")
    }
  ];

  assert.throws(
    () =>
      buildReviewedCatalogImageExecutionTarget({
        productCode: "P132",
        sources,
        images,
        reconciliation: {
          sourceOutcomes: [
            {
              productCode: "P132",
              sourceName: sources[0]!.sourceName,
              sourceNameNormalized: sources[0]!.sourceNameNormalized,
              status: "EXACT_MATCH",
              assetFileIds: [P132_FILE_ID],
              reason: "test fixture"
            }
          ],
          driveOnlyAssets: []
        }
      }),
    /CATALOG_REVIEWED_IMAGE_NON_IMAGE_ASSET/
  );
});
