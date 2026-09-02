import type { DriveImageAsset } from "./drive-image-manifest.js";
import type {
  ExistingSarimaPromotionEvidence,
  ExistingSarimaRehabilitationIdentity
} from "./catalog-existing-sarima-rehabilitation-readiness.js";

export type ExistingSarimaImageAssetSnapshot = {
  id: string;
  qualityStatus: string;
  processingStatus: string;
  originalStorageKey: string;
  diagnostics: unknown;
};

export type ExistingSarimaImageProduct = {
  id: string;
  sku: string;
  name: string;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceProductId: string | null;
  activeImageAssetId: string | null;
  imageAssets: ExistingSarimaImageAssetSnapshot[];
};

export type ExistingSarimaImageEnrichmentStatus =
  | "READY"
  | "BLOCKED_NEEDS_REVIEW"
  | "BLOCKED_VARIANT_SIZE_MISMATCH"
  | "BLOCKED_DUPLICATE_IMAGE"
  | "BLOCKED_MISSING_IMAGE"
  | "BLOCKED_CROSS_PRODUCT_FILE_CONFLICT";

export type ExistingSarimaImageEnrichmentAction =
  | "CREATE_ENGINE_ASSET"
  | "REUSE_ENGINE_ASSET"
  | "NONE";

export type ExistingSarimaImageEnrichmentPreviewRow = {
  productId: string;
  sku: string;
  sarimaSourceProductId: string;
  name: string;
  status: ExistingSarimaImageEnrichmentStatus;
  proposedAction: ExistingSarimaImageEnrichmentAction;
  catalogImageStatus: ExistingSarimaPromotionEvidence["imageStatus"];
  catalogImageFileIds: string[];
  catalogImageFilenames: string[];
  catalogImageReason: string;
  existingImageAssetIds: string[];
  activeImageAssetId: string | null;
  matchedExistingImageAssetId: string | null;
  crossProductConflictCodes: string[];
};

