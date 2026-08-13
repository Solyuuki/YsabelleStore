# SARIMA Product Trace Audit

**Audit date:** 2026-08-11  
**Mode:** read-only. No product, catalog, sales, historical-import, forecast, or UI record was changed.

**Snapshot note:** This trace captures the state before the SARIMA storefront-catalog implementation.
The subsequent 20-product mapping is documented in `SARIMA-STOREFRONT-CATALOG.md`; this file
remains the evidence baseline for why an additive source-identity bridge was required.

## Executive summary

Yes: YsabelleStore has a real, source-backed historical product set actively used by the SARIMA pipeline. It is **not** the current `Product` table. The active forecast batch uses **472 paired workbook identities** from `data/forecasting/historical-sales-2024.xlsx` and `data/forecasting/historical-sales-2025.xlsx`.

- The raw historical identifiers are sequential `P001` through `P472`; the pipeline namespaces them as `workbook:P001` through `workbook:P472` before forecasting.
- Every workbook series has 24 continuous monthly observations (`2024-01` to `2025-12`) and passes the current SARIMA eligibility gate. There are two zero-demand months in total, across two series; neither breaches the zero-share threshold.
- The active persisted batch is `cmsknnd2h0002ibs0keq0zvww`, generated 2026-08-08. It contains 472 `SARIMA` / `READY` results, a 12-month horizon from 2026-08, zero model fallbacks, and zero failed products.
- There is **no active database historical import**: `HistoricalMonthlySales` and `HistoricalSalesImportRow` both contain zero rows. The database-side operational set contains 11 products, all `INSUFFICIENT_HISTORY`; no database product is SARIMA-eligible.
- The 472 source-backed series have no current `Product` mapping, SKU, barcode/GTIN, `imageUrl`, alias, or canonical-mapping relation. Missing images therefore mean an unresolved catalog integration gap, not fake historical products.

The critical conclusion is that **forecast legitimacy and storefront eligibility are currently separate domains**. The next work should map source-backed workbook identities to evidence-backed catalog products before changing storefront visibility or sourcing product imagery.

## Real product counts

| Metric                                                    | Exact result | Interpretation                                                                                               |
| --------------------------------------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------ |
| `Product` records                                         |        2,502 | Current local catalog table.                                                                                 |
| Explicit `TEST_FIXTURE` products                          |        2,491 | Classified by durable `recordSource`, not by name or imagery.                                                |
| Legacy development-seed catalog products                  |            8 | Explicitly declared in `database/seed/development.mjs`, but currently retain legacy `CATALOG` source values. |
| Catalog products with any completed POS evidence          |          148 | 147 are explicit test fixtures; one is `PAN-UBE-001`.                                                        |
| Non-fixture catalog products with POS evidence            |            1 | `cmrdl144d0005ibqc05dq8jhv` / `PAN-UBE-001`; three units in one month.                                       |
| Active `HistoricalMonthlySales` rows                      |            0 | No database imported history currently exists.                                                               |
| `HistoricalSalesImportRow` rows                           |            0 | No completed local import audit rows exist.                                                                  |
| Workbook historical identities                            |          472 | `P001` to `P472`, each present in both approved workbooks.                                                   |
| Workbook historical observations                          |       11,328 | 472 x 24 monthly points.                                                                                     |
| Workbook products with 24+ observations                   |          472 | All current source series.                                                                                   |
| Current database SARIMA-eligible products                 |            0 | The 11 operational catalog products are all `INSUFFICIENT_HISTORY`.                                          |
| Current SARIMA-eligible source series                     |          472 | Workbook fallback source.                                                                                    |
| Current active SARIMA forecasts                           |          472 | All active forecast results are `SARIMA` / `READY`.                                                          |
| Current model fallback forecasts                          |            0 | `SEASONAL_NAIVE` and `MOVING_AVERAGE` are not used in the active batch.                                      |
| Legacy `ForecastRecord` rows                              |            0 | This older table is not the current delivery path.                                                           |
| Persisted `ForecastProductResult` rows                    |          944 | Two retained 472-row workbook batches; 472 belong to the active batch.                                       |
| Source series with a mapped product image                 |            0 | No workbook identity maps to a `Product`, so no `imageUrl` can be resolved.                                  |
| Exact local SKU assets for source series                  |            0 | `frontend/public/images/products/` contains provenance documentation only.                                   |
| Pending explicit duplicate groups                         |            1 | Two mineral-water catalog records; this is not a workbook duplicate.                                         |
| Exact normalized-name duplicates inside the 472 workbooks |            0 | Source IDs and normalized names are one-to-one in the paired workbook set.                                   |

