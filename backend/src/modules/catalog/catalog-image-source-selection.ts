import type { ExistingSarimaImageEnrichmentPreviewRow } from "./catalog-existing-sarima-image-enrichment-preview.js";
import type { ExistingSarimaPromotionEvidence } from "./catalog-existing-sarima-rehabilitation-readiness.js";

export type CatalogDriveImageMaterialization = {
  productCode: string;
  fileId: string;
  sourcePath: string;
  usable: boolean;
};

export type CatalogLicensedWebImageEvidence = {
  productCode: string;
  sourceAssetId: string;
  sourceType: "MANUFACTURER" | "AUTHORIZED_SUPPLIER" | "LICENSED_LIBRARY" | "RETAILER" | "OTHER";
  provider: string;
  sourceUrl: string;
  licenseBasis: string;
  licenseUrl: string | null;
  commercialUseAllowed: boolean;
  exactProductIdentity: boolean;
  exactRetailUnit: boolean;
  watermarkFree: boolean;
  sourcePath: string;
  retrievedAt: string;
};

export type CatalogImageSelectedSourceKind = "DRIVE" | "LICENSED_WEB";

export type CatalogImageSourceSelectionStatus =
  | "READY_DRIVE"
  | "READY_LICENSED_WEB"
  | "NEEDS_DRIVE_MATERIALIZATION"
  | "NEEDS_LICENSED_WEB_FALLBACK"
  | "BLOCKED_IDENTITY_REVIEW";

export type CatalogImageSourceSelectionRow = {
  productCode: string;
  productId: string;
  name: string;
  status: CatalogImageSourceSelectionStatus;
  selectedSourceKind: CatalogImageSelectedSourceKind | null;
  selectedSourceReference: string | null;
  selectedSourcePath: string | null;
  sourceUrl: string | null;
  licenseBasis: string | null;
  licenseUrl: string | null;
};

export type CatalogImageSourceSelection = {
  rows: CatalogImageSourceSelectionRow[];
  summary: {
    products: number;
    readyDrive: number;
    readyLicensedWeb: number;
    needsDriveMaterialization: number;
    needsLicensedWebFallback: number;
    blockedIdentityReview: number;
  };
};

export type CatalogImageEngineJob = {
  productCode: string;
  fileId: string;
  sourcePath: string;
  reconciliationStatus: "EXACT_MATCH";
};

function isLicensedWebEvidenceUsable(evidence: CatalogLicensedWebImageEvidence) {
  const allowedSourceType =
    evidence.sourceType === "MANUFACTURER" ||
    evidence.sourceType === "AUTHORIZED_SUPPLIER" ||
    evidence.sourceType === "LICENSED_LIBRARY";

  return (
    allowedSourceType &&
    evidence.commercialUseAllowed &&
    evidence.exactProductIdentity &&
    evidence.exactRetailUnit &&
    evidence.watermarkFree &&
    evidence.licenseBasis.trim().length > 0 &&
    evidence.sourceUrl.trim().length > 0 &&
    evidence.sourcePath.trim().length > 0
  );
}

function chooseLicensedWebEvidence(
  evidence: CatalogLicensedWebImageEvidence[]
): CatalogLicensedWebImageEvidence | null {
  const usable = evidence.filter(isLicensedWebEvidenceUsable);
  if (usable.length !== 1) return null;
  return usable[0]!;
}

