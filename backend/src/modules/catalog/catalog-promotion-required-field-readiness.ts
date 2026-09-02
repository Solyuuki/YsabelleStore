import type { PromotionExecutionManifestRow } from "./catalog-promotion-execution-manifest.js";

export type ResolvedProductUnit =
  | "PIECE"
  | "PACK"
  | "BOX"
  | "BOTTLE"
  | "SACHET"
  | "KILOGRAM"
  | "GRAM"
  | "LITER"
  | "MILLILITER";
export type ProductUnitEvidence =
  | "EXPLICIT_BOTTLE"
  | "EXPLICIT_BOX"
  | "EXPLICIT_PACK"
  | "EXPLICIT_SACHET"
  | "EXPLICIT_POUCH_AS_PACK"
  | "CATEGORY_SINGLE_RETAIL_ITEM"
  | "REVIEWED_PRODUCT_OVERRIDE"
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
  proposedUnit: ResolvedProductUnit | null;
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
    unitResolved: number;
    unitNeedsReview: number;
    readyToCreate: number;
  };
  rows: PromotionRequiredFieldReadinessRow[];
};

type UnitResolution = {
  unit: ResolvedProductUnit | null;
  evidence: ProductUnitEvidence;
};

const SINGLE_RETAIL_ITEM_CATEGORIES = new Set([
  "Baking / Spreads & Dessert Ingredients",
  "Beverages / Alcohol",
  "Beverages / Coffee & Milk",
  "Beverages / Juice, Tea, Soda & Water",
  "Bread & Bakery",
  "Canned Goods",
  "Condiments & Cooking Ingredients",
  "Frozen / Chilled",
  "Household Supplies",
  "Laundry Supplies",
  "Noodles & Pasta",
  "Personal Care / Hygiene",
  "Rice & Staples",
  "Snacks / Biscuits & Confectionery",
  "Tissue & Cotton"
]);

const REVIEWED_PRODUCT_UNIT_OVERRIDES = new Map<
  string,
  { name: string; unit: ResolvedProductUnit }
>([
  [
    "P021",
    {
      name: "Downy Fabric Conditioner Twin / Larger Sachet Pack",
      unit: "PACK"
    }
  ],
  [
    "P131",
    {
      name: "Joy Dishwashing Liquid Sachet / Pack",
      unit: "PACK"
    }
  ],
  [
    "P153",
    {
      name: "Closeup Red Hot Gel Toothpaste Sachet Twin Pack",
      unit: "PACK"
    }
  ],
  [
    "P216",
    {
      name: "Repacked Rice / Bigas",
      unit: "KILOGRAM"
    }
  ]
]);

function hasWord(value: string, word: string) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:s)?(?:$|[^\\p{L}\\p{N}])`, "iu").test(
    value
  );
}

function hasBottleMorphology(value: string) {
  return hasWord(value, "bottle") || /(?:^|[^\p{L}\p{N}])bottled(?:$|[^\p{L}\p{N}])/iu.test(value);
}

export function resolveExplicitProductUnit(name: string): UnitResolution {
  const matches: Array<{ unit: ResolvedProductUnit; evidence: ProductUnitEvidence }> = [];

  if (hasWord(name, "sachet")) {
    matches.push({ unit: "SACHET", evidence: "EXPLICIT_SACHET" });
  }
  if (hasBottleMorphology(name)) {
    matches.push({ unit: "BOTTLE", evidence: "EXPLICIT_BOTTLE" });
  }
  if (hasWord(name, "pack")) {
    matches.push({ unit: "PACK", evidence: "EXPLICIT_PACK" });
  }
  if (hasWord(name, "box")) {
    matches.push({ unit: "BOX", evidence: "EXPLICIT_BOX" });
  }
  if (hasWord(name, "pouch")) {
    matches.push({ unit: "PACK", evidence: "EXPLICIT_POUCH_AS_PACK" });
  }

  const distinctUnits = new Set(matches.map((match) => match.unit));
  if (distinctUnits.size !== 1) {
    return { unit: null, evidence: "REVIEW_REQUIRED" };
  }

  return matches[0] ?? { unit: null, evidence: "REVIEW_REQUIRED" };
}

function resolveReviewedProductUnit(input: {
  productCode: string;
  plannedName: string;
}): UnitResolution | null {
  const reviewed = REVIEWED_PRODUCT_UNIT_OVERRIDES.get(input.productCode);
  if (!reviewed || reviewed.name !== input.plannedName) return null;
  return { unit: reviewed.unit, evidence: "REVIEWED_PRODUCT_OVERRIDE" };
}

function resolveCatalogProductUnit(input: {
  productCode: string;
  plannedName: string;
  plannedCategory: string;
}): UnitResolution {
  const reviewed = resolveReviewedProductUnit(input);
  if (reviewed) return reviewed;

  const explicit = resolveExplicitProductUnit(input.plannedName);
  if (explicit.unit !== null) return explicit;

  if (SINGLE_RETAIL_ITEM_CATEGORIES.has(input.plannedCategory)) {
    return { unit: "PIECE", evidence: "CATEGORY_SINGLE_RETAIL_ITEM" };
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
      const unitResolution = resolveCatalogProductUnit({
        productCode: executionRow.productCode,
        plannedName: executionRow.plannedName,
        plannedCategory: executionRow.plannedCategory
      });

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
      explicitUnitResolved: rows.filter((row) => row.unitEvidence.startsWith("EXPLICIT_")).length,
      unitResolved: rows.filter((row) => row.proposedUnit !== null).length,
      unitNeedsReview: rows.filter((row) => row.proposedUnit === null).length,
      readyToCreate: 0
    },
    rows
  };
}
