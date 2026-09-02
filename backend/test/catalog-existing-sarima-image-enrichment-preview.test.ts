import assert from "node:assert/strict";
import test from "node:test";

import { buildExistingSarimaImageEnrichmentPreview } from "../src/modules/catalog/catalog-existing-sarima-image-enrichment-preview.js";

const identities = [
  { id: "p1", sku: "SARIMA-P022", sarimaSourceProductId: "P022" },
  { id: "p2", sku: "SARIMA-P091", sarimaSourceProductId: "P091" },
  { id: "p3", sku: "SARIMA-P144", sarimaSourceProductId: "P144" }
] as const;

const products = [
  {
    id: "p1",
    sku: "SARIMA-P022",
    name: "Gardenia Enriched White Bread 600g",
    recordSource: "IMPORT",
    status: "INACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false,
    sarimaSourceProductId: "P022",
    activeImageAssetId: null,
    imageAssets: []
  },
  {
    id: "p2",
    sku: "SARIMA-P091",
    name: "Star Nutri-Meats Giniling Afritada 100g",
    recordSource: "IMPORT",
    status: "INACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false,
    sarimaSourceProductId: "P091",
    activeImageAssetId: "legacy-p2",
    imageAssets: [
      {
        id: "legacy-p2",
        qualityStatus: "APPROVED",
        processingStatus: "READY",
        originalStorageKey: "legacy/p091.jpg",
        diagnostics: null
      }
    ]
  },
  {
    id: "p3",
    sku: "SARIMA-P144",
    name: "Ligo Sardines 155g",
    recordSource: "IMPORT",
    status: "INACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false,
    sarimaSourceProductId: "P144",
    activeImageAssetId: null,
    imageAssets: []
  }
];

const promotionRows = [
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
    assetFileIds: ["drive-p091-a", "drive-p091-b"],
    identityReason: "canonical",
    imageReason: "variant conflict"
  },
  {
    productCode: "P144",
    identityStatus: "BLOCKED_REVIEW" as const,
    canonicalProductCode: "P014",
    imageStatus: "NEEDS_REVIEW" as const,
    assetFileIds: [],
    identityReason: "same family as P014",
    imageReason: "identity blocked"
  }
];

const driveAssets = [
  {
    fileId: "drive-p022",
    filename: "Gardenia Enriched White Bread 600g.jpg",
    folderId: "folder",
    folderName: "Products",
    mimeType: "image/jpeg",
    extension: ".jpg",
    normalizedStem: "gardenia enriched white bread 600g"
  },
  {
    fileId: "drive-p091-a",
    filename: "Star Nutri-Meats Giniling Afritada 100g A.jpg",
    folderId: "folder",
    folderName: "Products",
    mimeType: "image/jpeg",
    extension: ".jpg",
    normalizedStem: "star nutri meats giniling afritada 100g a"
  },
  {
    fileId: "drive-p091-b",
    filename: "Star Nutri-Meats Giniling Afritada 100g B.jpg",
    folderId: "folder",
    folderName: "Products",
    mimeType: "image/jpeg",
    extension: ".jpg",
    normalizedStem: "star nutri meats giniling afritada 100g b"
  }
];

test("preview proposes CIQE creation only for exact-match products and blocks mismatch/review rows", () => {
  const preview = buildExistingSarimaImageEnrichmentPreview({
    identities,
    products,
    promotionRows,
    driveAssets
  });

  assert.deepEqual(preview.summary, {
    products: 3,
    exactMatchCandidates: 1,
    readyCreateEngineAsset: 1,
    readyReuseEngineAsset: 0,
    blockedNeedsReview: 1,
    blockedVariantSizeMismatch: 1,
    blockedDuplicateImage: 0,
    blockedMissingImage: 0,
    crossProductFileIdConflicts: 0,
    existingDatabaseImageAssets: 1,
    existingActiveImages: 1
  });

  assert.deepEqual(preview.rows.map((row) => ({
    code: row.sarimaSourceProductId,
    status: row.status,
    action: row.proposedAction,
    fileIds: row.catalogImageFileIds
  })), [
    { code: "P022", status: "READY", action: "CREATE_ENGINE_ASSET", fileIds: ["drive-p022"] },
    { code: "P091", status: "BLOCKED_VARIANT_SIZE_MISMATCH", action: "NONE", fileIds: ["drive-p091-a", "drive-p091-b"] },
    { code: "P144", status: "BLOCKED_NEEDS_REVIEW", action: "NONE", fileIds: [] }
  ]);
});

