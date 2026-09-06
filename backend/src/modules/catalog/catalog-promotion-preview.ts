import type {
  CatalogImageReconciliation,
  ImageReconciliationStatus,
  SourceImageOutcome
} from "./catalog-image-reconciliation.js";
import type { SarimaSourceIdentity } from "./sarima-source-manifest.js";

export type CatalogPromotionIdentityStatus = "CANONICAL" | "DUPLICATE_ALIAS" | "BLOCKED_REVIEW";

export type CatalogPromotionPreviewRow = {
  productCode: string;
  sourceName: string;
  category: string;
  identityStatus: CatalogPromotionIdentityStatus;
  canonicalProductCode: string;
  imageStatus: ImageReconciliationStatus;
  assetFileIds: string[];
  identityReason: string;
  imageReason: string;
  priceReadiness: "UNVERIFIED_CURRENT_PRICE";
  inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK";
  operationalAction: "REQUIRES_DATABASE_AUDIT";
};

export type CatalogPromotionPreview = {
  sourceIdentityCount: number;
  canonicalIdentityCount: number;
  duplicateAliasCount: number;
  blockedIdentityCount: number;
  rows: CatalogPromotionPreviewRow[];
};

const TOKEN_EQUIVALENT_OVERLAP =
  /^Token-equivalent historical source identity overlaps (P\d{3})(?:, P\d{3})*;/;
const FAMILY_OVERLAP =
  /^Historical source identity shares the same product family with already-resolved (P\d{3})(?:, P\d{3})*;/;

function referencedCanonicalCode(outcome: SourceImageOutcome) {
  return (
    outcome.reason.match(TOKEN_EQUIVALENT_OVERLAP)?.[1] ??
    outcome.reason.match(FAMILY_OVERLAP)?.[1] ??
    null
  );
}

function identityStatusFor(outcome: SourceImageOutcome): CatalogPromotionIdentityStatus {
  if (TOKEN_EQUIVALENT_OVERLAP.test(outcome.reason)) {
    return "DUPLICATE_ALIAS";
  }

  if (FAMILY_OVERLAP.test(outcome.reason)) {
    return "BLOCKED_REVIEW";
  }

  return "CANONICAL";
}

function assertCompleteCoverage(
  sources: SarimaSourceIdentity[],
  reconciliation: CatalogImageReconciliation
) {
  const sourceCodes = sources.map((source) => source.productCode);
  const outcomeCodes = reconciliation.sourceOutcomes.map((outcome) => outcome.productCode);
  const sourceSet = new Set(sourceCodes);
  const outcomeSet = new Set(outcomeCodes);

  const complete =
    sourceCodes.length === sourceSet.size &&
    outcomeCodes.length === outcomeSet.size &&
    sourceSet.size === outcomeSet.size &&
    sourceCodes.every((code) => outcomeSet.has(code));

  if (!complete) {
    throw new Error(
      "Catalog promotion preview requires reconciliation to cover every SARIMA source identity exactly once."
    );
  }
}

export function buildCatalogPromotionPreview(
  sources: SarimaSourceIdentity[],
  reconciliation: CatalogImageReconciliation
): CatalogPromotionPreview {
  assertCompleteCoverage(sources, reconciliation);

  const outcomes = new Map(
    reconciliation.sourceOutcomes.map((outcome) => [outcome.productCode, outcome])
  );

  const rows = [...sources]
    .sort((left, right) => left.productCode.localeCompare(right.productCode))
    .map((source): CatalogPromotionPreviewRow => {
      const outcome = outcomes.get(source.productCode)!;
      const identityStatus = identityStatusFor(outcome);
      const referencedCode = referencedCanonicalCode(outcome);
      const canonicalProductCode =
        identityStatus === "CANONICAL"
          ? source.productCode
          : (referencedCode ?? source.productCode);

      return {
        productCode: source.productCode,
        sourceName: source.sourceName,
        category: source.category,
        identityStatus,
        canonicalProductCode,
        imageStatus: outcome.status,
        assetFileIds: [...outcome.assetFileIds],
        identityReason:
          identityStatus === "CANONICAL"
            ? "Historical SARIMA identity remains a distinct canonical candidate."
            : outcome.reason,
        imageReason: outcome.reason,
        priceReadiness: "UNVERIFIED_CURRENT_PRICE",
        inventoryReadiness: "UNVERIFIED_PHYSICAL_STOCK",
        operationalAction: "REQUIRES_DATABASE_AUDIT"
      };
    });

  return {
    sourceIdentityCount: rows.length,
    canonicalIdentityCount: rows.filter((row) => row.identityStatus === "CANONICAL").length,
    duplicateAliasCount: rows.filter((row) => row.identityStatus === "DUPLICATE_ALIAS").length,
    blockedIdentityCount: rows.filter((row) => row.identityStatus === "BLOCKED_REVIEW").length,
    rows
  };
}
