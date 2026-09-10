import {
  CatalogQualityStatus,
  CatalogRecordSource,
  InventoryBatchStatus,
  InventoryMovementType,
  ProductStatus
} from "@prisma/client";

import {
  RESTRICTED_ALCOHOL_SOURCE_CATEGORY,
  RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS,
  RETIRED_RESTRICTED_CATEGORY,
  STOREFRONT_CATEGORY_NAMES,
  STOREFRONT_CATEGORY_TAXONOMY,
  storefrontCategoryForSource
} from "./storefront-category-taxonomy.js";

const LEGACY_CATEGORY_NAMES = [
  "Baking / Spreads & Dessert Ingredients",
  "Beverages",
  "Beverages / Alcohol",
  "Beverages / Coffee & Milk",
  "Beverages / Juice, Tea, Soda & Water",
  "Condiments & Cooking Ingredients",
  "Frozen / Chilled",
  "Instant Food",
  "Personal Care",
  "Personal Care / Hygiene",
  "Snacks",
  "Snacks / Biscuits & Confectionery"
] as const;

const CLEANUP_REFERENCE_TYPE = "CATALOG_TAXONOMY_RETIREMENT";
const CLEANUP_REFERENCE_ID = "restricted-alcohol-v1";

type CategoryIdentityRow = {
  id: string;
  name: string;
  slug: string;
};

type SourceMappingRow = {
  sourceProductId: string;
  sourceCategory: string;
  canonicalProduct: {
    id: string;
    categoryId: string;
    inventory: {
      id: string;
      quantityOnHand: number;
    } | null;
  };
};

type PostRemapCategoryRow = {
  id: string;
  name: string;
  _count: {
    products: number;
  };
};

