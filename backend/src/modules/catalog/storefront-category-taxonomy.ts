export const RESTRICTED_ALCOHOL_SOURCE_CATEGORY = "Beverages / Alcohol";

export const STOREFRONT_CATEGORY_TAXONOMY = [
  {
    name: "Coffee & Milk",
    slug: "coffee-milk",
    sourceCategories: ["Beverages / Coffee & Milk"]
  },
  {
    name: "Juice, Tea, Soda & Water",
    slug: "juice-tea-soda-water",
    sourceCategories: ["Beverages / Juice, Tea, Soda & Water"]
  },
  {
    name: "Bread & Bakery",
    slug: "bread-bakery",
    sourceCategories: ["Bread & Bakery"]
  },
  {
    name: "Baking & Dessert",
    slug: "baking-dessert",
    sourceCategories: ["Baking / Spreads & Dessert Ingredients"]
  },
  {
    name: "Canned Goods",
    slug: "canned-goods",
    sourceCategories: ["Canned Goods"]
  },
  {
    name: "Condiments & Cooking",
    slug: "condiments-cooking",
    sourceCategories: ["Condiments & Cooking Ingredients"]
  },
  {
    name: "Noodles & Pasta",
    slug: "noodles-pasta",
    sourceCategories: ["Noodles & Pasta"]
  },
  {
    name: "Rice & Staples",
    slug: "rice-staples",
    sourceCategories: ["Rice & Staples"]
  },
  {
    name: "Snacks & Confectionery",
    slug: "snacks-confectionery",
    sourceCategories: ["Snacks / Biscuits & Confectionery"]
  },
  {
    name: "Frozen & Chilled",
    slug: "frozen-chilled",
    sourceCategories: ["Frozen / Chilled"]
  },
  {
    name: "Household Supplies",
    slug: "household-supplies",
    sourceCategories: ["Household Supplies"]
  },
  {
    name: "Laundry Supplies",
    slug: "laundry-supplies",
    sourceCategories: ["Laundry Supplies"]
  },
  {
    name: "Personal Care & Hygiene",
    slug: "personal-care-hygiene",
    sourceCategories: ["Personal Care / Hygiene"]
  },
  {
    name: "Tissue & Cotton",
    slug: "tissue-cotton",
    sourceCategories: ["Tissue & Cotton"]
  }
] as const;

export type StorefrontCategoryName = (typeof STOREFRONT_CATEGORY_TAXONOMY)[number]["name"];

export const STOREFRONT_CATEGORY_NAMES = STOREFRONT_CATEGORY_TAXONOMY.map((row) => row.name);

const categoryRank = new Map(STOREFRONT_CATEGORY_NAMES.map((name, index) => [name, index]));
const categoryBySource = new Map(
  STOREFRONT_CATEGORY_TAXONOMY.flatMap((row) =>
    row.sourceCategories.map((sourceCategory) => [sourceCategory, row] as const)
  )
);

export function storefrontCategoryForSource(sourceCategory: string) {
  return categoryBySource.get(sourceCategory) ?? null;
}

export function compareStorefrontCategoryNames(left: string, right: string) {
  const leftRank = categoryRank.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightRank = categoryRank.get(right) ?? Number.MAX_SAFE_INTEGER;
  return leftRank - rightRank || left.localeCompare(right);
}
