import type { CatalogDriveMaterializationResult } from "./catalog-image-drive-materialization.js";
import type { CatalogImageSourceSelection } from "./catalog-image-source-selection.js";

export type CatalogImageRemediationReason =
  | "DRIVE_MATERIALIZATION_FAILED"
  | "CIQE_REJECTED"
  | "RECONCILIATION_REQUIRES_WEB";

export type CatalogImageRemediationCandidate = {
  productCode: string;
  productId: string;
  name: string;
  reason: CatalogImageRemediationReason;
  driveAttempts: number | null;
  driveError: string | null;
  diagnosticCodes: string[];
};

export type CatalogImageRemediationResult = {
  summary: {
    products: number;
    ciqeApproved: number;
    webFallbackCandidates: number;
    driveMaterializationFailed: number;
    ciqeRejected: number;
    reconciliationRequiresWeb: number;
    blockedIdentityReview: number;
    processErrors: number;
  };
  rows: CatalogImageRemediationCandidate[];
};

type CiqeDiagnostic = {
  code?: unknown;
};

type CiqeResultRow = {
  productCode: string;
  status: string;
  diagnostics?: unknown;
};

type CiqeSummary = {
  counts: {
    APPROVED: number;
    REJECTED: number;
    PROCESS_ERROR: number;
  };
  results: CiqeResultRow[];
};

function diagnosticCodes(value: unknown): string[] {
  const diagnostics = Array.isArray(value) ? value : value ? [value] : [];
  return diagnostics
    .map((item) => (item as CiqeDiagnostic)?.code)
    .filter((code): code is string => typeof code === "string" && code.trim().length > 0)
    .map((code) => code.trim())
    .sort();
}

export function buildCatalogImageRemediationCandidates(input: {
  selection: CatalogImageSourceSelection;
  materializations: CatalogDriveMaterializationResult[];
  ciqe: CiqeSummary;
  maxDriveAttempts: number;
}): CatalogImageRemediationResult {
  if (!Number.isInteger(input.maxDriveAttempts) || input.maxDriveAttempts < 1) {
    throw new Error("CATALOG_IMAGE_REMEDIATION_INVALID_ATTEMPTS: maxDriveAttempts must be a positive integer");
  }

  const materializationByProductCode = new Map(
    input.materializations.map((row) => [row.productCode, row])
  );
  const ciqeByProductCode = new Map(input.ciqe.results.map((row) => [row.productCode, row]));
  const rows: CatalogImageRemediationCandidate[] = [];

  for (const selectionRow of input.selection.rows) {
    if (selectionRow.status === "BLOCKED_IDENTITY_REVIEW") continue;

    if (selectionRow.status === "NEEDS_LICENSED_WEB_FALLBACK") {
      rows.push({
        productCode: selectionRow.productCode,
        productId: selectionRow.productId,
        name: selectionRow.name,
        reason: "RECONCILIATION_REQUIRES_WEB",
        driveAttempts: null,
        driveError: null,
        diagnosticCodes: []
      });
      continue;
    }

    if (selectionRow.status === "NEEDS_DRIVE_MATERIALIZATION") {
      const materialization = materializationByProductCode.get(selectionRow.productCode);
      if (
        materialization &&
        !materialization.usable &&
        materialization.attempts >= input.maxDriveAttempts
      ) {
        rows.push({
          productCode: selectionRow.productCode,
          productId: selectionRow.productId,
          name: selectionRow.name,
          reason: "DRIVE_MATERIALIZATION_FAILED",
          driveAttempts: materialization.attempts,
          driveError: materialization.error,
          diagnosticCodes: []
        });
      }
      continue;
    }

    const ciqe = ciqeByProductCode.get(selectionRow.productCode);
    if (ciqe?.status === "REJECTED") {
      const materialization = materializationByProductCode.get(selectionRow.productCode);
      rows.push({
        productCode: selectionRow.productCode,
        productId: selectionRow.productId,
        name: selectionRow.name,
        reason: "CIQE_REJECTED",
        driveAttempts: materialization?.attempts ?? null,
        driveError: null,
        diagnosticCodes: diagnosticCodes(ciqe.diagnostics)
      });
    }
  }

  rows.sort((left, right) => left.productCode.localeCompare(right.productCode));

  return {
    summary: {
      products: input.selection.summary.products,
      ciqeApproved: input.ciqe.counts.APPROVED,
      webFallbackCandidates: rows.length,
      driveMaterializationFailed: rows.filter(
        (row) => row.reason === "DRIVE_MATERIALIZATION_FAILED"
      ).length,
      ciqeRejected: rows.filter((row) => row.reason === "CIQE_REJECTED").length,
      reconciliationRequiresWeb: rows.filter(
        (row) => row.reason === "RECONCILIATION_REQUIRES_WEB"
      ).length,
      blockedIdentityReview: input.selection.summary.blockedIdentityReview,
      processErrors: input.ciqe.counts.PROCESS_ERROR
    },
    rows
  };
}
