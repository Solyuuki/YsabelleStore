# Phase 9 Catalog Data Readiness Specification

## Base and scope

- Working branch: `m1/v0.9/feat/catalog-data-readiness`.
- Base branch: `m1/v0.9/feat/customer-mobile-otp` at `95cd5f618c412916929049fb704878ce69c82d8d`.
- Preserve all historical SARIMA source identities `P001` through `P472` and their 2024-2025 history.
- Treat historical workbook identities as source identities, not automatically as current operational `Product` identities.
- Phase 9 begins audit-first. The initial reconciliation tooling and reports are read-only with respect to operational Product, Inventory, InventoryBatch, sales, and forecast-history data.

## Catalog readiness invariants

1. Missing or pending images must not by themselves invalidate an otherwise legitimate product identity.
2. `InventoryBatch` remains the authority for physical sellable stock. Do not create fake stock to make catalog entries purchasable.
3. Historical selling price must not be represented as a verified current September 2026 selling price.
4. Product identity, commercial/current-price readiness, image readiness, and inventory readiness are independent states.
5. Do not destructively merge or delete records without strong identity evidence and an explicit reviewed cleanup decision.
6. Preserve source-to-operational mappings so historical sales and forecasting remain traceable.

## Image reconciliation input

- SARIMA source cohort: 472 identities (`P001`-`P472`) from the committed 2024 and 2025 historical-sales workbooks.
- Google Drive image inventory: 429 unique raw image files across the reviewed category folders as revalidated on September 1, 2026.
- The previous 430-file working baseline was off by one because the Snacks pagination workaround counted `Regent Assorted Cakes.jpg` in both the first 100 results and the `< 2026-08-28T12:18:47Z` overflow slice. The current split is 99 Snacks files at or after the cutoff plus 56 before it, for 155 unique Snacks files and 429 unique raw Drive images overall.
- The raw image count is not assumed to equal 429 unique products. Duplicate formats, category misfiles, and variant/size mismatches must be detected.

## Matching rules

Normalize only presentation differences that cannot change identity, such as case, repeated whitespace, common punctuation, and file extension. Do not normalize away flavor, formulation, size, weight, volume, pack count, or other sellable variant information.

A Drive asset is eligible for automatic assignment only when the source identity and image filename agree on the identifiable product, brand when present, variant/flavor when present, and size/package when present. Ambiguous or conflicting evidence must remain review-only.

Every reconciliation row must retain the SARIMA product code, authoritative source name, Drive file ID when present, Drive filename, source folder, normalized comparison fields, result status, and reason.

## Reconciliation statuses

- `EXACT_MATCH`: identity and all available variant/size evidence agree.
- `NEEDS_REVIEW`: product appears related but evidence is incomplete or ambiguous.
- `VARIANT_SIZE_MISMATCH`: product family appears related but sellable variant or package evidence conflicts.
- `DUPLICATE_IMAGE`: more than one Drive asset resolves to the same source identity or materially duplicates another asset.
- `DRIVE_ONLY`: image asset has no defensible `P001`-`P472` source match.
- `MISSING_IMAGE`: source identity has no defensible Drive image match.

## Missing-image sourcing

After the Drive reconciliation is reviewed, missing images may be researched externally. Prefer official manufacturer/brand sources, then reputable Philippine retail sources. An external asset must match the exact product identity, variant, and size/package represented by the source record. Do not substitute a lookalike, different flavor, different package, or merely similar product. Preserve source URL/provenance and review status for every externally sourced asset.

## Initial acceptance criteria

1. Extract and verify exactly 472 unique `P001`-`P472` identities from each committed annual workbook, and verify the paired identity set is consistent across 2024 and 2025.
2. Produce a structured manifest for all 429 unique raw Drive image files with file IDs and source folders.
3. Reconcile the two manifests deterministically without modifying operational catalog/inventory data.
4. Report exact counts for all reconciliation statuses and enumerate all ambiguous/mismatch/duplicate cases.
5. Only after the audit is reviewed may Phase 9 proceed to approved catalog/image assignments or cleanup mutations.
