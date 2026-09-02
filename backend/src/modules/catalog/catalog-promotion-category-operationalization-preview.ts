import type {
  CatalogPromotionCategoryGapPlanRow,
  CategoryGapDatabaseCategory
} from "./catalog-promotion-category-gap-plan.js";
import { isDevelopmentCatalogSeedProduct } from "./development-catalog-seed-identities.js";

export type CategoryOperationalizationProduct = {
  id: string;
  sku: string;
  categoryId: string;
};

export type ProposedOperationalCategory = {
  name: string;
  slug: string;
  isActive: true;
  recordSource: "IMPORT";
  dataQualityStatus: "NEEDS_REVIEW";
  isStorefrontVisible: false;
};

export type CategoryOperationalizationDecision =
  | "PROPOSE_CREATE"
  | "REUSE_EXISTING"
  | "REVIEW_ADOPT_SEED"
  | "BLOCKED_NAME_COLLISION"
  | "BLOCKED_SLUG_COLLISION"
  | "REVIEW_REQUIRED";

export type CategoryOperationalizationSeedProduct = {
  id: string;
  sku: string;
  isDevelopmentSeed: boolean;
};

export type CatalogPromotionCategoryOperationalizationPreviewRow = {
  sourceCategory: string;
  candidateCount: number;
  decision: CategoryOperationalizationDecision;
  proposedCategory: ProposedOperationalCategory | null;
  existingCategoryId: string | null;
  seedCategoryProductReferences: number;
  seedCategoryNonSeedProductReferences: number;
  seedCategoryProducts: CategoryOperationalizationSeedProduct[];
};

