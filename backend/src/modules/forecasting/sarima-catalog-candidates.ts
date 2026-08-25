export const SARIMA_WORKBOOK_DATASET = "historical-sales-2024-2025";
export const SARIMA_CATALOG_MAPPING_ACTOR = "sarima-catalog-mapping-v1";

export type SarimaCatalogCandidate = {
  brand: string;
  canonicalName: string;
  catalogCategory: string;
  id: string;
  imageUrl?: string;
  sizeUnit: "GRAM" | "LITER" | "MILLILITER";
  sizeValue: number;
  sku: string;
  sourceProductId: string;
  unit: "BOTTLE" | "PACK" | "PIECE" | "SACHET";
  variant: string | null;
};

/**
 * The first reviewed storefront-catalog cohort. Each row is intentionally limited to
 * facts present in the paired workbook identity: explicit brand/product wording and
 * package size. The values are internal catalog SKUs, not inferred supplier codes.
 */
export const SARIMA_CATALOG_CANDIDATES = [
  {
    id: "prd_sarima_p218_natures_spring_350ml",
    sku: "SARIMA-P218",
    sourceProductId: "P218",
    catalogCategory: "Beverages",
    brand: "Nature's Spring",
    canonicalName: "Nature's Spring Purified Drinking Water 350mL",
    variant: "Purified Drinking Water",
    sizeValue: 350,
    sizeUnit: "MILLILITER",
    unit: "BOTTLE"
  },
  {
    id: "prd_sarima_p217_wilkins_500ml",
    sku: "SARIMA-P217",
    sourceProductId: "P217",
    catalogCategory: "Beverages",
    brand: "Wilkins",
    canonicalName: "Wilkins Pure Drinking Water 500mL",
    variant: "Pure Drinking Water",
    sizeValue: 500,
    sizeUnit: "MILLILITER",
    unit: "BOTTLE"
  },
  {
    id: "prd_sarima_p237_pocari_sweat_500ml",
    sku: "SARIMA-P237",
    sourceProductId: "P237",
    catalogCategory: "Beverages",
    brand: "Pocari Sweat",
    canonicalName: "Pocari Sweat 500mL",
    variant: null,
    sizeValue: 500,
    sizeUnit: "MILLILITER",
    unit: "BOTTLE"
  },
  {
    id: "prd_sarima_p261_coca_cola_15l",
    sku: "SARIMA-P261",
    sourceProductId: "P261",
    catalogCategory: "Beverages",
    brand: "Coca-Cola",
    canonicalName: "Coca-Cola 1.5L",
    variant: null,
    sizeValue: 1.5,
    sizeUnit: "LITER",
    unit: "BOTTLE"
  },
  {
    id: "prd_sarima_p144_ligo_sardines_155g",
    sku: "SARIMA-P144",
    sourceProductId: "P144",
    catalogCategory: "Canned Goods",
    brand: "Ligo",
    canonicalName: "Ligo Sardines in Tomato Sauce, Chili Added 155g",
    imageUrl: "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp",
    variant: "Tomato Sauce, Chili Added",
    sizeValue: 155,
    sizeUnit: "GRAM",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p091_star_nutri_meats_afritada_100g",
    sku: "SARIMA-P091",
    sourceProductId: "P091",
    catalogCategory: "Canned Goods",
    brand: "Star Nutri-Meats",
    canonicalName: "Star Nutri-Meats Giniling Afritada 100g",
    variant: "Giniling Afritada",
    sizeValue: 100,
    sizeUnit: "GRAM",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p088_fresca_tuna_175g",
    sku: "SARIMA-P088",
    sourceProductId: "P088",
    catalogCategory: "Canned Goods",
    brand: "Fresca",
    canonicalName: "Fresca Tuna Flakes in Oil 175g",
    variant: "Flakes in Oil",
    sizeValue: 175,
    sizeUnit: "GRAM",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p098_argentina_luncheon_meat_340g",
    sku: "SARIMA-P098",
    sourceProductId: "P098",
    catalogCategory: "Canned Goods",
    brand: "Argentina",
    canonicalName: "Argentina Chicken Luncheon Meat 340g",
    variant: "Chicken",
    sizeValue: 340,
    sizeUnit: "GRAM",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p102_ladys_choice_mayonnaise_72ml",
    sku: "SARIMA-P102",
    sourceProductId: "P102",
    catalogCategory: "Condiments & Cooking",
    brand: "Lady's Choice",
    canonicalName: "Lady's Choice Real Mayonnaise 72mL",
    variant: "Real Mayonnaise",
    sizeValue: 72,
    sizeUnit: "MILLILITER",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p241_del_monte_tomato_sauce_250g",
    sku: "SARIMA-P241",
    sourceProductId: "P241",
    catalogCategory: "Condiments & Cooking",
    brand: "Del Monte",
    canonicalName: "Del Monte Original Style Tomato Sauce 250g",
    variant: "Original Style",
    sizeValue: 250,
    sizeUnit: "GRAM",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p078_sunsilk_perfect_straight_13ml",
    sku: "SARIMA-P078",
    sourceProductId: "P078",
    catalogCategory: "Personal Care",
    brand: "Sunsilk",
    canonicalName: "Sunsilk Perfect Straight Shampoo Sachet 13mL",
    variant: "Perfect Straight",
    sizeValue: 13,
    sizeUnit: "MILLILITER",
    unit: "SACHET"
  },
  {
    id: "prd_sarima_p054_sunsilk_anti_dandruff_135ml",
    sku: "SARIMA-P054",
    sourceProductId: "P054",
    catalogCategory: "Personal Care",
    brand: "Sunsilk",
    canonicalName: "Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL",
    imageUrl: "/images/products/sunsilk-anti-dandruff-silky-shampoo-sachet-13-5ml.webp",
    variant: "Anti-Dandruff & Silky",
    sizeValue: 13.5,
    sizeUnit: "MILLILITER",
    unit: "SACHET"
  },
  {
    id: "prd_sarima_p080_colgate_maximum_cavity_74g",
    sku: "SARIMA-P080",
    sourceProductId: "P080",
    catalogCategory: "Personal Care",
    brand: "Colgate",
    canonicalName: "Colgate Maximum Cavity Protection Toothpaste 74g",
    variant: "Maximum Cavity Protection",
    sizeValue: 74,
    sizeUnit: "GRAM",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p065_dr_wongs_sulfur_soap_80g",
    sku: "SARIMA-P065",
    sourceProductId: "P065",
    catalogCategory: "Personal Care",
    brand: "Dr. Wong's",
    canonicalName: "Dr. Wong's Sulfur Soap 80g",
    variant: "Sulfur",
    sizeValue: 80,
    sizeUnit: "GRAM",
    unit: "PIECE"
  },
  {
    id: "prd_sarima_p443_payless_yakisoba_59g",
    sku: "SARIMA-P443",
    sourceProductId: "P443",
    catalogCategory: "Instant Food",
    brand: "Payless",
    canonicalName: "Payless Yakisoba Spicy Chicken 59g",
    variant: "Spicy Chicken",
    sizeValue: 59,
    sizeUnit: "GRAM",
    unit: "PACK"
  },
  {
    id: "prd_sarima_p425_oishi_ridges_bbq_60g",
    sku: "SARIMA-P425",
    sourceProductId: "P425",
    catalogCategory: "Snacks",
    brand: "Oishi",
    canonicalName: "Oishi Ridges Barbecue Flavor 60g",
    variant: "Barbecue Flavor",
    sizeValue: 60,
    sizeUnit: "GRAM",
    unit: "PACK"
  },
  {
    id: "prd_sarima_p370_piattos_cheese_85g",
    sku: "SARIMA-P370",
    sourceProductId: "P370",
    catalogCategory: "Snacks",
    brand: "Jack 'n Jill Piattos",
    canonicalName: "Jack 'n Jill Piattos Cheese 85g",
    variant: "Cheese",
    sizeValue: 85,
    sizeUnit: "GRAM",
    unit: "PACK"
  },
  {
    id: "prd_sarima_p022_gardenia_white_bread_600g",
    sku: "SARIMA-P022",
    sourceProductId: "P022",
    catalogCategory: "Bread & Bakery",
    brand: "Gardenia",
    canonicalName: "Gardenia Enriched White Bread 600g",
    imageUrl: "/images/products/gardenia-enriched-white-bread-600g.webp",
    variant: "Enriched White",
    sizeValue: 600,
    sizeUnit: "GRAM",
    unit: "PACK"
  },
  {
    id: "prd_sarima_p038_purefoods_tocino_450g",
    sku: "SARIMA-P038",
    sourceProductId: "P038",
    catalogCategory: "Frozen & Chilled",
    brand: "Purefoods",
    canonicalName: "Purefoods Classic Tocino 450g",
    variant: "Classic",
    sizeValue: 450,
    sizeUnit: "GRAM",
    unit: "PACK"
  },
  {
    id: "prd_sarima_p385_nescafe_classic_80g",
    sku: "SARIMA-P385",
    sourceProductId: "P385",
    catalogCategory: "Beverages",
    brand: "Nescafe",
    canonicalName: "Nescafe Classic 80g",
    variant: "Classic",
    sizeValue: 80,
    sizeUnit: "GRAM",
    unit: "PACK"
  }
] as const satisfies readonly SarimaCatalogCandidate[];

export const ABOUT_STORE_ESSENTIAL_SOURCE_PRODUCT_IDS = ["P218", "P144", "P054", "P022"] as const;
