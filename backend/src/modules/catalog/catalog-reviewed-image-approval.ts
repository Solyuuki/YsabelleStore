export type ReviewedCatalogImageApproval = {
  productCode: string;
  sourceNameNormalized: string;
  category: string;
  fileId: string;
  filename: string;
  mimeType: string;
  extension: string;
  folderId: string;
  folderName: string;
  sha256: string;
  reviewEvidence: string;
};

const REVIEWED_CATALOG_IMAGE_APPROVALS: Readonly<
  Record<string, ReviewedCatalogImageApproval>
> = Object.freeze({});

export function getReviewedCatalogImageApproval(
  productCode: string
): ReviewedCatalogImageApproval | null {
  const normalized = productCode.trim().toUpperCase();
  return REVIEWED_CATALOG_IMAGE_APPROVALS[normalized] ?? null;
}
