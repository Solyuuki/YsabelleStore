# Product Image Mapping Audit

Reviewed: 2026-08-14

## Executive summary

Thirty-five distinct image files from seven owner-supplied archives were reviewed against the 20
approved SARIMA-backed canonical products. Three images meet the exact package-identity standard and
were integrated. No image qualified only at high confidence, no ambiguous image was used, and no
new product or SKU was created.

| Status             | Count | Production use                                              |
| ------------------ | ----: | ----------------------------------------------------------- |
| `MAPPED_EXACT`     |     3 | Optimized locally and linked to the exact canonical product |
| `MAPPED_HIGH`      |     0 | None                                                        |
| `AMBIGUOUS`        |     0 | None                                                        |
| `VARIANT_MISMATCH` |     2 | Rejected                                                    |
| `NO_CATALOG_MATCH` |    30 | Not copied into production assets                           |
| `DUPLICATE_SOURCE` |     0 | None; all 35 source hashes are unique                       |
| `UNUSED`           |     0 | Every source received a specific disposition above          |

## Identity standard

An image is eligible only when brand, product line, variant or flavor, package type, and package
size agree with a canonical record. Filenames are treated as owner-supplied source metadata and the
visible package must not contradict them. A shared brand or product family is insufficient.

The target catalog is the reviewed 20-product cohort in
`backend/src/modules/forecasting/sarima-catalog-candidates.ts`. Those products retain their existing
SARIMA source mapping, prices, stock fields, visibility policy, and database identities.

The three other current storefront products were also checked as the secondary priority. `Classic
Cola 1.5L` is not an exact identity match for the branded Coke Mismo image; `Cheese Crackers` and
`Lemon Dishwashing Liquid` have no corresponding supplied image. None was changed.

## Complete source disposition

|   # | Archive       | Source file                                               | Status             | Catalog candidate / rationale                                                      |
| --: | ------------- | --------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
|   1 | Beverages     | `C2 Apple Green Tea Bottle.jpg`                           | `NO_CATALOG_MATCH` | No C2 product in the canonical cohort                                              |
|   2 | Beverages     | `Coke Mismo.jpg`                                          | `VARIANT_MISMATCH` | `P261` is Coca-Cola 1.5L; the visible Mismo bottle is a different package size     |
|   3 | Beverages     | `mountain dew mismo.jpg`                                  | `NO_CATALOG_MATCH` | No Mountain Dew product in the canonical cohort                                    |
|   4 | Beverages     | `Royal Mismo.jpg`                                         | `NO_CATALOG_MATCH` | No Royal product in the canonical cohort                                           |
|   5 | Beverages     | `Sprite mismo.jpg`                                        | `NO_CATALOG_MATCH` | No Sprite product in the canonical cohort                                          |
|   6 | Canned Goods  | `555 Sardines in Tomato Sauce.jpg`                        | `NO_CATALOG_MATCH` | No 555 Sardines product in the canonical cohort                                    |
|   7 | Canned Goods  | `555 Tuna Flakes in Oil.jpg`                              | `NO_CATALOG_MATCH` | No 555 Tuna product in the canonical cohort                                        |
|   8 | Canned Goods  | `555 Tuna Mechado.jpg`                                    | `NO_CATALOG_MATCH` | No 555 Tuna Mechado product in the canonical cohort                                |
|   9 | Canned Goods  | `Century Tuna Flakes in Oil.jpg`                          | `NO_CATALOG_MATCH` | No Century Tuna product in the canonical cohort                                    |
|  10 | Canned Goods  | `Ligo Sardines in Tomato Sauce Chili Added.jpg`           | `MAPPED_EXACT`     | `P144` / `SARIMA-P144`; exact Ligo chili-added tomato-sauce sardines, 155g package |
|  11 | Household     | `Ariel Sunrise Fresh Detergent Sachet.jpg`                | `NO_CATALOG_MATCH` | No Ariel product in the canonical cohort                                           |
|  12 | Household     | `Downy Fabric Conditioner Sachet – Passion.jpg`           | `NO_CATALOG_MATCH` | No Downy product in the canonical cohort                                           |
|  13 | Household     | `Downy Fabric Conditioner Sachet – Sunrise Fresh.jpg`     | `NO_CATALOG_MATCH` | No Downy product in the canonical cohort                                           |
|  14 | Household     | `Femme Bathroom Tissue Décor.jpg`                         | `NO_CATALOG_MATCH` | No Femme tissue product in the canonical cohort                                    |
|  15 | Household     | `Surf Detergent Sachet.jpg`                               | `NO_CATALOG_MATCH` | No Surf product in the canonical cohort                                            |
|  16 | Instant Food  | `Lucky Me Pancit Canton Extra Hot Chili.jpg`              | `NO_CATALOG_MATCH` | No Lucky Me Extra Hot product in the canonical cohort                              |
|  17 | Instant Food  | `Lucky Me! Cup Noodles Bulalo.jpg`                        | `NO_CATALOG_MATCH` | No Lucky Me Bulalo cup product in the canonical cohort                             |
|  18 | Instant Food  | `Lucky Me! Cup Noodles Seafood.jpg`                       | `NO_CATALOG_MATCH` | No Lucky Me Seafood cup product in the canonical cohort                            |
|  19 | Instant Food  | `Lucky Me! Pancit Canton Original.jpg`                    | `NO_CATALOG_MATCH` | No Lucky Me Original product in the canonical cohort                               |
|  20 | Instant Food  | `Nissin Ramen Spicy Seafood.jpg`                          | `NO_CATALOG_MATCH` | No Nissin product in the canonical cohort; not interchangeable with Payless `P443` |
|  21 | Personal Care | `Bioderm Coolness Soap.jpg`                               | `NO_CATALOG_MATCH` | No Bioderm product in the canonical cohort                                         |
|  22 | Personal Care | `Creamsilk Conditioner Sache.jpg`                         | `NO_CATALOG_MATCH` | No Cream Silk product in the canonical cohort                                      |
|  23 | Personal Care | `Hapee Mouth Defense Toothpaste 150g.jpg`                 | `NO_CATALOG_MATCH` | No Hapee product in the canonical cohort; not interchangeable with Colgate `P080`  |
|  24 | Personal Care | `Oral-B Shiny Clean Toothbrush.jpg`                       | `NO_CATALOG_MATCH` | No Oral-B toothbrush product in the canonical cohort                               |
|  25 | Personal Care | `Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL.jpg` | `MAPPED_EXACT`     | `P054` / `SARIMA-P054`; exact brand, variant, sachet, and 13.5mL size              |
|  26 | Snacks        | `Gardenia California Raisin Loaf 400g.jpg`                | `VARIANT_MISMATCH` | `P022` is Enriched White Bread 600g; both variant and size differ                  |
|  27 | Snacks        | `Gardenia Enriched White Bread 600g.jpg`                  | `MAPPED_EXACT`     | `P022` / `SARIMA-P022`; exact brand, variant, loaf package, and 600g size          |
|  28 | Snacks        | `Iloilo’s Biscocho.jpg`                                   | `NO_CATALOG_MATCH` | No Iloilo's Biscocho product in the canonical cohort                               |
|  29 | Snacks        | `Marby Mini Mamon 70g.jpg`                                | `NO_CATALOG_MATCH` | No Marby Mini Mamon product in the canonical cohort                                |
|  30 | Snacks        | `Marby Piyaya Original Flavor 90g.jpg`                    | `NO_CATALOG_MATCH` | No Marby Piyaya product in the canonical cohort                                    |
|  31 | Staples       | `Datu Puti Vinegar Bottle.jpg`                            | `NO_CATALOG_MATCH` | No Datu Puti Vinegar product in the canonical cohort                               |
|  32 | Staples       | `Golden Fiesta Palm Oil Bottle.jpg`                       | `NO_CATALOG_MATCH` | No Golden Fiesta product in the canonical cohort                                   |
|  33 | Staples       | `Iodized Salt 500g.jpg`                                   | `NO_CATALOG_MATCH` | No McCormick salt product in the canonical cohort                                  |
|  34 | Staples       | `Repacked Rice.jpg`                                       | `NO_CATALOG_MATCH` | No matching packaged rice product in the canonical cohort                          |
|  35 | Staples       | `Victoria White Sugar 1half Kilo.jpg`                     | `NO_CATALOG_MATCH` | No Victoria sugar product in the canonical cohort                                  |