export function buildCatalogImageSourceSelection(input: {
  rows: ExistingSarimaImageEnrichmentPreviewRow[];
  promotionRows: ExistingSarimaPromotionEvidence[];
  driveMaterializations: CatalogDriveImageMaterialization[];
  webEvidence: CatalogLicensedWebImageEvidence[];
}): CatalogImageSourceSelection {
  const promotionByCode = new Map(input.promotionRows.map((row) => [row.productCode, row]));
  const driveByProductCode = new Map<string, CatalogDriveImageMaterialization[]>();
  const webByProductCode = new Map<string, CatalogLicensedWebImageEvidence[]>();

  for (const materialization of input.driveMaterializations) {
    const rows = driveByProductCode.get(materialization.productCode) ?? [];
    rows.push(materialization);
    driveByProductCode.set(materialization.productCode, rows);
  }

  for (const evidence of input.webEvidence) {
    const rows = webByProductCode.get(evidence.productCode) ?? [];
    rows.push(evidence);
    webByProductCode.set(evidence.productCode, rows);
  }

  const rows = input.rows.map((row): CatalogImageSourceSelectionRow => {
    const promotion = promotionByCode.get(row.sarimaSourceProductId);
    if (!promotion) {
      throw new Error(
        `CATALOG_IMAGE_SOURCE_SELECTION_IDENTITY_MISMATCH: missing promotion row for ${row.sarimaSourceProductId}`
      );
    }

    if (promotion.identityStatus !== "CANONICAL") {
      return {
        productCode: row.sarimaSourceProductId,
        productId: row.productId,
        name: row.name,
        status: "BLOCKED_IDENTITY_REVIEW",
        selectedSourceKind: null,
        selectedSourceReference: null,
        selectedSourcePath: null,
        sourceUrl: null,
        licenseBasis: null,
        licenseUrl: null
      };
    }

    if (row.catalogImageStatus === "EXACT_MATCH") {
      const expectedFileId =
        row.catalogImageFileIds.length === 1 ? row.catalogImageFileIds[0]! : null;
      const materializations = (driveByProductCode.get(row.sarimaSourceProductId) ?? []).filter(
        (entry) =>
          entry.usable && entry.fileId === expectedFileId && entry.sourcePath.trim().length > 0
      );

      if (expectedFileId && materializations.length === 1) {
        const selected = materializations[0]!;
        return {
          productCode: row.sarimaSourceProductId,
          productId: row.productId,
          name: row.name,
          status: "READY_DRIVE",
          selectedSourceKind: "DRIVE",
          selectedSourceReference: selected.fileId,
          selectedSourcePath: selected.sourcePath,
          sourceUrl: null,
          licenseBasis: null,
          licenseUrl: null
        };
      }

      return {
        productCode: row.sarimaSourceProductId,
        productId: row.productId,
        name: row.name,
        status: "NEEDS_DRIVE_MATERIALIZATION",
        selectedSourceKind: null,
        selectedSourceReference: null,
        selectedSourcePath: null,
        sourceUrl: null,
        licenseBasis: null,
        licenseUrl: null
      };
    }

    const selectedWeb = chooseLicensedWebEvidence(
      webByProductCode.get(row.sarimaSourceProductId) ?? []
    );
    if (selectedWeb) {
      return {
        productCode: row.sarimaSourceProductId,
        productId: row.productId,
        name: row.name,
        status: "READY_LICENSED_WEB",
        selectedSourceKind: "LICENSED_WEB",
        selectedSourceReference: selectedWeb.sourceAssetId,
        selectedSourcePath: selectedWeb.sourcePath,
        sourceUrl: selectedWeb.sourceUrl,
        licenseBasis: selectedWeb.licenseBasis,
        licenseUrl: selectedWeb.licenseUrl
      };
    }

    return {
      productCode: row.sarimaSourceProductId,
      productId: row.productId,
      name: row.name,
      status: "NEEDS_LICENSED_WEB_FALLBACK",
      selectedSourceKind: null,
      selectedSourceReference: null,
      selectedSourcePath: null,
      sourceUrl: null,
      licenseBasis: null,
      licenseUrl: null
    };
  });

  return {
    rows,
    summary: {
      products: rows.length,
      readyDrive: rows.filter((row) => row.status === "READY_DRIVE").length,
      readyLicensedWeb: rows.filter((row) => row.status === "READY_LICENSED_WEB").length,
      needsDriveMaterialization: rows.filter((row) => row.status === "NEEDS_DRIVE_MATERIALIZATION")
        .length,
      needsLicensedWebFallback: rows.filter((row) => row.status === "NEEDS_LICENSED_WEB_FALLBACK")
        .length,
      blockedIdentityReview: rows.filter((row) => row.status === "BLOCKED_IDENTITY_REVIEW").length
    }
  };
}

export function buildCatalogImageEngineJobs(
  selection: CatalogImageSourceSelection
): CatalogImageEngineJob[] {
  return selection.rows
    .filter(
      (row) =>
        (row.status === "READY_DRIVE" || row.status === "READY_LICENSED_WEB") &&
        row.selectedSourceReference !== null &&
        row.selectedSourcePath !== null
    )
    .map((row) => ({
      productCode: row.productCode,
      fileId:
        row.selectedSourceKind === "LICENSED_WEB"
          ? `WEB:${row.selectedSourceReference!}`
          : row.selectedSourceReference!,
      sourcePath: row.selectedSourcePath!,
      reconciliationStatus: "EXACT_MATCH" as const
    }));
}