## Forecast data flow

```text
Approved 2024/2025 XLSX files
  Product ID + category + product name + price + Jan to Dec quantities
  -> spreadsheet-parser.service.ts / parseHistoricalWorkbook()
      -> historical-sales.service.ts / loadHistoricalSalesData()
          -> validates same P### identity in both years and continuous 24-month series
          -> forecast.service.ts / loadForecastInput()
              -> tries database effective series first
                 -> effective-sales.service.ts / loadEligibleEffectiveSales()
              -> no database-eligible series -> workbook fallback
                  -> withWorkbookIdentity() prefixes P### as workbook:P###
                      -> python-forecast-runner.service.ts / runPythonForecast()
                          -> forecasting-service/app/main.py / forecast_product()
                              -> SARIMA (fallback only on fitting failure)
                                  -> forecast-persistence.service.ts
                                      -> ForecastBatchCache
                                      -> ForecastProductResult (detail payload + summary)
```

### Database import path (implemented, but unused by this local data)

```text
Owner CSV/XLSX upload
  -> historicalSalesImportService.ts / buildPreview()
      -> match by SKU, then barcode, then explicit ProductAlias
      -> product-name mismatch is warning only
      -> confirm import -> HistoricalSalesImportBatch / HistoricalSalesImportRow
          -> HistoricalMonthlySales (IMPORTED_HISTORICAL)
              -> effective-sales.service.ts / combineEffectiveMonthlyPoints()
                  -> source Product -> canonical ProductCanonicalMapping, where one exists
                  -> completed POS product-month replaces imported product-month
                      -> assessSarimaEligibility()
```

No completed import batch, import row, or imported monthly row is present in this database, so this path contributes no current forecast input.

## Authoritative identifiers by transition

| Transition            | Authoritative identity                       | Supporting identity                    | Notes                                                                     |
| --------------------- | -------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------- |
| Workbook row          | `Product ID` (`P001` to `P472`)              | Product Name, Category, Price          | Workbooks have no SKU or GTIN columns.                                    |
| Workbook pair         | Same `P###` in 2024 and 2025                 | Name/category conflict checks          | Mismatched year identities are excluded. Current files have no conflicts. |
| Forecast input        | `workbook:P###`                              | Normalized historical points           | Prefix prevents collisions with database `Product.id`.                    |
| Database product      | `Product.id`                                 | Unique SKU and optional unique barcode | Catalog name is not authoritative for imports.                            |
| Historical import row | SKU, then barcode, then explicit alias       | Product name warns on mismatch         | Name-only matching is deliberately not used.                              |
| Canonical aggregation | `ProductCanonicalMapping.canonicalProductId` | Explicit mapping evidence              | There are currently zero mappings.                                        |
| POS reconciliation    | Canonical `Product.id` + month               | Completed sale items                   | POS quantity replaces, rather than adds to, an imported product-month.    |
| Persisted delivery    | `ForecastProductResult.sourceProductId`      | Batch ID and payload                   | Active source IDs are `workbook:P###`, not catalog product IDs.           |

## SARIMA series audit

### Active batch

| Field                      | Result                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Batch ID                   | `cmsknnd2h0002ibs0keq0zvww`                                                                                         |
| Source                     | `WORKBOOK_FALLBACK` (source selection, not a model fallback)                                                        |
| Status                     | `READY`, active                                                                                                     |
| Generated / completed      | 2026-08-08 17:36:00Z / 17:37:03Z                                                                                    |
| Forecast start / horizon   | 2026-08-01 / 12 months for all 472 results                                                                          |
| Model                      | 472 `SARIMA`, 0 seasonal-naive, 0 moving-average                                                                    |
| Result status              | 472 `READY`, 0 failed                                                                                               |
| Monthly coverage           | 24 months each, 2024-01 through 2025-12                                                                             |
| Missing / duplicate months | 0 series with missing months; 0 with duplicate months                                                               |
| Zero-demand observations   | 2 months across 2 series; maximum one zero month in a series                                                        |
| Source mix                 | Workbook historical only; no POS or database-imported points feed these 472 series                                  |
| Warning count              | Two warnings recorded on each persisted result, reflecting limited two-cycle history; they are not model fallbacks. |

