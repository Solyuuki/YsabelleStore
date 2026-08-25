# Product Image Provenance

This directory contains exact, catalog-linked product imagery only. Editorial photography in
`../discover/essentials/` is not SKU imagery and must not be used on product cards.

Reviewed: 2026-08-23

## Rights and source basis

Gardenia remains derived from the local archive supplied by the project owner with an explicit
request to integrate it into this storefront. Sunsilk uses a higher-resolution contributor product
photograph from Open Beauty Facts, whose product images are published under
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

The original Sprint 6 Ligo asset came from Open Food Facts under CC BY-SA 3.0, but that handheld
photo required a fixed manual silhouette and produced a visibly clipped can in the storefront. The
replacement workflow now targets the exact `155g` red/chili product packshot documented by DMC
Enterprise, a Philippine exporter/consolidator that lists this exact Ligo item. The DMC page is used
as the exact-product source and retrieval provenance for the full-can replacement. **Rights basis:**
the image is not described here as copyright-free, and this repository does not infer a blanket
copyright license from public web availability. Project/publication owners should retain any required
permission or authorization for redistribution of that retail packshot.

No product-image workflow in this repository generates, reconstructs, or alters package artwork.
The Ligo replacement only removes the light outer background, preserves the visible full can, and
places it on a fixed transparent safety canvas.

| Workbook ID | Canonical product                                   | Source and attribution                                                                                                                                                    | Normalized source retained under `originals/` | Transparent storefront derivative         | Result                                                                                                     |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `P144`      | Ligo Sardines in Tomato Sauce, Chili Added 155g     | [DMC Enterprise exact product listing](https://www.dmc.com.ph/shop/ligo-sardines-in-tomato-sauce-with-chili-red-155g-x-100-1099), `155g`, red/chili full-can retail image | Downloaded by `product-images:ligo:refresh`   | Fixed `800×800` transparent safety canvas | Full-can edge-connected light-background isolation; legacy manual silhouette is superseded in final output |
| `P054`      | Sunsilk Anti-Dandruff & Silky Shampoo Sachet 13.5mL | [Open Beauty Facts product `4800888169709`](https://world.openbeautyfacts.org/product/4800888169709), contributor `foodless`, selected front image `3`, revision `11`     | `1032×456`, 97,340 bytes                      | `1043×470`, 99,672 bytes                  | CC BY-SA 3.0 higher-resolution counterpart of the previously approved card artwork, 8px padding            |
| `P022`      | Gardenia Enriched White Bread 600g                  | `Snacks-20260813T132915Z-1-001.zip` / `Snacks/Gardenia Enriched White Bread 600g.jpg`                                                                                     | `181×428`, 23,862 bytes                       | `164×412`, 95,756 bytes                   | User-provided exact lossless alpha WebP cutout with 8px safe padding                                       |

The normalized source WebPs and deterministic cutout hashes are recorded in
`CUTOUT-MANIFEST.json`. Root-level product WebPs are the browser/Electron production derivatives
and retain the established catalog URLs.

## Deterministic cutout processing

Run `npm run product-images:process` to reproduce the final derivatives or
`npm run product-images:cutouts:verify` to validate them. For a reviewed Ligo source refresh, run
`npm run product-images:ligo:refresh` once; that command downloads the exact packshot, preserves it
under `originals/`, builds the full-can derivative, and updates the Ligo manifest entry.

The base processor in `scripts/product_image_cutouts.py` continues to reproduce the pre-existing
three-asset pipeline. The Ligo-specific finalizer in `scripts/refresh_ligo_product_image.py` then
supersedes the legacy Ligo silhouette result by:

1. validating a sufficiently large exact `155g` source on a predominantly light outer background;
2. flood-filling only light background connected to the outside canvas;
3. preserving all non-background product pixels without inventing package detail;
4. cropping to the complete visible can;
5. fitting that cutout inside a `700×700` content limit on an `800×800` transparent canvas;
6. requiring at least a 50px transparent safety margin on every side; and
7. recording source/derivative hashes and `fullCanPreserved: true` in the manifest.

The scripts use Pillow as a local development tool. Pillow is licensed under the permissive
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