test("preview reuses a DB image asset only when diagnostics explicitly link the same Drive file ID", () => {
  const linkedProducts = [
    {
      ...products[0]!,
      activeImageAssetId: "asset-p022",
      imageAssets: [
        {
          id: "asset-p022",
          qualityStatus: "NEEDS_REVIEW",
          processingStatus: "READY",
          originalStorageKey: "catalog/p022/source.jpg",
          diagnostics: { sourceDriveFileId: "drive-p022" }
        }
      ]
    },
    products[1]!,
    products[2]!
  ];

  const preview = buildExistingSarimaImageEnrichmentPreview({
    identities,
    products: linkedProducts,
    promotionRows,
    driveAssets
  });

  assert.equal(preview.rows[0]?.proposedAction, "REUSE_ENGINE_ASSET");
  assert.equal(preview.rows[0]?.matchedExistingImageAssetId, "asset-p022");
  assert.equal(preview.summary.readyReuseEngineAsset, 1);
  assert.equal(preview.summary.readyCreateEngineAsset, 0);
});

test("preview blocks exact-match file IDs assigned across multiple products", () => {
  const secondExactPromotion = promotionRows.map((row) =>
    row.productCode === "P144"
      ? {
          ...row,
          identityStatus: "CANONICAL" as const,
          canonicalProductCode: "P144",
          imageStatus: "EXACT_MATCH" as const,
          assetFileIds: ["drive-p022"],
          identityReason: "canonical",
          imageReason: "exact"
        }
      : row
  );

  const preview = buildExistingSarimaImageEnrichmentPreview({
    identities,
    products,
    promotionRows: secondExactPromotion,
    driveAssets
  });

  assert.equal(preview.summary.crossProductFileIdConflicts, 2);
  assert.equal(preview.rows[0]?.status, "BLOCKED_CROSS_PRODUCT_FILE_CONFLICT");
  assert.equal(preview.rows[2]?.status, "BLOCKED_CROSS_PRODUCT_FILE_CONFLICT");
  assert.equal(preview.rows[0]?.proposedAction, "NONE");
  assert.equal(preview.rows[2]?.proposedAction, "NONE");
});

test("preview fails closed if a Product leaves the rehabilitation state or SARIMA identity drifts", () => {
  assert.throws(
    () => buildExistingSarimaImageEnrichmentPreview({
      identities,
      products: [{ ...products[0]!, status: "ACTIVE" }, products[1]!, products[2]!],
      promotionRows,
      driveAssets
    }),
    /EXISTING_SARIMA_IMAGE_ENRICHMENT_STATE_MISMATCH/
  );

  assert.throws(
    () => buildExistingSarimaImageEnrichmentPreview({
      identities,
      products: [{ ...products[0]!, sarimaSourceProductId: "P999" }, products[1]!, products[2]!],
      promotionRows,
      driveAssets
    }),
    /EXISTING_SARIMA_IMAGE_ENRICHMENT_IDENTITY_MISMATCH/
  );
});

test("preview fails closed when an EXACT_MATCH references a Drive file ID missing from the manifest", () => {
  assert.throws(
    () => buildExistingSarimaImageEnrichmentPreview({
      identities,
      products,
      promotionRows,
      driveAssets: driveAssets.filter((asset) => asset.fileId !== "drive-p022")
    }),
    /EXISTING_SARIMA_IMAGE_ENRICHMENT_DRIVE_ASSET_MISSING/
  );
});
