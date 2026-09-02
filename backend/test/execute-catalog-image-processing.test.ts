import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { executeCatalogImageProcessing } from "../src/scripts/executeCatalogImageProcessing.js";

const preview = {
  summary: {
    products: 2,
    exactMatchCandidates: 1,
    readyCreateEngineAsset: 1,
    readyReuseEngineAsset: 0,
    blockedNeedsReview: 0,
    blockedVariantSizeMismatch: 1,
    blockedDuplicateImage: 0,
    blockedMissingImage: 0,
    crossProductFileIdConflicts: 0,
    existingDatabaseImageAssets: 0,
    existingActiveImages: 0
  },
  rows: [
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
  ]
};

const driveManifest = [
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

const promotion = {
  rows: [
    {
      productCode: "P022",
      identityStatus: "CANONICAL" as const,
      canonicalProductCode: "P022",
      imageStatus: "EXACT_MATCH" as const,
      assetFileIds: ["drive-p022"],
      identityReason: "canonical",
      imageReason: "exact"
    },
    {
      productCode: "P091",
      identityStatus: "CANONICAL" as const,
      canonicalProductCode: "P091",
      imageStatus: "VARIANT_SIZE_MISMATCH" as const,
      assetFileIds: ["wrong-a", "wrong-b"],
      identityReason: "canonical",
      imageReason: "variant conflict"
    }
  ]
};

test("execution materializes Drive sources, regenerates CIQE jobs, and emits remediation without DB writes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ysabelle-image-processing-"));
  try {
    const artifacts = path.join(root, "artifacts/catalog/phase9");
    const reports = path.join(root, "reports/catalog-quality");
    await mkdir(artifacts, { recursive: true });
    await mkdir(reports, { recursive: true });
    await writeFile(path.join(reports, "phase9-existing-sarima-image-enrichment-preview.json"), JSON.stringify(preview));
    await writeFile(path.join(artifacts, "drive-image-manifest.json"), JSON.stringify(driveManifest));
    await writeFile(path.join(artifacts, "catalog-promotion-preview.json"), JSON.stringify(promotion));

    const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    let ciqeJobsSeen = 0;
    const result = await executeCatalogImageProcessing({
      repositoryRoot: root,
      download: async () => ({ bytes: imageBytes, contentType: "image/jpeg" }),
      runCiqe: async ({ jobs }) => {
        ciqeJobsSeen = jobs.length;
        return {
          counts: { APPROVED: jobs.length, REJECTED: 0, PROCESS_ERROR: 0 },
          results: jobs.map((job) => ({ productCode: job.productCode, fileId: job.fileId, status: "APPROVED" }))
        };
      }
    });

    assert.equal(result.materialization.total, 1);
    assert.equal(result.materialization.usable, 1);
    assert.equal(result.selection.readyDrive, 1);
    assert.equal(result.selection.needsLicensedWebFallback, 1);
    assert.equal(result.ciqeJobs, 1);
    assert.equal(ciqeJobsSeen, 1);
    assert.deepEqual(result.ciqeCounts, { APPROVED: 1, REJECTED: 0, PROCESS_ERROR: 0 });
    assert.deepEqual(result.remediation, {
      products: 2,
      ciqeApproved: 1,
      webFallbackCandidates: 1,
      driveMaterializationFailed: 0,
      ciqeRejected: 0,
      reconciliationRequiresWeb: 1,
      blockedIdentityReview: 0,
      processErrors: 0
    });

    const materializations = JSON.parse(
      await readFile(path.join(artifacts, "image-source-drive-materializations.json"), "utf8")
    );
    assert.equal(materializations[0].productCode, "P022");
    assert.equal(materializations[0].usable, true);

    const remediation = JSON.parse(
      await readFile(path.join(reports, "phase9-image-remediation-candidates.json"), "utf8")
    );
    assert.equal(remediation.rows.length, 1);
    assert.equal(remediation.rows[0].productCode, "P091");
    assert.equal(remediation.rows[0].reason, "RECONCILIATION_REQUIRES_WEB");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("exhausted unusable Drive download becomes remediation candidate and never enters CIQE", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ysabelle-image-processing-fail-"));
  try {
    const artifacts = path.join(root, "artifacts/catalog/phase9");
    const reports = path.join(root, "reports/catalog-quality");
    await mkdir(artifacts, { recursive: true });
    await mkdir(reports, { recursive: true });
    await writeFile(path.join(reports, "phase9-existing-sarima-image-enrichment-preview.json"), JSON.stringify(preview));
    await writeFile(path.join(artifacts, "drive-image-manifest.json"), JSON.stringify(driveManifest));
    await writeFile(path.join(artifacts, "catalog-promotion-preview.json"), JSON.stringify(promotion));

    const result = await executeCatalogImageProcessing({
      repositoryRoot: root,
      download: async () => ({ bytes: Buffer.from("login"), contentType: "text/html" }),
      runCiqe: async ({ jobs }) => {
        assert.equal(jobs.length, 0);
        return { counts: { APPROVED: 0, REJECTED: 0, PROCESS_ERROR: 0 }, results: [] };
      }
    });

    assert.equal(result.materialization.usable, 0);
    assert.equal(result.selection.needsDriveMaterialization, 1);
    assert.equal(result.ciqeJobs, 0);
    assert.equal(result.remediation.driveMaterializationFailed, 1);
    assert.equal(result.remediation.reconciliationRequiresWeb, 1);
    assert.equal(result.remediation.webFallbackCandidates, 2);

    const remediation = JSON.parse(
      await readFile(path.join(reports, "phase9-image-remediation-candidates.json"), "utf8")
    );
    const p022 = remediation.rows.find((row: { productCode: string }) => row.productCode === "P022");
    assert.equal(p022.reason, "DRIVE_MATERIALIZATION_FAILED");
    assert.equal(p022.driveAttempts, 2);
    assert.match(p022.driveError, /non-image response/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
