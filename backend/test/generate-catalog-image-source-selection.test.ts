import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogImageSourceArtifacts } from "../src/scripts/generateCatalogImageSourceSelection.js";

const preview = {
  summary: {
    products: 3,
    exactMatchCandidates: 1,
    readyCreateEngineAsset: 1,
    readyReuseEngineAsset: 0,
    blockedNeedsReview: 1,
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
      catalogImageFileIds: ["wrong"],
      catalogImageFilenames: ["wrong.png"],
      catalogImageReason: "variant conflict",
      existingImageAssetIds: [],
      activeImageAssetId: null,
      matchedExistingImageAssetId: null,
      crossProductConflictCodes: []
    },
    {
      productId: "p144",
      sku: "SARIMA-P144",
      sarimaSourceProductId: "P144",
      name: "Ligo Sardines 155g",
      status: "BLOCKED_NEEDS_REVIEW" as const,
      proposedAction: "NONE" as const,
      catalogImageStatus: "NEEDS_REVIEW" as const,
      catalogImageFileIds: [],
      catalogImageFilenames: [],
      catalogImageReason: "identity review",
      existingImageAssetIds: [],
      activeImageAssetId: null,
      matchedExistingImageAssetId: null,
      crossProductConflictCodes: []
    }
  ]
};

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
      assetFileIds: ["wrong"],
      identityReason: "canonical",
      imageReason: "variant conflict"
    },
    {
      productCode: "P144",
      identityStatus: "BLOCKED_REVIEW" as const,
      canonicalProductCode: "P014",
      imageStatus: "NEEDS_REVIEW" as const,
      assetFileIds: [],
      identityReason: "blocked",
      imageReason: "identity review"
    }
  ]
};

test("artifact builder emits Drive-first selection and CIQE jobs with licensed web fallback", () => {
  const artifacts = buildCatalogImageSourceArtifacts({
    preview,
    promotion,
    driveMaterializations: [
      {
        productCode: "P022",
        fileId: "drive-p022",
        sourcePath: "staging/P022/source.jpg",
        usable: true
      }
    ],
    webEvidence: [
      {
        productCode: "P091",
        sourceAssetId: "web-p091",
        sourceType: "MANUFACTURER" as const,
        provider: "Manufacturer",
        sourceUrl: "https://maker.example/p091",
        licenseBasis: "Manufacturer permits commercial product-catalog reuse.",
        licenseUrl: "https://maker.example/media-terms",
        commercialUseAllowed: true,
        exactProductIdentity: true,
        exactRetailUnit: true,
        watermarkFree: true,
        sourcePath: "staging/web/P091/source.png",
        retrievedAt: "2026-09-02T00:00:00Z"
      }
    ]
  });

  assert.deepEqual(artifacts.selection.summary, {
    products: 3,
    readyDrive: 1,
    readyLicensedWeb: 1,
    needsDriveMaterialization: 0,
    needsLicensedWebFallback: 0,
    blockedIdentityReview: 1
  });
  assert.deepEqual(artifacts.jobs, [
    {
      productCode: "P022",
      fileId: "drive-p022",
      sourcePath: "staging/P022/source.jpg",
      reconciliationStatus: "EXACT_MATCH"
    },
    {
      productCode: "P091",
      fileId: "WEB:web-p091",
      sourcePath: "staging/web/P091/source.png",
      reconciliationStatus: "EXACT_MATCH"
    }
  ]);
});

test("artifact builder fails closed on malformed promotion or preview artifacts", () => {
  assert.throws(
    () =>
      buildCatalogImageSourceArtifacts({
        preview: { ...preview, rows: undefined as never },
        promotion,
        driveMaterializations: [],
        webEvidence: []
      }),
    /CATALOG_IMAGE_SOURCE_SELECTION_INVALID_PREVIEW/
  );
  assert.throws(
    () =>
      buildCatalogImageSourceArtifacts({
        preview,
        promotion: { rows: undefined as never },
        driveMaterializations: [],
        webEvidence: []
      }),
    /CATALOG_IMAGE_SOURCE_SELECTION_INVALID_PROMOTION/
  );
});
