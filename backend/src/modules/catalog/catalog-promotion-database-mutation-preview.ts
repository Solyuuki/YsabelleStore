import type { CatalogPromotionInactiveStagingRow } from "./catalog-promotion-inactive-staging-plan.js";
import { slugifyOperationalCategory } from "./catalog-promotion-category-operationalization-preview.js";
import { isDevelopmentCatalogSeedCategory } from "./development-catalog-seed-category-identities.js";

export type DatabaseMutationPreviewCategory = {
  id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
  recordSource?: "CATALOG" | "IMPORT" | "TEST_FIXTURE" | "INTERNAL";
  dataQualityStatus?: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
};

export type DatabaseMutationPreviewProduct = {
  id: string;
  sku: string;
};

export type DatabaseMutationPreviewMapping = {
  sourceKey: string;
  sourceProductId: string;
  canonicalProductId: string;
};

export type ApprovedSeedCategoryReuse = {
  sourceCategory: string;
  existingCategoryId: string | null;
  decision: "REUSE_EXISTING" | string;
  reuseBasis: "SEED_CATEGORY_EVIDENCE" | string | null;
  blockers: string[];
};

export type ProductMutationBlocker =
  | "CATEGORY_NOT_FOUND"
  | "CATEGORY_AMBIGUOUS"
  | "DEVELOPMENT_SEED_CATEGORY"
  | "SKU_COLLISION";

export type MappingMutationBlocker =
  | "SOURCE_MAPPING_METADATA_CONTRACT"
  | "SOURCE_PRODUCT_MAPPING_COLLISION";

export type PlannedInactiveProductCreate = {
  categoryId: string;
  sku: string;
  name: string;
  unit: CatalogPromotionInactiveStagingRow["plannedUnit"];
  costPrice: null;
  sellingPrice: number;
  status: "INACTIVE";
  recordSource: "IMPORT";
  dataQualityStatus: "NEEDS_REVIEW";
  isStorefrontVisible: false;
};

export type CatalogPromotionDatabaseMutationPreviewRow = {
  productCode: string;
  plannedSku: string;
  plannedName: string;
  plannedCategory: string;
  productMutationReadiness: "READY" | "BLOCKED";
  mappingMutationReadiness: "NEEDS_SOURCE_METADATA" | "BLOCKED_COLLISION";
  costPricePolicy: "NULLABLE_NOT_INFERRED";
  plannedProductCreate: PlannedInactiveProductCreate | null;
  plannedSarimaMappingCreate: null;
  existingMappingProductId: string | null;
  productBlockers: ProductMutationBlocker[];
  mappingBlockers: MappingMutationBlocker[];
};