### Complete product set

The complete current SARIMA population is one sequential source set: **`workbook:P001` through `workbook:P472`**. The parser verified 472 product rows in each workbook and pairs each ID across both years. Every member has the same structural audit result:

| Source series keys                 |  Months | First / last      | Source mix               | Eligibility      | Current forecast             |
| ---------------------------------- | ------: | ----------------- | ------------------------ | ---------------- | ---------------------------- |
| `workbook:P001` to `workbook:P472` | 24 each | 2024-01 / 2025-12 | Workbook historical only | `ELIGIBLE` (472) | `SARIMA`, `READY`, 12 months |

This concise range is exact: the IDs are sequential with no gaps. Product name, category, price, and all 24 observations remain in the two approved source workbooks; duplicating 11,328 points in this document would create a second, less reliable data store.

## Source-backed examples and future anchor candidates

These are the strongest _forecast-source_ candidates. They are not ready storefront records yet: each needs a verified mapping to a live `Product` (and then normal product identity/image work) before it can be shown as a purchasable SKU.

| Forecast ID     | Product name                                   | Category                               | Historical months | 2024 units | 2025 units | Total units | SARIMA state   | Image state                    |
| --------------- | ---------------------------------------------- | -------------------------------------- | ----------------: | ---------: | ---------: | ----------: | -------------- | ------------------------------ |
| `workbook:P353` | Presto Creams Vanilla Sandwich Cookies         | Snacks / Biscuits & Confectionery      |                24 |        562 |        626 |       1,188 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P346` | Bread Gem Biscuits                             | Bread & Bakery                         |                24 |        470 |        536 |       1,006 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P352` | Presto Creams Peanut Butter Sandwich Cookies   | Baking / Spreads & Dessert Ingredients |                24 |        453 |        508 |         961 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P203` | Magic Sarap Seasoning Pack                     | Condiments & Cooking Ingredients       |                24 |        363 |        421 |         784 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P056` | Creamsilk Conditioner Sachet                   | Personal Care / Hygiene                |                24 |        361 |        409 |         770 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P438` | BIG 250 Juice Drink                            | Beverages / Juice, Tea, Soda & Water   |                24 |        346 |        392 |         738 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P396` | Bear Brand Adult Plus Powdered Milk Drink      | Beverages / Coffee & Milk              |                24 |        337 |        396 |         733 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P246` | Mr. Hat Gulaman Unflavored Black               | Canned Goods                           |                24 |        341 |        390 |         731 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P018` | Downy Fabric Conditioner Sachet, Sunrise Fresh | Laundry Supplies                       |                24 |        321 |        376 |         697 | SARIMA / READY | No Product mapping or packshot |
| `workbook:P327` | Lucky Me! Pancit Canton Spicy Labuyo           | Noodles & Pasta                        |                24 |        237 |        279 |         516 | SARIMA / READY | No Product mapping or packshot |

**Provisional Scene 06 source choices, after mapping--not now:** `workbook:P203` (Magic Sarap), `workbook:P327` (Lucky Me! Pancit Canton Spicy Labuyo), `workbook:P438` (BIG 250 Juice Drink), and `workbook:P056` (Creamsilk Conditioner Sachet). They are category-diverse, source-specific, and have strong two-year demand evidence. They must not be put in Scene 06 until each is mapped to a real catalog product with verified sellable identity.

## Duplicate and alias findings

