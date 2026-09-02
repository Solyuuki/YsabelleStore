import type { CatalogPromotionInactiveStagingRow } from "./catalog-promotion-inactive-staging-plan.js";
import { isDevelopmentCatalogSeedCategory } from "./development-catalog-seed-category-identities.js";

export type DatabaseMutationPreviewCategory = {
  id: string;
  name: string;
  slug?: string;
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

export function buildCatalogPromotionDatabaseMutationPreview(input: {
  stagingRows: CatalogPromotionInactiveStagingRow[];
  categories: DatabaseMutationPreviewCategory[];
  products: DatabaseMutationPreviewProduct[];
  mappings: DatabaseMutationPreviewMapping[];
}): CatalogPromotionDatabaseMutationPreview {
  const categoriesByName = new Map<string, DatabaseMutationPreviewCategory[]>();
  for (const category of input.categories) {
    const key = normalize(category.name);
    const values = categoriesByName.get(key) ?? [];
    values.push(category);
    categoriesByName.set(key, values);
  }

  const productSkuSet = new Set(input.products.map((product) => normalize(product.sku)));
  const mappingsBySourceProductId = new Map<string, DatabaseMutationPreviewMapping[]>();
  for (const mapping of input.mappings) {
    const values = mappingsBySourceProductId.get(mapping.sourceProductId) ?? [];
    values.push(mapping);
    mappingsBySourceProductId.set(mapping.sourceProductId, values);
  }

  const rows = input.stagingRows.map((staging): CatalogPromotionDatabaseMutationPreviewRow => {
    const productBlockers: ProductMutationBlocker[] = [];
    const categoryMatches = categoriesByName.get(normalize(staging.plannedCategory)) ?? [];

    if (categoryMatches.length === 0) {
      productBlockers.push("CATEGORY_NOT_FOUND");
    } else if (categoryMatches.length > 1) {
      productBlockers.push("CATEGORY_AMBIGUOUS");
    } else if (isDevelopmentCatalogSeedCategory(categoryMatches[0]!)) {
      productBlockers.push("DEVELOPMENT_SEED_CATEGORY");
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
