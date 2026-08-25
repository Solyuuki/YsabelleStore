# Catalog data-quality policy

YsabelleStore treats product identity as master data. A product can be active for operational or historical reasons without being approved for customer display.

## Durable classification

Products and categories carry three independent controls:

- `recordSource`: `CATALOG`, `IMPORT`, `TEST_FIXTURE`, or `INTERNAL`.
- `dataQualityStatus`: `APPROVED`, `NEEDS_REVIEW`, or `REJECTED`.
- `isStorefrontVisible`: explicit customer-display approval.

The storefront requires an active, approved, visible product with a positive price; an approved and visible category; a non-fixture source; no unresolved duplicate; and no source-to-canonical mapping. Names are not inspected at query time.

POS and database forecasting exclude rejected fixture records. Approved canonical mappings allow historical rows under an old product ID to aggregate into the canonical product without rewriting chronological source records.

## Identity and merge policy

Duplicate evidence is evaluated in this order:

1. barcode or GTIN;
2. SKU;
3. supplier product code;
4. normalized brand, product, variant, and size;
5. name similarity as supporting evidence only.

Different sizes, flavors, or sellable packaging remain separate products. A pending candidate is hidden from the storefront and must not be merged automatically. `ProductAlias`, `ProductCanonicalMapping`, `ProductDuplicateCandidate`, and `CatalogAuditLog` preserve source identity, evidence, decisions, and timestamps.

Manual creation stops an equivalent normalized identity before commitment and returns the matching product IDs for review. Import preview reports likely matches before confirmation; confirmed imports remain hidden in `NEEDS_REVIEW` and receive pending duplicate-candidate records when applicable.

## Commands

```text
npm run catalog:audit
npm run catalog:clean
npm run catalog:clean:apply
```

`catalog:audit` is read-only and writes the current report. `catalog:clean` is a dry run. `catalog:clean:apply` applies the reported policy transactionally and verifies that protected sales, inventory, historical, forecasting, recommendation, and order totals do not change.

## 2026-08-10 cleaning decision

- All 2,502 product records were retained.
- 2,491 products and 160 categories matched exact test-generator signatures and were reclassified as rejected fixtures.
- Seven products passed the customer quality gate.
- Four catalog products remain in review: two conflicting Mineral Water 500ml records and two records whose descriptions explicitly describe test/lifecycle state.
- No products were merged and no historical relationship was reassigned.
- The canonical business category set is Beverages, Canned Goods, Household, Instant Food, Personal Care, Snacks, and Staples.

The machine-readable before/after reports are in `reports/catalog-quality/`.
