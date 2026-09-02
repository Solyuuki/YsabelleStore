export type DevelopmentCatalogSeedCategoryIdentity = {
  id: string;
  slug: string;
};

export const DEVELOPMENT_CATALOG_SEED_CATEGORY_IDENTITIES = [
  { id: "cat_beverages", slug: "beverages" },
  { id: "cat_canned_goods", slug: "canned-goods" },
  { id: "cat_snacks", slug: "snacks" },
  { id: "cat_instant_noodles", slug: "instant-noodles" },
  { id: "cat_toiletries", slug: "toiletries" },
  { id: "cat_household_products", slug: "household-products" }
] as const satisfies readonly DevelopmentCatalogSeedCategoryIdentity[];

const developmentSeedCategoryKeys = new Set(
  DEVELOPMENT_CATALOG_SEED_CATEGORY_IDENTITIES.map(({ id, slug }) => `${id}\u0000${slug}`)
);

export function isDevelopmentCatalogSeedCategory(category: { id: string; slug?: string }) {
  if (!category.slug) return false;
  return developmentSeedCategoryKeys.has(`${category.id}\u0000${category.slug}`);
}