export type CatalogPromotionCategoryOperationalizationPreview = {
  summary: {
    sourceCategories: number;
    proposeCreate: number;
    reuseExisting: number;
    reviewAdoptSeed: number;
    blockedNameCollision: number;
    blockedSlugCollision: number;
    seedCategoryProductReferences: number;
    seedCategoryNonSeedProductReferences: number;
    plannedCategoryCreates: 0;
    plannedCategoryUpdates: 0;
    actualMutationsPerformed: 0;
  };
  rows: CatalogPromotionCategoryOperationalizationPreviewRow[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function slugifyOperationalCategory(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function buildCatalogPromotionCategoryOperationalizationPreview(input: {
  gapRows: CatalogPromotionCategoryGapPlanRow[];
  allCategories: CategoryGapDatabaseCategory[];
  categoryProducts: CategoryOperationalizationProduct[];
}): CatalogPromotionCategoryOperationalizationPreview {
  const categoriesByNormalizedName = new Map<string, CategoryGapDatabaseCategory[]>();
  const categoriesBySlug = new Map<string, CategoryGapDatabaseCategory[]>();

  for (const category of input.allCategories) {
    const nameKey = normalize(category.name);
    const nameRows = categoriesByNormalizedName.get(nameKey) ?? [];
    nameRows.push(category);
    categoriesByNormalizedName.set(nameKey, nameRows);

    const slugKey = normalize(category.slug);
    const slugRows = categoriesBySlug.get(slugKey) ?? [];
    slugRows.push(category);
    categoriesBySlug.set(slugKey, slugRows);
  }

  const rows = input.gapRows.map(
    (gap): CatalogPromotionCategoryOperationalizationPreviewRow => {
      if (gap.resolutionStatus === "MISSING_CATEGORY") {
        const proposedSlug = slugifyOperationalCategory(gap.sourceCategory);
        const nameCollisions = categoriesByNormalizedName.get(normalize(gap.sourceCategory)) ?? [];
        const slugCollisions = categoriesBySlug.get(normalize(proposedSlug)) ?? [];

        if (nameCollisions.length > 0) {
          return {
            sourceCategory: gap.sourceCategory,
            candidateCount: gap.candidateCount,
            decision: "BLOCKED_NAME_COLLISION",
            proposedCategory: null,
            existingCategoryId: null,
            seedCategoryProductReferences: 0,
            seedCategoryNonSeedProductReferences: 0,
            seedCategoryProducts: []
          };
        }

        if (slugCollisions.length > 0) {
          return {
            sourceCategory: gap.sourceCategory,
            candidateCount: gap.candidateCount,
            decision: "BLOCKED_SLUG_COLLISION",
            proposedCategory: null,
            existingCategoryId: null,
            seedCategoryProductReferences: 0,
            seedCategoryNonSeedProductReferences: 0,
            seedCategoryProducts: []
          };
        }

        return {
          sourceCategory: gap.sourceCategory,
          candidateCount: gap.candidateCount,
          decision: "PROPOSE_CREATE",
          proposedCategory: {
            name: gap.sourceCategory,
            slug: proposedSlug,
            isActive: true,
            recordSource: "IMPORT",
            dataQualityStatus: "NEEDS_REVIEW",
            isStorefrontVisible: false
          },
          existingCategoryId: null,
          seedCategoryProductReferences: 0,
          seedCategoryNonSeedProductReferences: 0,
          seedCategoryProducts: []
        };
      }

      if (gap.resolutionStatus === "EXISTING_STAGING_ELIGIBLE" && gap.matchedCategory) {
        return {
          sourceCategory: gap.sourceCategory,
          candidateCount: gap.candidateCount,
          decision: "REUSE_EXISTING",
          proposedCategory: null,
          existingCategoryId: gap.matchedCategory.id,
          seedCategoryProductReferences: 0,
          seedCategoryNonSeedProductReferences: 0,
          seedCategoryProducts: []
        };
      }

      if (gap.resolutionStatus === "DEVELOPMENT_SEED_CATEGORY" && gap.matchedCategory) {
        const references = input.categoryProducts
          .filter((product) => product.categoryId === gap.matchedCategory!.id)
          .map((product) => ({
            id: product.id,
            sku: product.sku,
            isDevelopmentSeed: isDevelopmentCatalogSeedProduct(product)
          }))
          .sort((left, right) => left.id.localeCompare(right.id));
        const nonSeedReferences = references.filter((product) => !product.isDevelopmentSeed).length;

        return {
          sourceCategory: gap.sourceCategory,
          candidateCount: gap.candidateCount,
          decision: "REVIEW_ADOPT_SEED",
          proposedCategory: null,
          existingCategoryId: gap.matchedCategory.id,
          seedCategoryProductReferences: references.length,
          seedCategoryNonSeedProductReferences: nonSeedReferences,
          seedCategoryProducts: references
        };
      }

      return {
        sourceCategory: gap.sourceCategory,
        candidateCount: gap.candidateCount,
        decision: "REVIEW_REQUIRED",
        proposedCategory: null,
        existingCategoryId: gap.matchedCategory?.id ?? null,
        seedCategoryProductReferences: 0,
        seedCategoryNonSeedProductReferences: 0,
        seedCategoryProducts: []
      };
    }
  );

  const count = (decision: CategoryOperationalizationDecision) =>
    rows.filter((row) => row.decision === decision).length;

  return {
    summary: {
      sourceCategories: rows.length,
      proposeCreate: count("PROPOSE_CREATE"),
      reuseExisting: count("REUSE_EXISTING"),
      reviewAdoptSeed: count("REVIEW_ADOPT_SEED"),
      blockedNameCollision: count("BLOCKED_NAME_COLLISION"),
      blockedSlugCollision: count("BLOCKED_SLUG_COLLISION"),
      seedCategoryProductReferences: rows.reduce(
        (total, row) => total + row.seedCategoryProductReferences,
        0
      ),
      seedCategoryNonSeedProductReferences: rows.reduce(
        (total, row) => total + row.seedCategoryNonSeedProductReferences,
        0
      ),
      plannedCategoryCreates: 0,
      plannedCategoryUpdates: 0,
      actualMutationsPerformed: 0
    },
    rows
  };
}
