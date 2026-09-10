import { isDevelopmentCatalogSeedCategory } from "./development-catalog-seed-category-identities.js";

export type CategoryGapExecutionRow = {
  productCode: string;
  plannedCategory: string;
};

export type CategoryGapDatabaseCategory = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  recordSource: "CATALOG" | "IMPORT" | "TEST_FIXTURE" | "INTERNAL";
  dataQualityStatus: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
  isStorefrontVisible: boolean;
};

export type CategoryGapResolutionStatus =
  | "EXISTING_STAGING_ELIGIBLE"
  | "MISSING_CATEGORY"
  | "DEVELOPMENT_SEED_CATEGORY"
  | "TEST_FIXTURE_CATEGORY"
  | "INACTIVE_CATEGORY"
  | "REJECTED_CATEGORY"
  | "AMBIGUOUS_CATEGORY";

export type CategoryGapRecommendedAction =
  | "REUSE_EXISTING"
  | "REVIEW_CREATE_OR_MAP"
  | "REVIEW_REQUIRED";

export type CatalogPromotionCategoryGapPlanRow = {
  sourceCategory: string;
  candidateCount: number;
  productCodes: string[];
  resolutionStatus: CategoryGapResolutionStatus;
  recommendedAction: CategoryGapRecommendedAction;
  matchedCategory: CategoryGapDatabaseCategory | null;
};

export type CatalogPromotionCategoryGapPlan = {
  summary: {
    candidateRows: number;
    distinctSourceCategories: number;
    existingStagingEligible: number;
    missingCategories: number;
    developmentSeedCategories: number;
    testFixtureCategories: number;
    inactiveCategories: number;
    rejectedCategories: number;
    ambiguousCategories: number;
    plannedCategoryCreates: 0;
    plannedCategoryUpdates: 0;
  };
  rows: CatalogPromotionCategoryGapPlanRow[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function classify(category: CategoryGapDatabaseCategory): {
  status: CategoryGapResolutionStatus;
  action: CategoryGapRecommendedAction;
} {
  if (isDevelopmentCatalogSeedCategory(category)) {
    return { status: "DEVELOPMENT_SEED_CATEGORY", action: "REVIEW_REQUIRED" };
  }
  if (category.recordSource === "TEST_FIXTURE") {
    return { status: "TEST_FIXTURE_CATEGORY", action: "REVIEW_REQUIRED" };
  }
  if (!category.isActive) {
    return { status: "INACTIVE_CATEGORY", action: "REVIEW_REQUIRED" };
  }
  if (category.dataQualityStatus === "REJECTED") {
    return { status: "REJECTED_CATEGORY", action: "REVIEW_REQUIRED" };
  }
  return { status: "EXISTING_STAGING_ELIGIBLE", action: "REUSE_EXISTING" };
}

export function buildCatalogPromotionCategoryGapPlan(input: {
  executionRows: CategoryGapExecutionRow[];
  categories: CategoryGapDatabaseCategory[];
}): CatalogPromotionCategoryGapPlan {
  const databaseByName = new Map<string, CategoryGapDatabaseCategory[]>();
  for (const category of input.categories) {
    const key = normalize(category.name);
    const current = databaseByName.get(key) ?? [];
    current.push(category);
    databaseByName.set(key, current);
  }

  const sourceGroups = new Map<string, { sourceCategory: string; productCodes: string[] }>();
  for (const row of input.executionRows) {
    const key = normalize(row.plannedCategory);
    const current = sourceGroups.get(key) ?? {
      sourceCategory: row.plannedCategory.trim(),
      productCodes: []
    };
    current.productCodes.push(row.productCode);
    sourceGroups.set(key, current);
  }

  const rows = [...sourceGroups.values()]
    .sort((left, right) => left.sourceCategory.localeCompare(right.sourceCategory))
    .map((group): CatalogPromotionCategoryGapPlanRow => {
      const matches = databaseByName.get(normalize(group.sourceCategory)) ?? [];
      const productCodes = [...group.productCodes].sort();

      if (matches.length === 0) {
        return {
          sourceCategory: group.sourceCategory,
          candidateCount: productCodes.length,
          productCodes,
          resolutionStatus: "MISSING_CATEGORY",
          recommendedAction: "REVIEW_CREATE_OR_MAP",
          matchedCategory: null
        };
      }

      if (matches.length > 1) {
        return {
          sourceCategory: group.sourceCategory,
          candidateCount: productCodes.length,
          productCodes,
          resolutionStatus: "AMBIGUOUS_CATEGORY",
          recommendedAction: "REVIEW_REQUIRED",
          matchedCategory: null
        };
      }

      const matchedCategory = matches[0]!;
      const classification = classify(matchedCategory);
      return {
        sourceCategory: group.sourceCategory,
        candidateCount: productCodes.length,
        productCodes,
        resolutionStatus: classification.status,
        recommendedAction: classification.action,
        matchedCategory
      };
    });

  const count = (status: CategoryGapResolutionStatus) =>
    rows.filter((row) => row.resolutionStatus === status).length;

  return {
    summary: {
      candidateRows: input.executionRows.length,
      distinctSourceCategories: rows.length,
      existingStagingEligible: count("EXISTING_STAGING_ELIGIBLE"),
      missingCategories: count("MISSING_CATEGORY"),
      developmentSeedCategories: count("DEVELOPMENT_SEED_CATEGORY"),
      testFixtureCategories: count("TEST_FIXTURE_CATEGORY"),
      inactiveCategories: count("INACTIVE_CATEGORY"),
      rejectedCategories: count("REJECTED_CATEGORY"),
      ambiguousCategories: count("AMBIGUOUS_CATEGORY"),
      plannedCategoryCreates: 0,
      plannedCategoryUpdates: 0
    },
    rows
  };
}
