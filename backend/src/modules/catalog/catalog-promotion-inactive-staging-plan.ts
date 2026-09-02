export type InactiveStagingExecutionRow = {
  productCode: string;
  plannedSku: string;
  plannedName: string;
  plannedCategory: string;
  imageStatus: string;
  assetFileIds: string[];
};

export type InactiveStagingReadinessRow = {
  productCode: string;
  historicalSellingPrice2025: number | null;
  historicalPriceMeaning: "LAST_RECORDED_HISTORICAL_PRICE_2025" | "UNAVAILABLE";
  currentSellingPrice: null;
  currentPriceReadiness: "UNVERIFIED";
  proposedUnit:
    | "PIECE"
    | "PACK"
    | "BOX"
    | "BOTTLE"
    | "SACHET"
    | "KILOGRAM"
    | "GRAM"
    | "LITER"
    | "MILLILITER"
    | null;
  unitEvidence:
    | "EXPLICIT_BOTTLE"
    | "EXPLICIT_BOX"
    | "EXPLICIT_PACK"
    | "EXPLICIT_SACHET"
    | "EXPLICIT_POUCH_AS_PACK"
    | "CATEGORY_SINGLE_RETAIL_ITEM"
    | "REVIEWED_PRODUCT_OVERRIDE"
    | "REVIEW_REQUIRED";
};

export type CatalogPromotionInactiveStagingRow = {
  productCode: string;
  plannedSku: string;
  plannedName: string;
  plannedCategory: string;
  plannedSellingPrice: number;
  sellingPriceProvenance: "LAST_RECORDED_HISTORICAL_PRICE_2025";
  sellingPriceUsage: "PROVISIONAL_INACTIVE_ONLY";
  currentSellingPrice: null;
  currentPriceReadiness: "UNVERIFIED";
  plannedUnit: Exclude<InactiveStagingReadinessRow["proposedUnit"], null>;
  unitEvidence: Exclude<InactiveStagingReadinessRow["unitEvidence"], "REVIEW_REQUIRED">;
  plannedStatus: "INACTIVE";
  plannedDataQualityStatus: "NEEDS_REVIEW";
  plannedRecordSource: "IMPORT";
  plannedStorefrontVisible: false;
  plannedCreateInventory: false;
  plannedCreateInventoryBatch: false;
  plannedCreateSarimaMapping: true;
  imageStatus: string;
  assetFileIds: string[];
  activationBlockers: Array<"CURRENT_SELLING_PRICE" | "PHYSICAL_STOCK" | "QUALITY_APPROVAL">;
};

export type CatalogPromotionInactiveStagingPlan = {
  summary: {
    candidates: number;
    stageableInactiveIdentities: number;
    blockedUnitReview: number;
    blockedHistoricalPriceEvidence: number;
    plannedInventoryRows: 0;
    plannedStorefrontVisible: 0;
    currentPriceVerified: 0;
  };
  stageableRows: CatalogPromotionInactiveStagingRow[];
};

export function buildCatalogPromotionInactiveStagingPlan(input: {
  executionRows: InactiveStagingExecutionRow[];
  readinessRows: InactiveStagingReadinessRow[];
}): CatalogPromotionInactiveStagingPlan {
  const executionByCode = new Map(input.executionRows.map((row) => [row.productCode, row]));

  const stageableRows: CatalogPromotionInactiveStagingRow[] = [];
  let blockedUnitReview = 0;
  let blockedHistoricalPriceEvidence = 0;

  for (const readiness of input.readinessRows) {
    const execution = executionByCode.get(readiness.productCode);
    if (!execution) {
      throw new Error(`Missing execution-manifest row for ${readiness.productCode}.`);
    }

    if (readiness.proposedUnit === null || readiness.unitEvidence === "REVIEW_REQUIRED") {
      blockedUnitReview += 1;
      continue;
    }

    if (
      readiness.historicalPriceMeaning !== "LAST_RECORDED_HISTORICAL_PRICE_2025" ||
      readiness.historicalSellingPrice2025 === null ||
      readiness.historicalSellingPrice2025 <= 0
    ) {
      blockedHistoricalPriceEvidence += 1;
      continue;
    }

    stageableRows.push({
      productCode: readiness.productCode,
      plannedSku: execution.plannedSku,
      plannedName: execution.plannedName,
      plannedCategory: execution.plannedCategory,
      plannedSellingPrice: readiness.historicalSellingPrice2025,
      sellingPriceProvenance: "LAST_RECORDED_HISTORICAL_PRICE_2025",
      sellingPriceUsage: "PROVISIONAL_INACTIVE_ONLY",
      currentSellingPrice: null,
      currentPriceReadiness: "UNVERIFIED",
      plannedUnit: readiness.proposedUnit,
      unitEvidence: readiness.unitEvidence,
      plannedStatus: "INACTIVE",
      plannedDataQualityStatus: "NEEDS_REVIEW",
      plannedRecordSource: "IMPORT",
      plannedStorefrontVisible: false,
      plannedCreateInventory: false,
      plannedCreateInventoryBatch: false,
      plannedCreateSarimaMapping: true,
      imageStatus: execution.imageStatus,
      assetFileIds: [...execution.assetFileIds],
      activationBlockers: [
        "CURRENT_SELLING_PRICE",
        "PHYSICAL_STOCK",
        "QUALITY_APPROVAL"
      ]
    });
  }

  return {
    summary: {
      candidates: input.readinessRows.length,
      stageableInactiveIdentities: stageableRows.length,
      blockedUnitReview,
      blockedHistoricalPriceEvidence,
      plannedInventoryRows: 0,
      plannedStorefrontVisible: 0,
      currentPriceVerified: 0
    },
    stageableRows
  };
}
