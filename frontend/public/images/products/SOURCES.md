# Product Image Provenance

This directory contains exact, catalog-linked product imagery only. Editorial photography in
`../discover/essentials/` is not SKU imagery and must not be used on product cards.

Reviewed: 2026-08-18

## Rights and source basis

Gardenia remains derived from the local archive supplied by the project owner with an explicit
request to integrate it into this storefront. Ligo and Sunsilk use higher-resolution contributor
product photographs from Open Food Facts/Open Beauty Facts, whose product images are published
under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). The downloaded photographs
were cropped only to isolate the sealed package and converted to optimized WebP; no package
artwork was generated, reconstructed, or altered. The two derivatives are distributed under the
same CC BY-SA 3.0 license.

Integration date: 2026-08-18.

| Workbook ID | Canonical product                                   | Source and attribution                                                                                                                                                | Normalized source retained under `originals/` | Transparent storefront derivative | Result                                                                                          |
| ----------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| `P144`      | Ligo Sardines in Tomato Sauce, Chili Added 155g     | [Open Food Facts product `0072810293606`](https://world.openfoodfacts.org/product/0072810293606), contributor `macrofactor`, image `2`                                | `1275×1698`, 372,778 bytes                    | `550×950`, 103,112 bytes          | CC BY-SA 3.0 deterministic sealed-can silhouette with 8px safe padding                          |
| `P054`      | Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL | [Open Beauty Facts product `4800888169709`](https://world.openbeautyfacts.org/product/4800888169709), contributor `foodless`, selected front image `3`, revision `11` | `1032×456`, 97,340 bytes                      | `1043×470`, 99,672 bytes          | CC BY-SA 3.0 higher-resolution counterpart of the previously approved card artwork, 8px padding |
| `P022`      | Gardenia Enriched White Bread 600g                  | `Snacks-20260813T132915Z-1-001.zip` / `Snacks/Gardenia Enriched White Bread 600g.jpg`                                                                                 | `181×428`, 23,862 bytes                       | `164×412`, 95,756 bytes           | User-provided exact lossless alpha WebP cutout with 8px safe padding                            |

The normalized source WebPs and deterministic cutout hashes are recorded in
`CUTOUT-MANIFEST.json`. Root-level product WebPs are the browser/Electron production derivatives
and retain the established catalog URLs.

## Deterministic cutout processing

Run `npm run product-images:process` to reproduce the derivatives or
`npm run product-images:cutouts:verify` to validate them.

The local processor in `scripts/product_image_cutouts.py`:

1. uses the documented fixed sealed-can silhouette for the licensed Ligo source photo;
2. otherwise estimates the neutral background from light, low-chroma boundary pixels;
3. flood-fills only near-background pixels connected to the outer canvas;
4. derives antialiased alpha from color distance to the estimated matte;
5. decontaminates translucent edge colors against that matte;
6. removes only tiny disconnected matte-compression specks;
7. crops to visible alpha bounds and restores a small proportional transparent margin; and
8. saves high-quality WebP RGB with full-quality alpha, without resizing or generating pixels.

The script uses Pillow 12.0.0 as a local development tool. Pillow is licensed under the permissive
[MIT-CMU license](https://github.com/python-pillow/Pillow/blob/main/LICENSE). The pinned tool
requirement is in `scripts/requirements-product-images.txt`; it is not a frontend/runtime dependency.

## Canonical catalog coverage

Only the three exact matches have `Product.imageUrl` values. The other 17 approved SARIMA catalog
records intentionally retain the standard no-image fallback. The catalog URLs, product IDs, names,
prices, and stock data are unchanged by cutout processing.

The complete source disposition, including rejected variant and package-size candidates, is in
[`docs/analysis/PRODUCT-IMAGE-MAPPING.md`](../../../../docs/analysis/PRODUCT-IMAGE-MAPPING.md).

## Admission rule

Before adding another asset, record its source archive or source URL, rights basis, acquisition
date, source and derivative hashes, canonical Product ID/SKU, and exact package-identity evidence.
Do not set `imageUrl` for an ambiguous, near-match, alternate-size, alternate-flavor, or generic
category image.