| Group                      | Records                                                                                     | Evidence                                                                                     | Confidence        | Current aggregation                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------- |
| Pending catalog duplicate  | `cmrdl14710009ibqcwfyqtuiv` / `BEV-WAT-500` and `prd_mineral_water_500ml` / `BEV-WATER-001` | Same normalized name and 500 ml size only; barcode, SKU, unit, price, and stock do not agree | Low (stored 0.55) | Neither record has a forecast series; neither is mapped to the other. |
| Workbook exact-name groups | `P001` to `P472`                                                                            | No duplicate normalized source names found                                                   | N/A               | Each workbook ID remains a separate, stable forecast series.          |
| Workbook-to-catalog links  | 472 workbook identities vs. 11 operational catalog products                                 | Zero exact normalized-name matches; zero aliases; zero canonical mappings                    | No safe match     | All workbook source series remain separate from catalog products.     |

There are no matching GTIN/SKU groups in the workbook dataset because those fields are not supplied by the source contract. No merge was performed.

## Scene 06 product trace

| Product                     | Product ID / SKU                            | Historical/POS evidence                                | Forecast evidence                   | Mapping / image               | Fixture or identity conclusion                                                                                                    |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------ | ----------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Anti-Dandruff Shampoo 180ml | `prd_shampoo_180ml` / `TOI-SHAMP-001`       | No database import or POS history                      | Not eligible; no forecast           | No alias/map; `imageUrl=null` | Explicitly defined in `database/seed/development.mjs`; do not use as a forecast-backed anchor.                                    |
| Beef Instant Noodles        | `prd_beef_noodles` / `NDL-BEEF-001`         | No database import or POS history                      | Not eligible; no forecast           | No alias/map; `imageUrl=null` | Explicitly defined in the development seed; no source-backed SARIMA link.                                                         |
| Cheese Crackers             | `prd_cheese_crackers` / `SNK-CRACK-001`     | No database import or POS history                      | Not eligible; no forecast           | No alias/map; `imageUrl=null` | Explicit development-seed product. It is storefront-visible, but not forecast-backed.                                             |
| Classic Cola 1.5L           | `prd_cola_15l` / `BEV-COLA-001`             | No database import or POS history                      | Not eligible; no forecast           | No alias/map; `imageUrl=null` | Explicit development-seed product. It is storefront-visible, but not forecast-backed.                                             |
| Classic Bread Loaf          | `cmrdl1482000dibqcle38ptpp` / `PAN-BRD-001` | No database import or POS history                      | Not eligible; no forecast           | No alias/map; `imageUrl=null` | No explicit fixture source found, but no historical or source-identity evidence links it to SARIMA.                               |
| Tomato Sardines 155g        | `prd_sardines_155g` / `CAN-SARD-001`        | No database import or POS history                      | Not eligible; no forecast           | No alias/map; `imageUrl=null` | Explicit development-seed product; not a SARIMA anchor.                                                                           |
| Ube Condensed Milk          | `cmrdl144d0005ibqc05dq8jhv` / `PAN-UBE-001` | Three completed POS items, three units, July 2026 only | `INSUFFICIENT_HISTORY`; no forecast | No alias/map; `imageUrl=null` | Not in the explicit development product array. It has a local POS signal, but provenance and sellable identity remain incomplete. |

No exact-name forecast result exists for any of these seven catalog records. Their IDs do not occur in the active `ForecastProductResult.sourceProductId` set.

## Re-audit of the four `NEEDS_REVIEW` changes

| Product              | Previous -> current                             | Historical finding                                             | Assessment                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Classic Bread Loaf   | `APPROVED` / visible -> `NEEDS_REVIEW` / hidden | No POS, imported, or forecast evidence                         | The review was triggered by unproven product identity and missing master data, not historical evidence. It did not hide a SARIMA product.                                                        |
| Beef Instant Noodles | `APPROVED` / visible -> `NEEDS_REVIEW` / hidden | No POS, imported, or forecast evidence                         | Same: not justified by historical invalidity, but no historical evidence currently argues for a forecast role.                                                                                   |
| Tomato Sardines 155g | `APPROVED` / visible -> `NEEDS_REVIEW` / hidden | No POS, imported, or forecast evidence                         | Same: no SARIMA impact, but missing image alone must never be treated as fixture evidence.                                                                                                       |
| Ube Condensed Milk   | `APPROVED` / visible -> `NEEDS_REVIEW` / hidden | Three POS transactions / three units in one month; no forecast | The change was driven by identity and imagery gaps, not the POS evidence. It can hide a non-fixture local catalog product, although it cannot remove a SARIMA series because it is not eligible. |

