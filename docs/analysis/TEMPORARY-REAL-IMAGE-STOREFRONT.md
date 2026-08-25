# Temporary Real-Image Storefront Catalog

Reviewed: 2026-08-14

## Policy

Customer product collections temporarily require both the durable storefront quality rules and an
approved root-relative WebP asset under `/images/products/`. This is a presentation policy only.
Image-less products remain in the internal catalog with their identity, pricing, inventory,
history, and SARIMA relationships unchanged.

The supplied Google Drive folder was inspected directly. It contains the same 35 originals audited
in `PRODUCT-IMAGE-MAPPING.md`; it is not a separate 20+ product library. Only three images currently
have exact matches to existing canonical Product records.

## Current customer catalog

| Product ID                                    | SKU           | Product                                             | Category       | Image                                                                     |
| --------------------------------------------- | ------------- | --------------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| `prd_sarima_p022_gardenia_white_bread_600g`   | `SARIMA-P022` | Gardenia Enriched White Bread 600g                  | Bread & Bakery | `/images/products/gardenia-enriched-white-bread-600g.webp`                |
| `prd_sarima_p144_ligo_sardines_155g`          | `SARIMA-P144` | Ligo Sardines in Tomato Sauce, Chili Added 155g     | Canned Goods   | `/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp`       |
| `prd_sarima_p054_sunsilk_anti_dandruff_135ml` | `SARIMA-P054` | Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL | Personal Care  | `/images/products/sunsilk-anti-dandruff-silky-shampoo-sachet-13-5ml.webp` |

Current customer category counts are Bread & Bakery: 1, Canned Goods: 1, and Personal Care: 1.

## Temporarily hidden products

The following 20 products remain internally valid but are absent from Shop, category counts,
customer search, Home product merchandising, and sales-backed merchandising until exact imagery is
approved:

- Argentina Chicken Luncheon Meat 340g
- Cheese Crackers
- Classic Cola 1.5L
- Coca-Cola 1.5L
- Colgate Maximum Cavity Protection Toothpaste 74g
- Del Monte Original Style Tomato Sauce 250g
- Dr. Wong's Sulfur Soap 80g
- Fresca Tuna Flakes in Oil 175g
- Jack 'n Jill Piattos Cheese 85g
- Lady's Choice Real Mayonnaise 72mL
- Lemon Dishwashing Liquid
- Nature's Spring Purified Drinking Water 350mL
- Nescafe Classic 80g
- Oishi Ridges Barbecue Flavor 60g
- Payless Yakisoba Spicy Chicken 59g
- Pocari Sweat 500mL
- Purefoods Classic Tocino 450g
- Star Nutri-Meats Giniling Afritada 100g
- Sunsilk Perfect Straight Shampoo Sachet 13mL
- Wilkins Pure Drinking Water 500mL

## Scene 06 temporary composition

Scene 06 must remain exactly four product-card slots, but only three verified image-ready products
currently exist. It therefore repeats Gardenia Enriched White Bread in the fourth slot instead of
showing an image-less product or inventing a fourth identity. All four slots remain truthful about
identity, imagery, price, and stock. Replace the repeated slot as soon as a fourth exact
existing-product image is approved.

## Expansion path

The gate is centralized in `catalogQualityPolicy.ts`. Adding a future exact Product image requires:

1. an optimized `.webp` under `frontend/public/images/products/`;
2. truthful provenance in `SOURCES.md` and the mapping audit;
3. the canonical Product's root-relative `imageUrl`;
4. a passing `npm run storefront:images:verify`.

No Home or Shop page allowlist needs to be changed.
