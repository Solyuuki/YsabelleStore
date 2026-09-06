import type {
  CatalogImageReconciliation,
  SourceImageOutcome
} from "./catalog-image-reconciliation.js";
import type { DriveImageAsset } from "./drive-image-manifest.js";
import type { SarimaSourceIdentity } from "./sarima-source-manifest.js";

export type ReviewedCatalogImageExecutionTarget = {
  productCode: string;
  expectedSku: string;
  sourceName: string;
  sourceNameNormalized: string;
  category: string;
  fileId: string;
  filename: string;
  mimeType: string;
  extension: string;
  folderId: string;
  folderName: string;
};

function exactlyOne<T>(rows: T[], message: string): T {
  if (rows.length !== 1) throw new Error(message);
  return rows[0]!;
}

export function buildReviewedCatalogImageExecutionTarget(input: {
  productCode: string;
  sources: SarimaSourceIdentity[];
  images: DriveImageAsset[];
  reconciliation: CatalogImageReconciliation;
}): ReviewedCatalogImageExecutionTarget {
  const productCode = input.productCode.trim().toUpperCase();
  if (!/^P\d{3}$/.test(productCode)) {
    throw new Error(`CATALOG_REVIEWED_IMAGE_INVALID_PRODUCT_CODE: ${input.productCode}`);
  }

  const source = exactlyOne(
    input.sources.filter((row) => row.productCode === productCode),
    `CATALOG_REVIEWED_IMAGE_SOURCE_IDENTITY_MISMATCH: expected exactly one source row for ${productCode}`
  );
  const outcome = exactlyOne<SourceImageOutcome>(
    input.reconciliation.sourceOutcomes.filter((row) => row.productCode === productCode),
    `CATALOG_REVIEWED_IMAGE_RECONCILIATION_MISMATCH: expected exactly one reconciliation row for ${productCode}`
  );

  if (outcome.status !== "EXACT_MATCH" || outcome.assetFileIds.length !== 1) {
    throw new Error(
      `CATALOG_REVIEWED_IMAGE_NOT_APPROVED: ${productCode} is ${outcome.status} with ${outcome.assetFileIds.length} asset(s)`
    );
  }

  const fileId = outcome.assetFileIds[0]!;
  const asset = exactlyOne(
    input.images.filter((row) => row.fileId === fileId),
    `CATALOG_REVIEWED_IMAGE_DRIVE_ASSET_MISMATCH: expected exactly one Drive asset ${fileId} for ${productCode}`
  );

  if (!asset.mimeType.startsWith("image/")) {
    throw new Error(
      `CATALOG_REVIEWED_IMAGE_NON_IMAGE_ASSET: ${productCode} resolved to ${asset.mimeType}`
    );
  }

  return {
    productCode,
    expectedSku: `SARIMA-${productCode}`,
    sourceName: source.sourceName,
    sourceNameNormalized: source.sourceNameNormalized,
    category: source.category,
    fileId: asset.fileId,
    filename: asset.filename,
    mimeType: asset.mimeType,
    extension: asset.extension,
    folderId: asset.folderId,
    folderName: asset.folderName
  };
}