The previous review did **not** remove any of the 472 active workbook forecast series from the storefront; they have never been mapped into the storefront product model. It may, however, be overly broad as a storefront decision for `PAN-UBE-001`, where local POS evidence exists. This audit does not restore or modify any status.

## Image coverage gap

| Population                                     | `imageUrl` / asset state                                           | Provenance state                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 472 active workbook forecast series            | No mapped `Product`, therefore no `imageUrl` field can be resolved | The workbook source contract contains no image field or asset provenance.               |
| 11 operational catalog products                | All currently have `imageUrl=null`                                 | No exact local SKU asset is mapped.                                                     |
| Four previously review-gated Scene 06 products | All `imageUrl=null`                                                | `frontend/public/images/products/SOURCES.md` documents why no exact asset was approved. |
| Category imagery                               | Local Pexels-derived editorial assets exist                        | Explicitly documented as category representation, not SKU packshots.                    |

No historical source product should inherit a category image or a similarly named catalog image. Exact packshots require the future verified mapping plus matching brand/variant/size evidence.

## Risks and ambiguities

1. The current catalog and the current forecast source have no identity bridge. This is the primary integrity gap.
2. `recordSource=CATALOG` does not by itself prove a product is operational: eight legacy development seed products were created by `database/seed/development.mjs` without a durable test-fixture source value.
3. The 472 workbook series are source-backed and forecasted, but the workbook contract does not carry SKU, GTIN, package size, supplier code, or image metadata.
4. Only two seasonal cycles are available. The active SARIMA output is valid under the implemented eligibility gate, but the project documentation correctly treats it as limited historical depth.
5. The pending mineral-water duplicate is a low-confidence catalog-only candidate. It must not be merged from name/size similarity.

## Recommended next implementation step

Implement a **read-only-to-reviewed product-identity mapping workflow** before any imagery or storefront work:

1. ingest or register authoritative supplier/receipt/GTIN evidence for the chosen workbook `P###` series;
2. map each source series to a canonical `Product.id` only on SKU/GTIN/supplier-code or approved strong identity evidence;
3. retain the source `P###` as an alias/external identifier and test POS-overrides-imported aggregation after mapping;
4. then enrich brand, variant, package size, and verified product imagery;
5. only after that decide storefront visibility and select four Scene 06 products.

Do not use generic development-seed products as forecast-backed storefront anchors. Do not merge workbook series or create catalog images from name similarity.

## Final decisions

1. **Do real products used by SARIMA already exist--** Yes: 472 source-backed historical workbook identities currently feed SARIMA.
2. **How many--** 472 active forecast identities, plus one separate non-fixture catalog product with insufficient POS-only history.
3. **Which IDs/SKUs are they--** `workbook:P001` to `workbook:P472`; they have no SKU/GTIN in the source. The exact raw IDs are `P001` to `P472`.
4. **Strongest verified examples--** The ten source candidates listed above, especially P353, P203, P056, P438, and P327.
5. **Are they storefront-visible--** No. They are not mapped to `Product` records, so storefront visibility is not yet applicable.
6. **Are they mostly missing only imagery/brand metadata--** More fundamentally, they are missing the catalog identity bridge: SKU/GTIN/canonical Product mapping, then imagery and product metadata.
7. **Which four should Scene 06 eventually feature--** After verified mapping: P203 Magic Sarap, P327 Lucky Me! Pancit Canton Spicy Labuyo, P438 BIG 250 Juice Drink, and P056 Creamsilk Conditioner Sachet.
8. **Which products should not be used--** The 2,491 explicit `TEST_FIXTURE` records; the explicit development-seed products as forecast-backed anchors; and the two pending mineral-water duplicate candidates until reviewed.
9. **What should be fixed next--** Product mapping first; then identity metadata and imagery. Duplicate cleanup and storefront visibility decisions follow evidence-backed mapping.