export type StorefrontTaxonomyCleanupClient = {
  $transaction<T>(callback: (tx: StorefrontTaxonomyCleanupClient) => Promise<T>): Promise<T>;
  category: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    delete(args: unknown): Promise<unknown>;
  };
  sarimaSourceProductMapping: {
    findMany(args?: unknown): Promise<unknown[]>;
  };
  product: {
    update(args: unknown): Promise<unknown>;
  };
  inventory: {
    update(args: unknown): Promise<unknown>;
  };
  inventoryBatch: {
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  inventoryMovement: {
    findFirst(args: unknown): Promise<unknown | null>;
    create(args: unknown): Promise<unknown>;
  };
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function assertSourceMappingSet(mappings: SourceMappingRow[]) {
  const restrictedIds = new Set<string>(RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS);
  const seenRestrictedIds = new Set<string>();

  for (const mapping of mappings) {
    const sourceProductId = String(mapping.sourceProductId);
    const sourceCategory = String(mapping.sourceCategory);
    const isRestrictedId = restrictedIds.has(sourceProductId);
    const isRestrictedCategory = sourceCategory === RESTRICTED_ALCOHOL_SOURCE_CATEGORY;

    if (isRestrictedId !== isRestrictedCategory) {
      throw new Error(
        `STOREFRONT_TAXONOMY_ALCOHOL_IDENTITY_DRIFT: ${sourceProductId} is mapped to ${sourceCategory}.`
      );
    }

    if (isRestrictedId) {
      seenRestrictedIds.add(sourceProductId);
      continue;
    }

    if (!storefrontCategoryForSource(sourceCategory)) {
      throw new Error(
        `STOREFRONT_TAXONOMY_UNSUPPORTED_SOURCE_CATEGORY: ${sourceProductId} uses ${sourceCategory}.`
      );
    }
  }

  for (const sourceProductId of restrictedIds) {
    if (!seenRestrictedIds.has(sourceProductId)) {
      throw new Error(
        `STOREFRONT_TAXONOMY_RESTRICTED_IDENTITY_MISSING: expected ${sourceProductId} in ${RESTRICTED_ALCOHOL_SOURCE_CATEGORY}.`
      );
    }
  }
}

async function ensureCategory(
  tx: StorefrontTaxonomyCleanupClient,
  existingCategories: CategoryIdentityRow[],
  input: {
    name: string;
    slug: string;
    active: boolean;
    visible: boolean;
    quality: CatalogQualityStatus;
  }
): Promise<CategoryIdentityRow> {
  const nameMatches = existingCategories.filter(
    (row) => normalize(row.name) === normalize(input.name)
  );
  const slugMatches = existingCategories.filter(
    (row) => normalize(row.slug) === normalize(input.slug)
  );
  const candidateIds = new Set([...nameMatches, ...slugMatches].map((row) => row.id));

  if (candidateIds.size > 1) {
    throw new Error(
      `STOREFRONT_TAXONOMY_CATEGORY_IDENTITY_CONFLICT: ${input.name} / ${input.slug} resolves to multiple categories.`
    );
  }

  const existing = [...nameMatches, ...slugMatches][0];
  const data = {
    name: input.name,
    slug: input.slug,
    isActive: input.active,
    isStorefrontVisible: input.visible,
    dataQualityStatus: input.quality,
    recordSource: CatalogRecordSource.CATALOG
  };

  if (existing) {
    const updated = (await tx.category.update({
      where: { id: existing.id },
      data
    })) as CategoryIdentityRow;
    Object.assign(existing, updated);
    return updated;
  }

  const created = (await tx.category.create({ data })) as CategoryIdentityRow;
  existingCategories.push(created);
  return created;
}

export async function executeStorefrontCategoryTaxonomyCleanup(input: {
  client: StorefrontTaxonomyCleanupClient;
}) {
  return input.client.$transaction(async (tx) => {
    const [rawCategories, rawMappings] = await Promise.all([
      tx.category.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          isStorefrontVisible: true,
          dataQualityStatus: true,
          _count: { select: { products: true } }
        }
      }),
      tx.sarimaSourceProductMapping.findMany({
        orderBy: { sourceProductId: "asc" },
        include: {
          canonicalProduct: {
            include: {
              inventory: true,
              inventoryBatches: true
            }
          }
        }
      })
    ]);
    const categories = rawCategories as CategoryIdentityRow[];
    const mappings = rawMappings as SourceMappingRow[];

    assertSourceMappingSet(mappings);

    const categoryByPublicName = new Map<string, CategoryIdentityRow>();
    for (const taxonomy of STOREFRONT_CATEGORY_TAXONOMY) {
      const category = await ensureCategory(tx, categories, {
        name: taxonomy.name,
        slug: taxonomy.slug,
        active: true,
        visible: true,
        quality: CatalogQualityStatus.APPROVED
      });
      categoryByPublicName.set(taxonomy.name, category);
    }

    const retiredCategory = await ensureCategory(tx, categories, {
      ...RETIRED_RESTRICTED_CATEGORY,
      active: false,
      visible: false,
      quality: CatalogQualityStatus.REJECTED
    });

    let remappedProducts = 0;
    let restrictedProductsRetired = 0;
    let inventoryUnitsRemoved = 0;
    let batchesRemoved = 0;
    let inventoryMovementsCreated = 0;

    for (const mapping of mappings) {
      const product = mapping.canonicalProduct;
      const sourceProductId = String(mapping.sourceProductId);
      const sourceCategory = String(mapping.sourceCategory);

      if ((RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS as readonly string[]).includes(sourceProductId)) {
        const quantityBefore = product.inventory?.quantityOnHand ?? 0;

        if (product.inventory && quantityBefore > 0) {
          const existingMovement = await tx.inventoryMovement.findFirst({
            where: {
              productId: product.id,
              referenceType: CLEANUP_REFERENCE_TYPE,
              referenceId: CLEANUP_REFERENCE_ID
            }
          });

          if (!existingMovement) {
            await tx.inventoryMovement.create({
              data: {
                inventoryId: product.inventory.id,
                productId: product.id,
                type: InventoryMovementType.ADJUSTMENT_OUT,
                quantity: quantityBefore,
                quantityBefore,
                quantityAfter: 0,
                reason: "Restricted alcohol product retired from Ysabelle Store catalog.",
                referenceType: CLEANUP_REFERENCE_TYPE,
                referenceId: CLEANUP_REFERENCE_ID
              }
            });
            inventoryMovementsCreated += 1;
          }

          await tx.inventory.update({
            where: { id: product.inventory.id },
            data: {
              quantityOnHand: 0,
              lastStockUpdatedAt: new Date(),
              version: { increment: 1 }
            }
          });
          inventoryUnitsRemoved += quantityBefore;
        }

        const batchResult = await tx.inventoryBatch.updateMany({
          where: {
            productId: product.id,
            OR: [
              { quantityRemaining: { gt: 0 } },
              { status: { not: InventoryBatchStatus.REMOVED } }
            ]
          },
          data: {
            quantityRemaining: 0,
            status: InventoryBatchStatus.REMOVED
          }
        });
        batchesRemoved += batchResult.count;

        await tx.product.update({
          where: { id: product.id },
          data: {
            categoryId: retiredCategory.id,
            dataQualityStatus: CatalogQualityStatus.REJECTED,
            isStorefrontVisible: false,
            reorderLevel: 0,
            targetStockLevel: 0,
            status: ProductStatus.DISCONTINUED
          }
        });
        restrictedProductsRetired += 1;
        continue;
      }

      const taxonomy = storefrontCategoryForSource(sourceCategory)!;
      const targetCategory = categoryByPublicName.get(taxonomy.name)!;
      if (product.categoryId !== targetCategory.id) {
        await tx.product.update({
          where: { id: product.id },
          data: { categoryId: targetCategory.id }
        });
        remappedProducts += 1;
      }
    }

    const publicNames = new Set(STOREFRONT_CATEGORY_NAMES.map(normalize));
    const legacyNames = new Set(LEGACY_CATEGORY_NAMES.map(normalize));
    let legacyCategoriesDeleted = 0;
    let legacyCategoriesDeactivated = 0;

    const postRemapCategories = (await tx.category.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { products: true } }
      }
    })) as PostRemapCategoryRow[];

    for (const category of postRemapCategories) {
      const normalizedName = normalize(category.name);
      if (publicNames.has(normalizedName) || category.id === retiredCategory.id) continue;
      if (!legacyNames.has(normalizedName)) continue;

      if (category._count.products === 0) {
        await tx.category.delete({ where: { id: category.id } });
        legacyCategoriesDeleted += 1;
      } else {
        await tx.category.update({
          where: { id: category.id },
          data: {
            isActive: false,
            isStorefrontVisible: false,
            dataQualityStatus: CatalogQualityStatus.REJECTED
          }
        });
        legacyCategoriesDeactivated += 1;
      }
    }

    return {
      summary: {
        sourceMappingsChecked: mappings.length,
        publicCategoryCount: STOREFRONT_CATEGORY_TAXONOMY.length,
        remappedProducts,
        restrictedProductsRetired,
        inventoryUnitsRemoved,
        batchesRemoved,
        inventoryMovementsCreated,
        legacyCategoriesDeleted,
        legacyCategoriesDeactivated
      }
    };
  });
}
