/**
 * Production catalog approval manifest.
 * Normalized from the user-reviewed catalog-50-production-readiness-redone.csv.
 * P254 is excluded by repository restricted-product policy; P022 is the
 * policy-safe replacement using already-committed verified barcode evidence.
 */
export type ProductionCatalog50Target = {
  sourceProductId: string;
  manufacturerBarcode: string;
  description: string;
};

export const PRODUCTION_CATALOG_50_EXPECTED_COUNT = 50;

export const PRODUCTION_CATALOG_50_TARGETS = [
  {
    sourceProductId: "P299",
    manufacturerBarcode: "4800016635724",
    description:
      "Cheese-flavored Jack ‘n Jill Piattos potato crisps in a supersized pack, made for a crunchy savory snack."
  },
  {
    sourceProductId: "P352",
    manufacturerBarcode: "4800010076073",
    description:
      "Peanut butter cream-filled sandwich cookies with crisp biscuit layers and a sweet, nutty filling."
  },
  {
    sourceProductId: "P361",
    manufacturerBarcode: "4800016082641",
    description:
      "Crisp Magic Flakes crackers with a savory cheese flavor, suitable for snacks or baon."
  },
  {
    sourceProductId: "P023",
    manufacturerBarcode: "4806502721445",
    description:
      "Gardenia California Raisin Loaf made with raisins in a soft 400g loaf for breakfast, snacks, or sandwiches."
  },
  {
    sourceProductId: "P024",
    manufacturerBarcode: "4806502721452",
    description:
      "Gardenia High Fiber Whole Wheat Bread in a 400g loaf, made for everyday sandwiches, toast, and breakfast meals."
  },
  {
    sourceProductId: "P027",
    manufacturerBarcode: "4800148535992",
    description:
      "Marby Cheese Bites in a kid-friendly pack, featuring soft bite-sized bread pieces with a savory cheese flavor."
  },
  {
    sourceProductId: "P030",
    manufacturerBarcode: "4800148536791",
    description:
      "Marby Mini Mamon is a soft, lightly sweet Filipino sponge cake in a convenient 70g snack pack."
  },
  {
    sourceProductId: "P031",
    manufacturerBarcode: "4800148532267",
    description:
      "Marby Hopia Roll Mongo is a 220g pastry pack filled with sweet mung bean filling and rolled in a soft, flaky crust."
  },
  {
    sourceProductId: "P201",
    manufacturerBarcode: "737552870453",
    description:
      "Barrio Fiesta Ginisang Bagoong Spicy is sautéed shrimp paste with a spicy savory-sweet flavor in a 250g jar."
  },
  {
    sourceProductId: "P202",
    manufacturerBarcode: "737552870439",
    description:
      "Barrio Fiesta Ginisang Bagoong Regular is sautéed shrimp paste with a savory-sweet flavor in a 250g jar."
  },
  {
    sourceProductId: "P204",
    manufacturerBarcode: "4800575120303",
    description:
      "Alaska Classic Sweetened Condensed Filled Milk is a rich and sweet 377g milk product for desserts, drinks, and recipes."
  },
  {
    sourceProductId: "P219",
    manufacturerBarcode: "4800049720114",
    description:
      "Nature’s Spring Purified Drinking Water is purified bottled water in a convenient 500mL size for everyday hydration."
  },
  {
    sourceProductId: "P238",
    manufacturerBarcode: "4800350108878",
    description:
      "Pocari Sweat is an ion-supply hydration drink in a 900mL bottle formulated to help replenish water and electrolytes."
  },
  {
    sourceProductId: "P022",
    manufacturerBarcode: "4806502720615",
    description:
      "Gardenia Enriched White Bread is a soft 600g loaf for everyday sandwiches, toast, breakfast, and snacks."
  },
  {
    sourceProductId: "P074",
    manufacturerBarcode: "4801288850082",
    description:
      "Those Days Regular With Wings contains 8 sanitary pads designed for regular daytime menstrual protection."
  },
  {
    sourceProductId: "P075",
    manufacturerBarcode: "4801288870080",
    description:
      "Those Days All Night With Wings contains 8 sanitary pads designed for extended overnight menstrual protection."
  },
  {
    sourceProductId: "P089",
    manufacturerBarcode: "748485900087",
    description:
      "Fresca Tuna Hot & Spicy is a 175g canned tuna product with a savory hot-and-spicy flavor, ready to pair with rice or meals."
  },
  {
    sourceProductId: "P103",
    manufacturerBarcode: "4800888607119",
    description:
      "Lady’s Choice Chicken Spread is a creamy chicken-flavored sandwich spread in a convenient 27mL single-use pack."
  },
  {
    sourceProductId: "P122",
    manufacturerBarcode: "4800158987019",
    description:
      "Hokkaido Mackerel in Oil is a 425g canned mackerel product packed in oil for ready-to-serve meals and cooking."
  },
  {
    sourceProductId: "P141",
    manufacturerBarcode: "4805358317031",
    description:
      "Magnolia Cheezee is a 160g processed cheese product with a creamy, savory cheese taste for sandwiches, snacks, and cooking."
  },
  {
    sourceProductId: "P317",
    manufacturerBarcode: "4800049720244",
    description:
      "Nature’s Spring Distilled Drinking Water is distilled water in a large 10-liter container for household drinking-water needs."
  },
  {
    sourceProductId: "P318",
    manufacturerBarcode: "4801981164714",
    description:
      "Wilkins Distilled Drinking Water is distilled water in a 7-liter container for convenient household hydration."
  },
  {
    sourceProductId: "P397",
    manufacturerBarcode: "4800575144590",
    description:
      "Alaska Fortified Powdered Milk Drink is a 300g powdered milk drink formulated for everyday family nutrition."
  },
  {
    sourceProductId: "P268",
    manufacturerBarcode: "4800014144082",
    description: "Pure distilled drinking water in a 500mL bottle."
  },
  {
    sourceProductId: "P115",
    manufacturerBarcode: "4808647020094",
    description: "Original filled cheese in a 160g box."
  },
  {
    sourceProductId: "P048",
    manufacturerBarcode: "4801288820153",
    description: "Absorbent cotton roll, 10g pack."
  },
  {
    sourceProductId: "P342",
    manufacturerBarcode: "4800010781076",
    description: "Cloud 9 Classic chocolate bars, inner box of 12 x 28g bars."
  },
  {
    sourceProductId: "P386",
    manufacturerBarcode: "4800361388252",
    description: "Nescafé Classic instant coffee, 48 sticks x 2g."
  },
  {
    sourceProductId: "P085",
    manufacturerBarcode: "748485700014",
    description: "555 Tuna Adobo, ready-to-eat tuna flakes in adobo-style sauce, 155g."
  },
  {
    sourceProductId: "P114",
    manufacturerBarcode: "748485700021",
    description: "555 Tuna Afritada, ready-to-eat tuna flakes in afritada-style sauce, 155g."
  },
  {
    sourceProductId: "P011",
    manufacturerBarcode: "748485700038",
    description: "555 Tuna Caldereta, ready-to-eat tuna flakes in caldereta-style sauce, 155g."
  },
  {
    sourceProductId: "P009",
    manufacturerBarcode: "748485700083",
    description: "555 Tuna Flakes in Oil, 155g can."
  },
  {
    sourceProductId: "P010",
    manufacturerBarcode: "748485700045",
    description: "555 Tuna Mechado, ready-to-eat tuna flakes in mechado-style sauce, 155g."
  },
  {
    sourceProductId: "P012",
    manufacturerBarcode: "748485701387",
    description: "555 Tuna Spicy Paksiw, ready-to-eat tuna in spicy paksiw-style sauce, 155g."
  },
  {
    sourceProductId: "P013",
    manufacturerBarcode: "748485200019",
    description: "555 Sardines in Tomato Sauce, 155g can."
  },
  {
    sourceProductId: "P121",
    manufacturerBarcode: "748485200026",
    description: "555 Sardines in Tomato Sauce with Chili, 155g can."
  },
  {
    sourceProductId: "P087",
    manufacturerBarcode: "748485200040",
    description: "555 Spanish Style Sardines, 155g can."
  },
  {
    sourceProductId: "P086",
    manufacturerBarcode: "748485701448",
    description: "555 Tuna Sizzling Sisig, 155g can."
  },
  {
    sourceProductId: "P054",
    manufacturerBarcode: "4800888282965",
    description: "Sunsilk Anti-Dandruff Healthy & Strong shampoo sachet, 13.5mL."
  },
  {
    sourceProductId: "P123",
    manufacturerBarcode: "096785013298",
    description: "SABA Mackerel in Natural Oil with salt added, 155g can."
  },
  {
    sourceProductId: "P038",
    manufacturerBarcode: "4808887970531",
    description: "Purefoods Classic Tocino, 450g frozen pack."
  },
  {
    sourceProductId: "P199",
    manufacturerBarcode: "4806516760430",
    description: "Jersey Melon flavored sweetened condensed creamer, 390g."
  },
  {
    sourceProductId: "P343",
    manufacturerBarcode: "4800016963827",
    description: "Cloud 9 Overload chocolate bars, 12-bar pack."
  },
  {
    sourceProductId: "P061",
    manufacturerBarcode: "035000141088",
    description: "Irish Spring Original deodorant bar soap, 113g."
  },
  {
    sourceProductId: "P008",
    manufacturerBarcode: "748485100081",
    description:
      "Tuna flakes packed in vegetable oil in a 180g can, ready to serve with rice or use in sandwiches, pasta, and other meals."
  },
  {
    sourceProductId: "P107",
    manufacturerBarcode: "748485800011",
    description:
      "Ready-to-cook corned beef in a 175g can, fortified with zinc and iron and suitable for everyday rice meals and breakfast dishes."
  },
  {
    sourceProductId: "P177",
    manufacturerBarcode: "4801668500224",
    description:
      "Filipino-style soy sauce in a 1-liter bottle, used for marinades, dipping sauces, and everyday savory cooking."
  },
  {
    sourceProductId: "P394",
    manufacturerBarcode: "4800361388047",
    description:
      "Fortified powdered milk drink with essential nutrients for everyday family nutrition, packed in a 900g format."
  },
  {
    sourceProductId: "P266",
    manufacturerBarcode: "4801981111831",
    description:
      "Carbonated isotonic drink formulated for hydration and refreshment, supplied in a convenient 500mL bottle."
  },
  {
    sourceProductId: "P257",
    manufacturerBarcode: "9556001216786",
    description:
      "Ready-to-drink apple-flavored green tea with a light, refreshing taste in a 500mL bottle."
  }
] as const satisfies readonly ProductionCatalog50Target[];