## Approved catalog mappings

| Product ID                                    | SKU           | SARIMA source   | Canonical identity                                  | `Product.imageUrl`                                                        | Confidence |
| --------------------------------------------- | ------------- | --------------- | --------------------------------------------------- | ------------------------------------------------------------------------- | ---------- |
| `prd_sarima_p144_ligo_sardines_155g`          | `SARIMA-P144` | `workbook:P144` | Ligo Sardines in Tomato Sauce, Chili Added 155g     | `/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp`       | Exact      |
| `prd_sarima_p054_sunsilk_anti_dandruff_135ml` | `SARIMA-P054` | `workbook:P054` | Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL | `/images/products/sunsilk-anti-dandruff-silky-shampoo-sachet-13-5ml.webp` | Exact      |
| `prd_sarima_p022_gardenia_white_bread_600g`   | `SARIMA-P022` | `workbook:P022` | Gardenia Enriched White Bread 600g                  | `/images/products/gardenia-enriched-white-bread-600g.webp`                | Exact      |

The remaining 17 SARIMA-backed products have `imageUrl = null` by design. Their existing accessible
fallback remains the only acceptable presentation until an exact, approved asset is supplied.

## Rendering and persistence

Home and Shop consume the centralized temporary image-ready storefront collection and
`Product.imageUrl`. `ProductImage` renders local assets with `object-fit: contain`, lazy
decoding/loading, accessible product-photo labels, and the existing load-error fallback. Exterior
white canvas was safely trimmed from the three derivatives on 2026-08-14 so the packages occupy a
useful portion of the shared stage. Scene 06 retains exactly four slots using `P022`, `P144`,
`P054`, and a documented temporary repeat of `P022`; no image-less product is shown.

The image paths live on the canonical candidate definitions and are applied by the idempotent SARIMA
catalog mapper. This prevents a future catalog rebuild from clearing an approved image and avoids
per-page image lookup tables.

## Residual gaps

- Seventeen canonical SARIMA products still need exact approved images.
- The supplied Coca-Cola Mismo and Gardenia California Raisin Loaf images must not be used for the
  1.5L Coke and 600g Enriched White Bread records.
- The supplied originals range from 120×120 to 554×554. The accepted Ligo and Sunsilk images are
  intrinsically low-resolution; the UI contains rather than enlarges or crops them, but better
  owner-approved originals would improve high-density display quality.
