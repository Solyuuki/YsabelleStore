import { EXISTING_SARIMA_REHABILITATION_IDENTITIES } from "./catalog-existing-sarima-rehabilitation-readiness.js";

export const EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES =
  EXISTING_SARIMA_REHABILITATION_IDENTITIES.filter((row) => row.sarimaSourceProductId !== "P144");

export type BarcodeEvidenceSourceType =
  | "MANUFACTURER"
  | "AUTHORIZED_DISTRIBUTOR"
  | "RETAILER"
  | "MARKETPLACE"
  | "OTHER";

export type BarcodeEvidenceSource = {
  sourceType: BarcodeEvidenceSourceType;
  sourceName: string;
  url: string;
  observedBarcode: string | null;
  exactProductIdentity: boolean;
  exactRetailUnit: boolean;
  independentSourceKey: string;
};

export type ExistingSarimaBarcodeEvidenceInput = {
  productId: string;
  sku: string;
  sarimaSourceProductId: string;
  candidateBarcode: string | null;
  conflictReason?: string;
  sources: BarcodeEvidenceSource[];
};

export type ExistingSarimaBarcodeProduct = {
  id: string;
  sku: string;
  sarimaSourceProductId: string;
  name: string;
  barcode: string | null;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
};

export type ExistingSarimaBarcodeEvidenceStatus =
  | "VERIFIED_EXTERNAL"
  | "NEEDS_PHYSICAL_SCAN"
  | "CONFLICTING_EVIDENCE"
  | "NOT_FOUND";

export type ExistingSarimaBarcodeEvidenceRow = {
  productId: string;
  sku: string;
  sarimaSourceProductId: string;
  name: string;
  status: ExistingSarimaBarcodeEvidenceStatus;
  candidateBarcode: string | null;
  verifiedBarcode: string | null;
  sourceCount: number;
  exactUnitSourceCount: number;
  authoritativeExactUnitSourceCount: number;
  independentRetailerExactUnitSourceCount: number;
  conflictReason: string | null;
  sources: BarcodeEvidenceSource[];
};

export type ExistingSarimaBarcodeEvidence = {
  summary: {
    products: number;
    verifiedExternal: number;
    needsPhysicalScan: number;
    conflictingEvidence: number;
    notFound: number;
  };
  rows: ExistingSarimaBarcodeEvidenceRow[];
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

export function isValidGtin(value: string): boolean {
  if (!/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(value)) return false;

  const digits = value.split("").map(Number);
  const checkDigit = digits.pop();
  if (checkDigit === undefined) return false;

  let weightedSum = 0;
  [...digits].reverse().forEach((digit, index) => {
    weightedSum += digit * (index % 2 === 0 ? 3 : 1);
  });

  return (10 - (weightedSum % 10)) % 10 === checkDigit;
}

function isAuthoritative(source: BarcodeEvidenceSource) {
  return source.sourceType === "MANUFACTURER" || source.sourceType === "AUTHORIZED_DISTRIBUTOR";
}

function exactUnitSources(entry: ExistingSarimaBarcodeEvidenceInput) {
  return entry.sources.filter((source) => source.exactProductIdentity && source.exactRetailUnit);
}

function matchesCandidate(source: BarcodeEvidenceSource, candidateBarcode: string) {
  return source.observedBarcode === candidateBarcode;
}

function determineStatus(
  entry: ExistingSarimaBarcodeEvidenceInput
): ExistingSarimaBarcodeEvidenceStatus {
  if (entry.conflictReason) return "CONFLICTING_EVIDENCE";
  if (!entry.candidateBarcode && entry.sources.length === 0) return "NOT_FOUND";
  if (!entry.candidateBarcode || !isValidGtin(entry.candidateBarcode)) return "NEEDS_PHYSICAL_SCAN";

  const exact = exactUnitSources(entry).filter((source) =>
    matchesCandidate(source, entry.candidateBarcode!)
  );
  const authoritative = exact.filter(isAuthoritative);
  if (authoritative.length > 0) return "VERIFIED_EXTERNAL";

  const retailerKeys = new Set(
    exact
      .filter((source) => source.sourceType === "RETAILER")
      .map((source) => source.independentSourceKey)
  );
  if (retailerKeys.size >= 2) return "VERIFIED_EXTERNAL";

  return "NEEDS_PHYSICAL_SCAN";
}

export function buildExistingSarimaBarcodeEvidence(input: {
  products: ExistingSarimaBarcodeProduct[];
  evidence: ExistingSarimaBarcodeEvidenceInput[];
}): ExistingSarimaBarcodeEvidence {
  if (input.products.length !== input.evidence.length) {
    fail(
      "EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITY_MISMATCH",
      `expected one evidence row per product; products=${input.products.length}, evidence=${input.evidence.length}`
    );
  }

  const evidenceByProductId = new Map(input.evidence.map((row) => [row.productId, row]));

  const rows = input.products
    .map((product): ExistingSarimaBarcodeEvidenceRow => {
      if (
        product.recordSource !== "IMPORT" ||
        product.status !== "INACTIVE" ||
        product.dataQualityStatus !== "NEEDS_REVIEW" ||
        product.isStorefrontVisible !== false ||
        product.barcode !== null
      ) {
        fail(
          "EXISTING_SARIMA_BARCODE_EVIDENCE_STATE_MISMATCH",
          `${product.id} must remain IMPORT + INACTIVE + NEEDS_REVIEW + hidden + barcode null during evidence collection`
        );
      }

      const evidence = evidenceByProductId.get(product.id);
      if (
        !evidence ||
        evidence.sku !== product.sku ||
        evidence.sarimaSourceProductId !== product.sarimaSourceProductId
      ) {
        fail(
          "EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITY_MISMATCH",
          `${product.id} evidence no longer matches product/SARIMA identity`
        );
      }

      const status = determineStatus(evidence);
      const exact = exactUnitSources(evidence).filter((source) =>
        evidence.candidateBarcode ? matchesCandidate(source, evidence.candidateBarcode) : false
      );
      const authoritative = exact.filter(isAuthoritative);
      const retailerKeys = new Set(
        exact
          .filter((source) => source.sourceType === "RETAILER")
          .map((source) => source.independentSourceKey)
      );

      return {
        productId: product.id,
        sku: product.sku,
        sarimaSourceProductId: product.sarimaSourceProductId,
        name: product.name,
        status,
        candidateBarcode: evidence.candidateBarcode,
        verifiedBarcode: status === "VERIFIED_EXTERNAL" ? evidence.candidateBarcode : null,
        sourceCount: evidence.sources.length,
        exactUnitSourceCount: exact.length,
        authoritativeExactUnitSourceCount: authoritative.length,
        independentRetailerExactUnitSourceCount: retailerKeys.size,
        conflictReason: evidence.conflictReason ?? null,
        sources: evidence.sources.map((source) => ({ ...source }))
      };
    })
    .sort((left, right) => left.sarimaSourceProductId.localeCompare(right.sarimaSourceProductId));

  const count = (status: ExistingSarimaBarcodeEvidenceStatus) =>
    rows.filter((row) => row.status === status).length;

  return {
    summary: {
      products: rows.length,
      verifiedExternal: count("VERIFIED_EXTERNAL"),
      needsPhysicalScan: count("NEEDS_PHYSICAL_SCAN"),
      conflictingEvidence: count("CONFLICTING_EVIDENCE"),
      notFound: count("NOT_FOUND")
    },
    rows
  };
}
