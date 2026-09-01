import type { PromotionExecutionManifestRow } from "./catalog-promotion-execution-manifest.js";

export type ExplicitProductUnit = "BOTTLE" | "BOX" | "PACK" | "SACHET";
export type ProductUnitEvidence =
  | "EXPLICIT_BOTTLE"
  | "EXPLICIT_BOX"
  | "EXPLICIT_PACK"
  | "EXPLICIT_SACHET"
  | "REVIEW_REQUIRED";

export type PromotionRequiredFieldHistoricalProduct = {
  productCode: string;
  historicalSellingPrice2025: number;
};

export type PromotionRequiredFieldReadinessRow = {
  productCode: string;
  plannedSku: string;
  plannedName: string;
  historicalSellingPrice2025: number | null;
  historicalPriceMeaning: "LAST_RECORDED_HISTORICAL_PRICE_2025" | "UNAVAILABLE";
  currentSellingPrice: null;
  currentPriceReadiness: "UNVERIFIED";
  proposedUnit: ExplicitProductUnit | null;
  unitEvidence: ProductUnitEvidence;
  writeReadiness:
    | "BLOCKED_CURRENT_PRICE"
    | "BLOCKED_CURRENT_PRICE_AND_UNIT";
};

export type CatalogPromotionRequiredFieldReadiness = {
  summary: {
    candidates: number;
    historicalPriceEvidenceAvailable: number;
    currentPriceVerified: number;
    explicitUnitResolved: number;
    unitNeedsReview: number;
    readyToCreate: number;
  };
  rows: PromotionRequiredFieldReadinessRow[];
};

function hasWord(value: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:s)?(?:$|[^\\p{L}\\p{N}])`, "iu").test(
    value
  );
}

export function resolveExplicitProductUnit(name: string): {
  unit: ExplicitProductUnit | null;
  evidence: ProductUnitEvidence;
} {
  if (hasWord(name, "sachet")) {
    return { unit: "SACHET", evidence: "EXPLICIT_SACHET" };
  }

  if (hasWord(name, "bottle")) {
    return { unit: "BOTTLE", evidence: "EXPLICIT_BOTTLE" };
  }

  if (hasWord(name, "pack")) {
    return { unit: "PACK", evidence: "EXPLICIT_PACK" };
  }

  if (hasWord(name, "box")) {
    return { unit: "BOX", evidence: "EXPLICIT_BOX" };
  }

  return { unit: null, evidence: "REVIEW_REQUIRED" };
}

export function buildCatalogPromotionRequiredFieldReadiness(input: {
  executionRows: PromotionExecutionManifestRow[];
  historicalProducts: PromotionRequiredFieldHistoricalProduct[];
}): CatalogPromotionRequiredFieldReadiness {
  const historicalPriceByCode = new Map(
    input.historicalProducts.map((product) => [
      product.productCode,
      product.historicalSellingPrice2025
    ])
  );

  const rows = input.executionRows.map(
    (executionRow): PromotionRequiredFieldReadinessRow => {
      const historicalSellingPrice2025 =
        historicalPriceByCode.get(executionRow.productCode) ?? null;
      const unitResolution = resolveExplicitProductUnit(executionRow.plannedName);

      return {
        productCode: executionRow.productCode,
        plannedSku: executionRow.plannedSku,
        plannedName: executionRow.plannedName,
        historicalSellingPrice2025,
        historicalPriceMeaning:
          historicalSellingPrice2025 === null
            ? "UNAVAILABLE"
            : "LAST_RECORDED_HISTORICAL_PRICE_2025",
        currentSellingPrice: null,
        currentPriceReadiness: "UNVERIFIED",
        proposedUnit: unitResolution.unit,
        unitEvidence: unitResolution.evidence,
        writeReadiness:
          unitResolution.unit === null
            ? "BLOCKED_CURRENT_PRICE_AND_UNIT"
            : "BLOCKED_CURRENT_PRICE"
      };
    }
  );

  return {
    summary: {
      candidates: rows.length,
      historicalPriceEvidenceAvailable: rows.filter(
        (row) => row.historicalSellingPrice2025 !== null
      ).length,
      currentPriceVerified: 0,
      explicitUnitResolved: rows.filter((row) => row.proposedUnit !== null).length,
      unitNeedsReview: rows.filter((row) => row.proposedUnit === null).length,
      readyToCreate: 0
    },
    rows
  };
}
