export type UnresolvedCatalogImageCleanupStatus =
  | "NEEDS_REVIEW"
  | "VARIANT_SIZE_MISMATCH"
  | "DUPLICATE_IMAGE"
  | "MISSING_IMAGE";

export type UnresolvedCatalogImageCleanupIdentity = {
  productCode: string;
  sourceName: string;
  imageStatus: UnresolvedCatalogImageCleanupStatus;
};

// Frozen from the reviewed Phase 9 reconciliation at commit
// 61bf0f085b5cca5c082d4d60e5ed766308cc4d9f. P132 is deliberately absent because its
// reviewed Drive asset resolves as EXACT_MATCH.
export const UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES = [
  {
    productCode: "P003",
    sourceName: "Nescafe Creamy Latte / Blue Sachet",
    imageStatus: "NEEDS_REVIEW"
  },
  {
    productCode: "P015",
    sourceName: "Brown/Gold Canned Sardines, Brand Unclear",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P021",
    sourceName: "Downy Fabric Conditioner Twin / Larger Sachet Pack",
    imageStatus: "NEEDS_REVIEW"
  },
  { productCode: "P035", sourceName: "Local Bread / Buns", imageStatus: "MISSING_IMAGE" },
  {
    productCode: "P042",
    sourceName: "Femme Bathroom Tissue Décor, 2-ply, 150 pulls / 300 sheets",
    imageStatus: "VARIANT_SIZE_MISMATCH"
  },
  {
    productCode: "P043",
    sourceName: "Bathroom Tissue Roll Pack, Pink Label",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P077",
    sourceName: "Pantene Pro-V Hair Fall Control Shampoo Sachet, 50% More",
    imageStatus: "VARIANT_SIZE_MISMATCH"
  },
  {
    productCode: "P091",
    sourceName: "Star Nutri-Meats Giniling Afritada 100g",
    imageStatus: "VARIANT_SIZE_MISMATCH"
  },
  {
    productCode: "P097",
    sourceName: "CDO Luncheon Meat Chinese Style",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P130",
    sourceName: "Nescafé Brown / Creamy Coffee Sachet",
    imageStatus: "MISSING_IMAGE"
  },
  { productCode: "P133", sourceName: "HawotHot Pork Siomai", imageStatus: "MISSING_IMAGE" },
  {
    productCode: "P136",
    sourceName: "Empress Shampoo Smooth & Shiny Sachet 21ml",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P137",
    sourceName: "Sunsilk Perfect Straight Shampoo Sachet 15ml",
    imageStatus: "NEEDS_REVIEW"
  },
  {
    productCode: "P138",
    sourceName: "Closeup Red Hot Gel Toothpaste 95ml",
    imageStatus: "NEEDS_REVIEW"
  },
  {
    productCode: "P140",
    sourceName: "Star Nutri-Meats Giniling 100g",
    imageStatus: "MISSING_IMAGE"
  },
  { productCode: "P142", sourceName: "555 Sardines Spanish Style", imageStatus: "NEEDS_REVIEW" },
  { productCode: "P143", sourceName: "555 Spicy Paksiw Tuna", imageStatus: "NEEDS_REVIEW" },
  {
    productCode: "P144",
    sourceName: "Ligo Sardines in Tomato Sauce Chili Added 155g",
    imageStatus: "NEEDS_REVIEW"
  },
  { productCode: "P151", sourceName: "Marino Chili Corned Tuna", imageStatus: "NEEDS_REVIEW" },
  { productCode: "P158", sourceName: "Disposable Plastic Cups Pack", imageStatus: "MISSING_IMAGE" },
  { productCode: "P169", sourceName: "Bioderm Intense Soap", imageStatus: "MISSING_IMAGE" },
  {
    productCode: "P208",
    sourceName: "Jolly Mushrooms Pieces & Stems Champignons",
    imageStatus: "MISSING_IMAGE"
  },
  { productCode: "P212", sourceName: "Cow Bell Evaposarap", imageStatus: "MISSING_IMAGE" },
  { productCode: "P213", sourceName: "Today’s Mixed Fruits", imageStatus: "MISSING_IMAGE" },
  { productCode: "P214", sourceName: "Dole Pineapple Tidbits", imageStatus: "MISSING_IMAGE" },
  { productCode: "P215", sourceName: "Dole Pineapple Chunks", imageStatus: "MISSING_IMAGE" },
  { productCode: "P216", sourceName: "Repacked Rice / Bigas", imageStatus: "MISSING_IMAGE" },
  {
    productCode: "P225",
    sourceName: "Victoria White Sugar 1/2 kilo",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P226",
    sourceName: "Victoria Washed Sugar 1/2 kilo",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P227",
    sourceName: "Victoria Brown Sugar 1/2 kilo",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P228",
    sourceName: "Crossini Bavarian Cream Bread",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P231",
    sourceName: "Pochi Marshmallow Choco Peanut Mango",
    imageStatus: "MISSING_IMAGE"
  },
  { productCode: "P232", sourceName: "Choco Mallows", imageStatus: "MISSING_IMAGE" },
  {
    productCode: "P233",
    sourceName: "Jellyum Strawberry Flavored Gummi Kendi",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P240",
    sourceName: "Victoria White Sugar 1/4 kilo",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P262",
    sourceName: "Creamline Ube Queso Pastillas Ice Cream 1.3L",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P263",
    sourceName: "Creamline Family Duo Ice Cream",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P277",
    sourceName: "Lemon Square Whatta Tops Vanilla Cream",
    imageStatus: "MISSING_IMAGE"
  },
  { productCode: "P278", sourceName: "Lemon Square Lava Cake", imageStatus: "DUPLICATE_IMAGE" },
  { productCode: "P288", sourceName: "Lemon Square Winter Cool Gum", imageStatus: "MISSING_IMAGE" },
  {
    productCode: "P290",
    sourceName: "Lemon Square Creamy Strawberry Smoothies Candy",
    imageStatus: "VARIANT_SIZE_MISMATCH"
  },
  {
    productCode: "P311",
    sourceName: "Jack ‘n Jill Jumbo Buco Salad",
    imageStatus: "MISSING_IMAGE"
  },
  { productCode: "P345", sourceName: "Special Mamons", imageStatus: "MISSING_IMAGE" },
  {
    productCode: "P363",
    sourceName: "Choco Mucho Cookies White Chocolate",
    imageStatus: "NEEDS_REVIEW"
  },
  {
    productCode: "P403",
    sourceName: "Ding Dong Mixed Nuts Yellow Pack",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P404",
    sourceName: "Ding Dong Mixed Nuts Red Pack",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P405",
    sourceName: "Ding Dong Mixed Nuts Black Pack",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P406",
    sourceName: "Ding Dong Mixed Nuts Green Pack",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P421",
    sourceName: "Jack ‘n Jill Cream-O Premium Vanilla",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P444",
    sourceName: "Lemon Square Choochoo Cake Bites Strawberry",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P449",
    sourceName: "Monde Special Mamon Classic Saver Pack 12pcs",
    imageStatus: "MISSING_IMAGE"
  },
  {
    productCode: "P460",
    sourceName: "Wafertime Rich Creme Chocolate",
    imageStatus: "MISSING_IMAGE"
  },
  { productCode: "P467", sourceName: "Peewee Sizzling BBQ", imageStatus: "MISSING_IMAGE" }
] as const satisfies readonly UnresolvedCatalogImageCleanupIdentity[];

export const UNRESOLVED_CATALOG_IMAGE_CLEANUP_EXPECTED_COUNT = 53;
export const PROTECTED_REVIEWED_PRODUCT_CODE = "P132";
