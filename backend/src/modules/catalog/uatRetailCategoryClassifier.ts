import {
  STOREFRONT_CATEGORY_TAXONOMY,
  storefrontCategoryForSource
} from "./storefront-category-taxonomy.js";

// D01: reviewed SKU exceptions where source classification follows an ingredient/flavour
// word rather than the actual retail product type. Never infer cheese from snack flavours.
const OVERRIDES: Record<string, string[]> = {
  "dairy-eggs": [
    "P104",
    "P105",
    "P115",
    "P116",
    "P141",
    "P193",
    "P194",
    "P198",
    "P199",
    "P204",
    "P205",
    "P206",
    "P212",
    "P247",
    "P252",
    "P264",
    "P265",
    "P314",
    "P315",
    "P436",
    "P437"
  ],
  "snacks-confectionery": [
    "P232",
    "P233",
    "P236",
    "P250",
    "P297",
    "P299",
    "P305",
    "P307",
    "P321",
    "P335",
    "P352",
    "P361",
    "P373",
    "P401",
    "P412",
    "P426",
    "P427",
    "P430",
    "P462",
    "P464",
    "P272",
    "P273",
    "P301",
    "P302",
    "P319",
    "P320",
    "P346",
    "P433",
    "P434",
    "P289"
  ],
  "condiments-cooking": ["P100", "P101", "P103", "P117", "P179", "P191", "P249"],
  "canned-goods": ["P195", "P196", "P208", "P213", "P214", "P215"],
  "noodles-pasta": ["P209", "P210", "P326"],
  "baking-dessert": ["P190", "P244", "P245", "P246"],
  "household-supplies": ["P207"],
  "rice-staples": ["P366"],
  "coffee-milk": ["P385"],
  "bread-bakery": ["P279", "P332"]
};

const overrides = new Map<string, string>(
  Object.entries(OVERRIDES).flatMap(([slug, codes]) =>
    codes.map((code) => [`SARIMA-${code}`, slug] as const)
  )
);
if (overrides.size !== Object.values(OVERRIDES).flat().length) {
  throw new Error("D01_DUPLICATE_SKU_CLASSIFICATION");
}

const knownSlugs = new Set<string>(STOREFRONT_CATEGORY_TAXONOMY.map((row) => row.slug));
const legacySlugs: Record<string, string> = {
  beverages: "juice-tea-soda-water",
  household: "household-supplies",
  "instant-food": "noodles-pasta",
  "personal-care": "personal-care-hygiene",
  snacks: "snacks-confectionery",
  staples: "rice-staples",
  "canned-goods": "canned-goods",
  "baking-spreads-dessert-ingredients": "baking-dessert",
  "beverages-coffee-milk": "coffee-milk",
  "beverages-juice-tea-soda-water": "juice-tea-soda-water",
  "condiments-cooking-ingredients": "condiments-cooking",
  "snacks-biscuits-confectionery": "snacks-confectionery",
  "frozen-chilled": "frozen-chilled",
  "tissue-cotton": "tissue-cotton"
};

export type RetailCategoryCandidate = {
  sku: string;
  name: string;
  currentSlug: string;
  sourceCategory?: string | null;
};

/** Return null when a product needs human review, never guess a category. */
export function desiredRetailCategorySlug(product: RetailCategoryCandidate): string | null {
  const sku = product.sku.trim().toUpperCase();
  const name = product.name.normalize("NFKC").toLowerCase();
  const matchedOverride = overrides.get(sku);
  if (matchedOverride) return matchedOverride;

  // The following exact retail-type hints repair non-SARIMA catalog uploads too.
  if (/\b(?:piattos|potato chips|corn chips|tortillos|cheese curls|chiz curls)\b/i.test(name))
    return "snacks-confectionery";
  if (
    /\b(?:bathroom tissue|toilet tissue|facial tissue|tissue roll|absorbent cotton)\b/i.test(name)
  )
    return "tissue-cotton";
  if (
    /\b(?:eden (?:original )?cheese|eden creamy slices|cheezee (?:cheese|spread)|quickmelt cheese)\b/i.test(
      name
    )
  )
    return "dairy-eggs";

  if (product.sourceCategory) {
    const fromSource = storefrontCategoryForSource(product.sourceCategory);
    if (fromSource) return fromSource.slug;
    // Restricted/unknown source categories must not be accidentally activated.
    return null;
  }
  const slug = product.currentSlug.trim().toLowerCase();
  const normalized = legacySlugs[slug] ?? slug;
  return knownSlugs.has(normalized) ? normalized : null;
}
