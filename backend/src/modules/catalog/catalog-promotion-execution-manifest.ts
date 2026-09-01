import type {
  OperationalCatalogAudit,
  OperationalCatalogCandidateRow
} from "./catalog-operational-audit.js";
import type {
  CatalogPromotionPreview,
  CatalogPromotionPreviewRow
} from "./catalog-promotion-preview.js";

export type PromotionExecutionSource = {
  productCode: string;
  sourceName: string;
  category: string;
};

export type PromotionWriteReadiness = "READY_TO_CREATE" | "BLOCKED_REQUIRED_FIELDS";

export type PromotionExecutionManifestRow = {
  productCode: string;
  plannedSku: string;
  plannedName: string;
  plannedCategory: string;
  plannedSellingPrice: number | null;
  plannedUnit: string | null;
  plannedInventoryQuantity: number | null;
  plannedStorefrontVisible: false;
  plannedDataQualityStatus: "NEEDS_REVIEW";
  plannedRecordSource: "IMPORT";
  imageStatus: CatalogPromotionPreviewRow["imageStatus"];
  assetFileIds: string[];
  priceReadiness: CatalogPromotionPreviewRow["priceReadiness"];
  inventoryReadiness: CatalogPromotionPreviewRow["inventoryReadiness"];
  writeReadiness: PromotionWriteReadiness;
  blockingFields: Array<"sellingPrice" | "unit">;
};

export type CatalogPromotionExecutionManifest = {
  summary: {
    promotionCandidates: number;
    newCandidates: number;
    readyToCreate: number;
    blockedForRequiredFields: number;
    excludedExisting: number;
    excludedDuplicateAliases: number;
    excludedBlocked: number;
  };
  rows: PromotionExecutionManifestRow[];
};

export type BuildPromotionExecutionManifestInput = {
  preview: CatalogPromotionPreview;
  audit: OperationalCatalogAudit;
  sources: PromotionExecutionSource[];
};

function assertUniqueCoverage(
  preview: CatalogPromotionPreview,
  audit: OperationalCatalogAudit,
  sources: PromotionExecutionSource[]
) {
  const previewCodes = preview.rows.map((row) => row.productCode);
  const auditCodes = audit.candidateRows.map((row) => row.productCode);
  const sourceCodes = sources.map((row) => row.productCode);

  const isExactSet = (candidateCodes: string[]) => {
    const candidateSet = new Set(candidateCodes);
    const previewSet = new Set(previewCodes);
    return (
      candidateCodes.length === candidateSet.size &&
      candidateSet.size === previewSet.size &&
      previewCodes.every((code) => candidateSet.has(code))
    );
  };

  if (!isExactSet(auditCodes)) {
    throw new Error("Operational audit must cover every promotion preview product code exactly once.");
  }

  if (!isExactSet(sourceCodes)) {
    throw new Error("Source manifest must cover every promotion preview product code exactly once.");
  }
}

function auditIndex(rows: OperationalCatalogCandidateRow[]) {
  return new Map(rows.map((row) => [row.productCode, row]));
}

export function buildCatalogPromotionExecutionManifest(
  input: BuildPromotionExecutionManifestInput
): CatalogPromotionExecutionManifest {
  const { preview, audit, sources } = input;
  assertUniqueCoverage(preview, audit, sources);

  const audits = auditIndex(audit.candidateRows);
  const previews = new Map(preview.rows.map((row) => [row.productCode, row]));
  const sourceIndex = new Map(sources.map((row) => [row.productCode, row]));

  const newAuditRows = audit.candidateRows
    .filter((row) => row.status === "NEW")
    .sort((left, right) => left.productCode.localeCompare(right.productCode));

  const rows = newAuditRows.map((auditRow): PromotionExecutionManifestRow => {
    const previewRow = previews.get(auditRow.productCode)!;
    const source = sourceIndex.get(auditRow.productCode)!;
    const blockingFields: Array<"sellingPrice" | "unit"> = [];

    // Current selling price and unit are required Product fields, but Phase 9
    // source evidence does not verify either value for new operational rows.
    blockingFields.push("sellingPrice", "unit");

    return {
      productCode: auditRow.productCode,
      plannedSku: `SARIMA-${auditRow.productCode}`,
      plannedName: source.sourceName,
      plannedCategory: source.category,
      plannedSellingPrice: null,
      plannedUnit: null,
      plannedInventoryQuantity: null,
      plannedStorefrontVisible: false,
      plannedDataQualityStatus: "NEEDS_REVIEW",
      plannedRecordSource: "IMPORT",
      imageStatus: previewRow.imageStatus,
      assetFileIds: [...previewRow.assetFileIds],
      priceReadiness: previewRow.priceReadiness,
      inventoryReadiness: previewRow.inventoryReadiness,
      writeReadiness:
        blockingFields.length === 0 ? "READY_TO_CREATE" : "BLOCKED_REQUIRED_FIELDS",
      blockingFields
    };
  });

  return {
    summary: {
      promotionCandidates: preview.rows.length,
      newCandidates: rows.length,
      readyToCreate: rows.filter((row) => row.writeReadiness === "READY_TO_CREATE").length,
      blockedForRequiredFields: rows.filter(
        (row) => row.writeReadiness === "BLOCKED_REQUIRED_FIELDS"
      ).length,
      excludedExisting: audit.candidateRows.filter((row) => row.status === "EXISTING").length,
      excludedDuplicateAliases: audit.candidateRows.filter(
        (row) => row.status === "DUPLICATE_ALIAS"
      ).length,
      excludedBlocked: audit.candidateRows.filter((row) => row.status === "BLOCKED").length
    },
    rows
  };
}