export type CatalogPromotionDatabaseMutationPreview = {
  summary: {
    candidates: number;
    productCreateReady: number;
    productCreateBlocked: number;
    missingCategories: number;
    developmentSeedCategoryMatches: number;
    skuCollisions: number;
    sourceProductMappingCollisions: number;
    mappingMetadataPending: number;
    nullableCostPriceRows: number;
    plannedInventoryRows: 0;
    plannedInventoryBatchRows: 0;
  };
  rows: CatalogPromotionDatabaseMutationPreviewRow[];
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function isOperationallyReusableSlugCategory(category: DatabaseMutationPreviewCategory) {
  return (
    !isDevelopmentCatalogSeedCategory(category) &&
    category.recordSource !== "TEST_FIXTURE" &&
    category.isActive === true &&
    category.dataQualityStatus !== "REJECTED"
  );
}

function hasApprovedSeedCategoryReuse(
  staging: CatalogPromotionInactiveStagingRow,
  category: DatabaseMutationPreviewCategory,
  approvals: ApprovedSeedCategoryReuse[]
) {
  return approvals.some(
    (approval) =>
      approval.sourceCategory === staging.plannedCategory &&
      approval.existingCategoryId === category.id &&
      approval.decision === "REUSE_EXISTING" &&
      approval.reuseBasis === "SEED_CATEGORY_EVIDENCE" &&
      approval.blockers.length === 0
  );
}

export function buildCatalogPromotionDatabaseMutationPreview(input: {
  stagingRows: CatalogPromotionInactiveStagingRow[];
  categories: DatabaseMutationPreviewCategory[];
  products: DatabaseMutationPreviewProduct[];
  mappings: DatabaseMutationPreviewMapping[];
  approvedSeedCategoryReuses?: ApprovedSeedCategoryReuse[];
}): CatalogPromotionDatabaseMutationPreview {
  const categoriesByName = new Map<string, DatabaseMutationPreviewCategory[]>();
  const categoriesBySlug = new Map<string, DatabaseMutationPreviewCategory[]>();
  for (const category of input.categories) {
    const nameKey = normalize(category.name);
    const nameValues = categoriesByName.get(nameKey) ?? [];
    nameValues.push(category);
    categoriesByName.set(nameKey, nameValues);

    if (category.slug) {
      const slugKey = normalize(category.slug);
      const slugValues = categoriesBySlug.get(slugKey) ?? [];
      slugValues.push(category);
      categoriesBySlug.set(slugKey, slugValues);
    }
  }

  const productSkuSet = new Set(input.products.map((product) => normalize(product.sku)));
  const mappingsBySourceProductId = new Map<string, DatabaseMutationPreviewMapping[]>();
  for (const mapping of input.mappings) {
    const values = mappingsBySourceProductId.get(mapping.sourceProductId) ?? [];
    values.push(mapping);
    mappingsBySourceProductId.set(mapping.sourceProductId, values);
  }

  const approvedSeedCategoryReuses = input.approvedSeedCategoryReuses ?? [];

  const rows = input.stagingRows.map((staging): CatalogPromotionDatabaseMutationPreviewRow => {
    const productBlockers: ProductMutationBlocker[] = [];
    const exactNameMatches = categoriesByName.get(normalize(staging.plannedCategory)) ?? [];
    let categoryMatches = exactNameMatches;

    if (exactNameMatches.length === 0) {
      const candidateSlug = slugifyOperationalCategory(staging.plannedCategory);
      const slugMatches = categoriesBySlug.get(normalize(candidateSlug)) ?? [];

      if (slugMatches.length === 1) {
        const candidate = slugMatches[0]!;
        const isSemanticSlugEquivalent = slugifyOperationalCategory(candidate.name) === candidateSlug;
        categoryMatches =
          isSemanticSlugEquivalent && isOperationallyReusableSlugCategory(candidate) ? [candidate] : [];
      } else if (slugMatches.length > 1) {
        productBlockers.push("CATEGORY_AMBIGUOUS");
        categoryMatches = [];
      }
    }

    if (productBlockers.length === 0) {
      if (categoryMatches.length === 0) {
        productBlockers.push("CATEGORY_NOT_FOUND");
      } else if (categoryMatches.length > 1) {
        productBlockers.push("CATEGORY_AMBIGUOUS");
      } else if (
        isDevelopmentCatalogSeedCategory(categoryMatches[0]!) &&
        !hasApprovedSeedCategoryReuse(
          staging,
          categoryMatches[0]!,
          approvedSeedCategoryReuses
        )
      ) {
        productBlockers.push("DEVELOPMENT_SEED_CATEGORY");
      }
    }

    if (productSkuSet.has(normalize(staging.plannedSku))) {
      productBlockers.push("SKU_COLLISION");
    }

    const mappingMatches = mappingsBySourceProductId.get(staging.productCode) ?? [];
    const mappingCollision = mappingMatches.length > 0;
    const mappingBlockers: MappingMutationBlocker[] = mappingCollision
      ? ["SOURCE_PRODUCT_MAPPING_COLLISION"]
      : ["SOURCE_MAPPING_METADATA_CONTRACT"];

    const category = categoryMatches.length === 1 ? categoryMatches[0]! : null;
    const plannedProductCreate: PlannedInactiveProductCreate | null =
      productBlockers.length === 0 && category
        ? {
            categoryId: category.id,
            sku: staging.plannedSku,
            name: staging.plannedName,
            unit: staging.plannedUnit,
            costPrice: null,
            sellingPrice: staging.plannedSellingPrice,
            status: "INACTIVE",
            recordSource: "IMPORT",
            dataQualityStatus: "NEEDS_REVIEW",
            isStorefrontVisible: false
          }
        : null;

    const existingMappingProductIds = [
      ...new Set(mappingMatches.map((mapping) => mapping.canonicalProductId))
    ].sort();

    return {
      productCode: staging.productCode,
      plannedSku: staging.plannedSku,
      plannedName: staging.plannedName,
      plannedCategory: staging.plannedCategory,
      productMutationReadiness: productBlockers.length === 0 ? "READY" : "BLOCKED",
      mappingMutationReadiness: mappingCollision ? "BLOCKED_COLLISION" : "NEEDS_SOURCE_METADATA",
      costPricePolicy: "NULLABLE_NOT_INFERRED",
      plannedProductCreate,
      plannedSarimaMappingCreate: null,
      existingMappingProductId: existingMappingProductIds[0] ?? null,
      productBlockers,
      mappingBlockers
    };
  });

  return {
    summary: {
      candidates: rows.length,
      productCreateReady: rows.filter((row) => row.productMutationReadiness === "READY").length,
      productCreateBlocked: rows.filter((row) => row.productMutationReadiness === "BLOCKED").length,
      missingCategories: rows.filter((row) => row.productBlockers.includes("CATEGORY_NOT_FOUND")).length,
      developmentSeedCategoryMatches: rows.filter((row) =>
        row.productBlockers.includes("DEVELOPMENT_SEED_CATEGORY")
      ).length,
      skuCollisions: rows.filter((row) => row.productBlockers.includes("SKU_COLLISION")).length,
      sourceProductMappingCollisions: rows.filter(
        (row) => row.mappingMutationReadiness === "BLOCKED_COLLISION"
      ).length,
      mappingMetadataPending: rows.filter(
        (row) => row.mappingMutationReadiness === "NEEDS_SOURCE_METADATA"
      ).length,
      nullableCostPriceRows: rows.filter((row) => row.plannedProductCreate?.costPrice === null).length,
      plannedInventoryRows: 0,
      plannedInventoryBatchRows: 0
    },
    rows
  };
}
