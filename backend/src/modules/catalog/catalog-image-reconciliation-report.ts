import type {
  CatalogImageReconciliation,
  ImageReconciliationStatus
} from "./catalog-image-reconciliation.js";

export type ImageReconciliationReport = {
  sourceCount: number;
  driveAssetCount: number;
  statusCounts: Record<ImageReconciliationStatus | "DRIVE_ONLY", number>;
  missingProductCodes: string[];
};

function csvCell(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildImageReconciliationReport(
  reconciliation: CatalogImageReconciliation,
  sourceCount: number,
  driveAssetCount: number
): ImageReconciliationReport {
  const statusCounts: ImageReconciliationReport["statusCounts"] = {
    EXACT_MATCH: 0,
    NEEDS_REVIEW: 0,
    VARIANT_SIZE_MISMATCH: 0,
    DUPLICATE_IMAGE: 0,
    MISSING_IMAGE: 0,
    DRIVE_ONLY: reconciliation.driveOnlyAssets.length
  };

  for (const outcome of reconciliation.sourceOutcomes) {
    statusCounts[outcome.status] += 1;
  }

  return {
    sourceCount,
    driveAssetCount,
    statusCounts,
    missingProductCodes: reconciliation.sourceOutcomes
      .filter((outcome) => outcome.status === "MISSING_IMAGE")
      .map((outcome) => outcome.productCode)
      .sort()
  };
}

export function toImageReconciliationCsv(reconciliation: CatalogImageReconciliation) {
  const rows: string[][] = [
    ["productCode", "sourceName", "status", "fileId", "filename", "folderName", "reason"]
  ];

  for (const outcome of reconciliation.sourceOutcomes) {
    if (outcome.assetFileIds.length === 0) {
      rows.push([
        outcome.productCode,
        outcome.sourceName,
        outcome.status,
        "",
        "",
        "",
        outcome.reason
      ]);
      continue;
    }

    for (const fileId of outcome.assetFileIds) {
      rows.push([
        outcome.productCode,
        outcome.sourceName,
        outcome.status,
        fileId,
        "",
        "",
        outcome.reason
      ]);
    }
  }

  for (const asset of reconciliation.driveOnlyAssets) {
    rows.push(["", "", "DRIVE_ONLY", asset.fileId, asset.filename, asset.folderName, asset.reason]);
  }

  return `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
}

function sourceLines(
  reconciliation: CatalogImageReconciliation,
  status: ImageReconciliationStatus
) {
  const matches = reconciliation.sourceOutcomes.filter((outcome) => outcome.status === status);
  if (matches.length === 0) return ["- None"];

  return matches.map(
    (outcome) =>
      `- ${outcome.productCode} — ${outcome.sourceName}${
        outcome.assetFileIds.length > 0 ? ` — Drive IDs: ${outcome.assetFileIds.join(", ")}` : ""
      } — ${outcome.reason}`
  );
}

export function toImageReconciliationMarkdown(
  report: ImageReconciliationReport,
  reconciliation: CatalogImageReconciliation
) {
  const statusOrder: Array<ImageReconciliationStatus | "DRIVE_ONLY"> = [
    "EXACT_MATCH",
    "NEEDS_REVIEW",
    "VARIANT_SIZE_MISMATCH",
    "DUPLICATE_IMAGE",
    "MISSING_IMAGE",
    "DRIVE_ONLY"
  ];

  const driveOnlyLines =
    reconciliation.driveOnlyAssets.length === 0
      ? ["- None"]
      : reconciliation.driveOnlyAssets.map(
          (asset) =>
            `- ${asset.filename} — ${asset.folderName} — Drive ID: ${asset.fileId} — ${asset.reason}`
        );

  return [
    "# Phase 9 Image Reconciliation Report",
    "",
    `SARIMA source identities: **${report.sourceCount}**`,
    `Raw Google Drive image assets: **${report.driveAssetCount}**`,
    "",
    "No operational Product, Inventory, InventoryBatch, or current-price data was modified by this reconciliation.",
    "",
    "## Status Summary",
    "",
    "| Status | Count |",
    "| --- | ---: |",
    ...statusOrder.map((status) => `| ${status} | ${report.statusCounts[status]} |`),
    "",
    "## Needs Review",
    "",
    ...sourceLines(reconciliation, "NEEDS_REVIEW"),
    "",
    "## Variant / Size Mismatches",
    "",
    ...sourceLines(reconciliation, "VARIANT_SIZE_MISMATCH"),
    "",
    "## Duplicate Images",
    "",
    ...sourceLines(reconciliation, "DUPLICATE_IMAGE"),
    "",
    "## Missing Images",
    "",
    ...sourceLines(reconciliation, "MISSING_IMAGE"),
    "",
    "## Drive-only Assets",
    "",
    ...driveOnlyLines,
    ""
  ].join("\n");
}
