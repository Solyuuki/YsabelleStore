export type ReviewedCatalogImageApproval = {
  productCode: string;
  sourceNameNormalized: string;
  category: string;
  fileId: string;
  filename: string;
  normalizedStem: string;
  mimeType: string;
  extension: string;
  folderId: string;
  folderName: string;
  sha256: string;
  fileSizeBytes: number;
  reviewEvidence: string;
};

const REVIEWED_CATALOG_IMAGE_APPROVALS: Readonly<
  Record<string, ReviewedCatalogImageApproval>
> = Object.freeze({
  P132: Object.freeze({
    productCode: "P132",
    sourceNameNormalized: "bathroom tissue roll tissue pack",
    category: "Tissue & Cotton",
    fileId: "17ZwteNRUJ1ShzSyU3YNoSDb1xOJTsJzZ",
    filename: "athroom Tissue Roll  Tissue Pack.jpg",
    normalizedStem: "athroom tissue roll tissue pack",
    mimeType: "image/jpeg",
    extension: ".jpg",
    folderId: "1NY76Nb4AlGqXcpW5B99_STKlN1hhX4M6",
    folderName: "Tissue & Cotton",
    sha256: "359dd332c8c239951ebd0e55e1857f93879bb8e6bf123de55675d1dd7fc1e1f0",
    fileSizeBytes: 15877,
    reviewEvidence:
      "2026-09-07 manual visual review confirmed a bulk pack of white bathroom tissue rolls; current Drive metadata and downloaded bytes were independently verified."
  })
});

export function getReviewedCatalogImageApproval(
  productCode: string
): ReviewedCatalogImageApproval | null {
  const normalized = productCode.trim().toUpperCase();
  return REVIEWED_CATALOG_IMAGE_APPROVALS[normalized] ?? null;
}