export type ExistingSarimaImageEnrichmentPreview = {
  summary: {
    products: number;
    exactMatchCandidates: number;
    readyCreateEngineAsset: number;
    readyReuseEngineAsset: number;
    blockedNeedsReview: number;
    blockedVariantSizeMismatch: number;
    blockedDuplicateImage: number;
    blockedMissingImage: number;
    crossProductFileIdConflicts: number;
    existingDatabaseImageAssets: number;
    existingActiveImages: number;
  };
  rows: ExistingSarimaImageEnrichmentPreviewRow[];
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function sourceDriveFileId(diagnostics: unknown): string | null {
  if (!diagnostics || typeof diagnostics !== "object" || Array.isArray(diagnostics)) return null;
  const value = (diagnostics as Record<string, unknown>).sourceDriveFileId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function baseBlockedStatus(
  status: ExistingSarimaPromotionEvidence["imageStatus"]
): ExistingSarimaImageEnrichmentStatus {
  if (status === "NEEDS_REVIEW") return "BLOCKED_NEEDS_REVIEW";
  if (status === "VARIANT_SIZE_MISMATCH") return "BLOCKED_VARIANT_SIZE_MISMATCH";
  if (status === "DUPLICATE_IMAGE") return "BLOCKED_DUPLICATE_IMAGE";
  if (status === "MISSING_IMAGE") return "BLOCKED_MISSING_IMAGE";
  return "READY";
}

export function buildExistingSarimaImageEnrichmentPreview(input: {
  identities: readonly ExistingSarimaRehabilitationIdentity[];
  products: ExistingSarimaImageProduct[];
  promotionRows: ExistingSarimaPromotionEvidence[];
  driveAssets: DriveImageAsset[];
}): ExistingSarimaImageEnrichmentPreview {
  if (input.products.length !== input.identities.length) {
    fail(
      "EXISTING_SARIMA_IMAGE_ENRICHMENT_IDENTITY_MISMATCH",
      `expected ${input.identities.length} Products, found ${input.products.length}`
    );
  }

  const productById = new Map(input.products.map((row) => [row.id, row]));
  const promotionByCode = new Map(input.promotionRows.map((row) => [row.productCode, row]));
  const driveByFileId = new Map(input.driveAssets.map((row) => [row.fileId, row]));

  const fileOwners = new Map<string, string[]>();
  for (const identity of input.identities) {
    const promotion = promotionByCode.get(identity.sarimaSourceProductId);
    if (!promotion || promotion.imageStatus !== "EXACT_MATCH") continue;
    for (const fileId of promotion.assetFileIds) {
      const owners = fileOwners.get(fileId) ?? [];
      owners.push(identity.sarimaSourceProductId);
      fileOwners.set(fileId, owners);
    }
  }

  const rows = input.identities.map((identity): ExistingSarimaImageEnrichmentPreviewRow => {
    const product = productById.get(identity.id);
    if (
      !product ||
      product.sku !== identity.sku ||
      product.sarimaSourceProductId !== identity.sarimaSourceProductId
    ) {
      fail(
        "EXISTING_SARIMA_IMAGE_ENRICHMENT_IDENTITY_MISMATCH",
        `${identity.id} no longer matches the expected Product/SARIMA identity`
      );
    }

    if (
      product.recordSource !== "IMPORT" ||
      product.status !== "INACTIVE" ||
      product.dataQualityStatus !== "NEEDS_REVIEW" ||
      product.isStorefrontVisible !== false
    ) {
      fail(
        "EXISTING_SARIMA_IMAGE_ENRICHMENT_STATE_MISMATCH",
        `${identity.id} must remain IMPORT + INACTIVE + NEEDS_REVIEW + storefront hidden during image preview`
      );
    }

    const promotion = promotionByCode.get(identity.sarimaSourceProductId);
    if (!promotion) {
      fail(
        "EXISTING_SARIMA_IMAGE_ENRICHMENT_IDENTITY_MISMATCH",
        `missing image reconciliation evidence for ${identity.sarimaSourceProductId}`
      );
    }

    const driveAssets = promotion.assetFileIds.map((fileId) => {
      const asset = driveByFileId.get(fileId);
      if (!asset) {
        fail(
          "EXISTING_SARIMA_IMAGE_ENRICHMENT_DRIVE_ASSET_MISSING",
          `${identity.sarimaSourceProductId} references Drive file ${fileId} that is absent from the manifest`
        );
      }
      return asset;
    });

    const conflictCodes = [...new Set(
      promotion.assetFileIds.flatMap((fileId) => fileOwners.get(fileId) ?? [])
    )]
      .filter((code) => code !== identity.sarimaSourceProductId)
      .sort();

    let status = baseBlockedStatus(promotion.imageStatus);
    let proposedAction: ExistingSarimaImageEnrichmentAction = "NONE";
    let matchedExistingImageAssetId: string | null = null;

    if (promotion.imageStatus === "EXACT_MATCH") {
      if (promotion.assetFileIds.length !== 1) {
        status = "BLOCKED_DUPLICATE_IMAGE";
      } else if (conflictCodes.length > 0) {
        status = "BLOCKED_CROSS_PRODUCT_FILE_CONFLICT";
      } else {
        const targetFileId = promotion.assetFileIds[0]!;
        const linkedAssets = product.imageAssets.filter(
          (asset) => sourceDriveFileId(asset.diagnostics) === targetFileId
        );

        if (linkedAssets.length > 1) {
          status = "BLOCKED_DUPLICATE_IMAGE";
        } else if (linkedAssets.length === 1) {
          matchedExistingImageAssetId = linkedAssets[0]!.id;
          proposedAction = "REUSE_ENGINE_ASSET";
        } else {
          proposedAction = "CREATE_ENGINE_ASSET";
        }
      }
    }

    return {
      productId: product.id,
      sku: product.sku,
      sarimaSourceProductId: identity.sarimaSourceProductId,
      name: product.name,
      status,
      proposedAction,
      catalogImageStatus: promotion.imageStatus,
      catalogImageFileIds: [...promotion.assetFileIds].sort(),
      catalogImageFilenames: driveAssets.map((asset) => asset.filename).sort(),
      catalogImageReason: promotion.imageReason,
      existingImageAssetIds: product.imageAssets.map((asset) => asset.id).sort(),
      activeImageAssetId: product.activeImageAssetId,
      matchedExistingImageAssetId,
      crossProductConflictCodes: conflictCodes
    };
  });

  return {
    summary: {
      products: rows.length,
      exactMatchCandidates: rows.filter((row) => row.catalogImageStatus === "EXACT_MATCH").length,
      readyCreateEngineAsset: rows.filter((row) => row.proposedAction === "CREATE_ENGINE_ASSET").length,
      readyReuseEngineAsset: rows.filter((row) => row.proposedAction === "REUSE_ENGINE_ASSET").length,
      blockedNeedsReview: rows.filter((row) => row.status === "BLOCKED_NEEDS_REVIEW").length,
      blockedVariantSizeMismatch: rows.filter((row) => row.status === "BLOCKED_VARIANT_SIZE_MISMATCH").length,
      blockedDuplicateImage: rows.filter((row) => row.status === "BLOCKED_DUPLICATE_IMAGE").length,
      blockedMissingImage: rows.filter((row) => row.status === "BLOCKED_MISSING_IMAGE").length,
      crossProductFileIdConflicts: rows.filter((row) => row.status === "BLOCKED_CROSS_PRODUCT_FILE_CONFLICT").length,
      existingDatabaseImageAssets: rows.reduce((count, row) => count + row.existingImageAssetIds.length, 0),
      existingActiveImages: rows.filter((row) => row.activeImageAssetId !== null).length
    },
    rows
  };
}
