# SARIMA-Backed Storefront Catalog Cohort

Implemented: 2026-08-11

## Architecture and confidence

The active SARIMA source remains the paired 2024 and 2025 historical workbooks. The catalog
cohort does not alter the workbooks, `P001` through `P472` identifiers, forecast batch, or SARIMA
parameters.

Each source identity is stored in `SarimaSourceProductMapping` as a one-to-one bridge from a key
such as `workbook:P218` to a canonical `Product.id`. This is separate from
`ProductCanonicalMapping`, which is reserved for catalog-product deduplication. The mapping keeps
the source name, source category, last recorded workbook price, history range and quantity,
confidence, forecast result, and evidence JSON. `SARIMA-Pxxx` is an internal catalog SKU, never an
inferred supplier code or GTIN.

All 20 rows are HIGH-confidence source-to-canonical mappings: every row has a paired 24-month
series, an active `SARIMA` / `READY` forecast for the same source key, an exact normalized source
name match, and explicit brand/product/package-size information in its source row. This does not
claim that an unprovided GTIN or supplier code exists.

## Mapped products

| Workbook ID | Product ID                                       | SKU           | Name                                                | Category             | Units | SARIMA | Image    |
| ----------- | ------------------------------------------------ | ------------- | --------------------------------------------------- | -------------------- | ----: | ------ | -------- |
| `P218`      | `prd_sarima_p218_natures_spring_350ml`           | `SARIMA-P218` | Nature's Spring Purified Drinking Water 350mL       | Beverages            |   713 | READY  | Fallback |
| `P217`      | `prd_sarima_p217_wilkins_500ml`                  | `SARIMA-P217` | Wilkins Pure Drinking Water 500mL                   | Beverages            |   477 | READY  | Fallback |
| `P237`      | `prd_sarima_p237_pocari_sweat_500ml`             | `SARIMA-P237` | Pocari Sweat 500mL                                  | Beverages            |   205 | READY  | Fallback |
| `P261`      | `prd_sarima_p261_coca_cola_15l`                  | `SARIMA-P261` | Coca-Cola 1.5L                                      | Beverages            |   104 | READY  | Fallback |
| `P144`      | `prd_sarima_p144_ligo_sardines_155g`             | `SARIMA-P144` | Ligo Sardines in Tomato Sauce, Chili Added 155g     | Canned Goods         |   244 | READY  | Fallback |
| `P091`      | `prd_sarima_p091_star_nutri_meats_afritada_100g` | `SARIMA-P091` | Star Nutri-Meats Giniling Afritada 100g             | Canned Goods         |   253 | READY  | Fallback |
| `P088`      | `prd_sarima_p088_fresca_tuna_175g`               | `SARIMA-P088` | Fresca Tuna Flakes in Oil 175g                      | Canned Goods         |   170 | READY  | Fallback |
| `P098`      | `prd_sarima_p098_argentina_luncheon_meat_340g`   | `SARIMA-P098` | Argentina Chicken Luncheon Meat 340g                | Canned Goods         |    53 | READY  | Fallback |
| `P102`      | `prd_sarima_p102_ladys_choice_mayonnaise_72ml`   | `SARIMA-P102` | Lady's Choice Real Mayonnaise 72mL                  | Condiments & Cooking |   191 | READY  | Fallback |
| `P241`      | `prd_sarima_p241_del_monte_tomato_sauce_250g`    | `SARIMA-P241` | Del Monte Original Style Tomato Sauce 250g          | Condiments & Cooking |   178 | READY  | Fallback |
| `P078`      | `prd_sarima_p078_sunsilk_perfect_straight_13ml`  | `SARIMA-P078` | Sunsilk Perfect Straight Shampoo Sachet 13mL        | Personal Care        |   711 | READY  | Fallback |
| `P054`      | `prd_sarima_p054_sunsilk_anti_dandruff_135ml`    | `SARIMA-P054` | Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL | Personal Care        |   686 | READY  | Fallback |
| `P080`      | `prd_sarima_p080_colgate_maximum_cavity_74g`     | `SARIMA-P080` | Colgate Maximum Cavity Protection Toothpaste 74g    | Personal Care        |    52 | READY  | Fallback |
| `P065`      | `prd_sarima_p065_dr_wongs_sulfur_soap_80g`       | `SARIMA-P065` | Dr. Wong's Sulfur Soap 80g                          | Personal Care        |    94 | READY  | Fallback |
| `P443`      | `prd_sarima_p443_payless_yakisoba_59g`           | `SARIMA-P443` | Payless Yakisoba Spicy Chicken 59g                  | Instant Food         |   346 | READY  | Fallback |
| `P425`      | `prd_sarima_p425_oishi_ridges_bbq_60g`           | `SARIMA-P425` | Oishi Ridges Barbecue Flavor 60g                    | Snacks               |   268 | READY  | Fallback |
| `P370`      | `prd_sarima_p370_piattos_cheese_85g`             | `SARIMA-P370` | Jack 'n Jill Piattos Cheese 85g                     | Snacks               |   183 | READY  | Fallback |
| `P022`      | `prd_sarima_p022_gardenia_white_bread_600g`      | `SARIMA-P022` | Gardenia Enriched White Bread 600g                  | Bread & Bakery       |    99 | READY  | Fallback |
| `P038`      | `prd_sarima_p038_purefoods_tocino_450g`          | `SARIMA-P038` | Purefoods Classic Tocino 450g                       | Frozen & Chilled     |    53 | READY  | Fallback |
| `P385`      | `prd_sarima_p385_nescafe_classic_80g`            | `SARIMA-P385` | Nescafe Classic 80g                                 | Beverages            |    90 | READY  | Fallback |

Every listed product retains 24 months of source history (`2024-01` to `2025-12`).

## Commercial and storefront state

The workbook price is persisted as the last recorded 2025 source price and recorded as historical
evidence, not as a new price quotation. Procurement cost is `null` and no inventory or inventory
batch was created. The normal inventory path therefore reports zero sellable units and keeps Quick
Add disabled. A stock-in operation now requires a verified product cost or an explicit operator
unit cost.

The products are active, approved, and storefront-visible because the product identity is
evidence-backed. They remain unavailable for fulfillment until an operator records real inventory.
Missing imagery alone does not block a legitimate listing.

## Scene 06

Scene 06 now references exactly four canonical mapped products:

1. `prd_sarima_p218_natures_spring_350ml` - Nature's Spring Purified Drinking Water 350mL
2. `prd_sarima_p144_ligo_sardines_155g` - Ligo Sardines in Tomato Sauce, Chili Added 155g
3. `prd_sarima_p443_payless_yakisoba_59g` - Payless Yakisoba Spicy Chicken 59g
4. `prd_sarima_p102_ladys_choice_mayonnaise_72ml` - Lady's Choice Real Mayonnaise 72mL

The selection spans beverage, canned goods, instant food, and condiments. It uses the normal
storefront API and does not bypass quality, availability, or cart rules.

## Image provenance and limitations

No image has been downloaded, hotlinked, or AI-generated. The paired workbooks carry no image
rights information, so the designed fallback remains in use. Per-product asset decisions are in
`frontend/public/images/products/SOURCES.md`.

Remaining operational work is owner-led: verify current retail and procurement price, record a
stock receipt, and add an exact rights-cleared asset where available. These actions make the
existing canonical records purchasable without changing SARIMA source identity.
