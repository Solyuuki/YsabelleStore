import type { ProductionCatalog50Plan } from "./catalog-production-ready-50-execution.js";

const EXPECTED_PRODUCT_NAMES: Readonly<Record<string, string>> = {
  P299: "Jack ‘n Jill Piattos Supersized Cheese",
  P352: "Presto Creams Peanut Butter Sandwich Cookies",
  P361: "Rebisco Magic Flakes Cheese",
  P023: "Gardenia California Raisin Loaf 400g",
  P024: "Gardenia High Fiber Whole Wheat Bread 400g",
  P027: "Marby Cheese Bites Healthy Kids Pack",
  P030: "Marby Mini Mamon 70g",
  P031: "Marby Hopia Roll Mongo 220g",
  P201: "Barrio Fiesta Ginisang Bagoong Spicy 250g",
  P202: "Barrio Fiesta Ginisang Bagoong Regular 250g",
  P204: "Alaska Sweetened Filled Milk 377g",
  P219: "Nature’s Spring Purified Drinking Water 500ml",
  P238: "Pocari Sweat 900ml",
  P022: "Gardenia Enriched White Bread 600g",
  P074: "Those Days Regular Pads 8 Pads, Red Pack",
  P075: "Those Days All Night Pads 8 Pads, Purple Pack",
  P089: "Fresca Tuna Hot & Spicy 175g",
  P103: "Lady’s Choice Chicken Spread 27mL",
  P122: "Hokkaido Mackerel in Oil 425g",
  P141: "Magnolia Cheezee 160g",
  P317: "Nature’s Spring Distilled Drinking Water 10L",
  P318: "Wilkins Distilled Drinking Water 7L",
  P397: "Alaska Fortified Powdered Milk Drink 300g",
  P268: "Absolute Pure Distilled Drinking Water 500ml",
  P115: "Eden Original Cheese 160g Box",
  P048: "Happy Absorbent Cotton 10g",
  P342: "Jack ‘n Jill Cloud 9 Classic 12 Bars",
  P386: "Nescafé Classic 48 Sticks",
  P085: "555 Tuna Adobo",
  P114: "555 Tuna Afritada",
  P011: "555 Tuna Caldereta",
  P009: "555 Tuna Flakes in Oil",
  P010: "555 Tuna Mechado",
  P012: "555 Tuna Spicy Paksiw",
  P013: "555 Sardines in Tomato Sauce",
  P121: "555 Hot Sardines in Tomato Sauce",
  P087: "555 Spanish Style Sardines",
  P086: "555 Tuna Sisig",
  P054: "Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5ml",
  P123: "SABA Mackerel in Natural Oil 155g",
  P038: "Purefoods Classic Tocino 450g",
  P199: "Jersey Melon Condensed Creamer 390g",
  P343: "Jack ‘n Jill Cloud 9 Overload 12 Bars",
  P061: "Irish Spring Original Soap 113g",
  P008: "Century Tuna Flakes in Oil",
  P107: "Argentina Corned Beef",
  P177: "Datu Puti Soy Sauce Pouch",
  P394: "Bear Brand Fortified Powdered Milk Drink",
  P266: "100 Plus Active Bottle",
  P257: "C2 Apple Green Tea Bottle"
};

export function assertProductionCatalog50Names(plan: ProductionCatalog50Plan) {
  for (const product of plan.products) {
    const expectedName = EXPECTED_PRODUCT_NAMES[product.sourceProductId];
    if (!expectedName || product.name !== expectedName) {
      throw new Error(
        `PRODUCTION_CATALOG_50_NAME_MISMATCH: ${product.sku} expected "${expectedName ?? "MISSING"}", found "${product.name}"`
      );
    }
  }
}
