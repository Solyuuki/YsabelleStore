# Product Image Provenance

This directory contains exact, catalog-linked product imagery only. Editorial photography in
`../discover/essentials/` is not SKU imagery and must not be used on product cards.

Reviewed: 2026-08-14

## Rights and source basis

The three approved assets are derived only from local archives supplied by the project owner with
an explicit request to integrate them into this storefront. No web image, generated packaging,
retailer screenshot, watermark removal, or synthetic replacement was used. The source archives
remain unchanged outside the repository.

Source label for every row: `User-provided store/project product image archive`. Integration date:
2026-08-14.

| Workbook ID | Canonical product                                   | Source archive and file                                                                                              | Normalized source retained under `originals/` | Transparent storefront derivative | Result                                        |
| ----------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------- | --------------------------------------------- |
| `P144`      | Ligo Sardines in Tomato Sauce, Chili Added 155g     | `Canned Goods-20260813T132920Z-1-001.zip` / `Canned Goods/Ligo Sardines in Tomato Sauce Chili Added.jpg`             | `80×120`, 5,512 bytes                         | `80×128`, 6,314 bytes             | Exact alpha WebP cutout with 4px safe padding |
| `P054`      | Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL | `Personal Care-20260813T132916Z-1-001.zip` / `Personal Care/Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL.jpg` | `140×75`, 4,542 bytes                         | `137×68`, 5,030 bytes             | Exact alpha WebP cutout with 4px safe padding |
| `P022`      | Gardenia Enriched White Bread 600g                  | `Snacks-20260813T132915Z-1-001.zip` / `Snacks/Gardenia Enriched White Bread 600g.jpg`                                | `181×428`, 23,862 bytes                       | `164×412`, 34,512 bytes           | Exact alpha WebP cutout with 8px safe padding |

The normalized source WebPs are byte-for-byte preserved in `originals/`. Their original hashes and
the deterministic cutout hashes are recorded in `CUTOUT-MANIFEST.json`. Root-level product WebPs
are the browser/Electron production derivatives and retain the established catalog URLs.

## Deterministic cutout processing

Run `npm run product-images:process` to reproduce the derivatives or
`npm run product-images:cutouts:verify` to validate them.

The local processor in `scripts/product_image_cutouts.py`:

1. estimates the neutral background from light, low-chroma boundary pixels;
2. flood-fills only near-background pixels connected to the outer canvas;
3. derives antialiased alpha from color distance to the estimated matte;
4. decontaminates translucent edge colors against that matte;
5. removes only tiny disconnected matte-compression specks;
6. crops to visible alpha bounds and restores a small proportional transparent margin; and
7. saves high-quality WebP RGB with full-quality alpha, without resizing or generating pixels.

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
