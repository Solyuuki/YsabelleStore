# Product family identity (Sprint 12)

A product family groups **verified variants of the same sellable product line**, not all items
from a brand or with a generic variant (e.g. "Original"). Every size retains its own product ID,
SKU, barcode, prices, inventory batches, and order history.

## Resolution order

1. Two products sharing a persisted `Product.familyId` belong to that family.
2. A product with a persisted family ID may match an unassigned product **only** through an
   explicitly verified alias that points to that same ID.
3. Two unassigned products may group by a vetted alias, or conservatively by matching
   normalized brand **plus full size-free product name plus variant**.
4. Grouping is limited to the same storefront category and physical size dimension.
   `PACK`/`BOX` labels never override inconsistent weight, volume or count dimensions.
5. Uncertain candidates remain separate. Fuzzy similarity must never auto-merge SKUs.

## Verified Gardenia regression

`YS-QA26-050` (Classic Enriched White Bread 400g) and `SARIMA-P022`
(Enriched White Bread 600g) are the verified naming-alias pair. Migration `0016` creates a
stable family and backfills only records whose SKU, brand, variant and gram size all match.
New spreadsheet imports of either verified product line name use the same family ID.

## Deployment and QA

- Apply reviewed schema migration using `npx prisma migrate deploy --schema database/prisma/schema.prisma`.
- Run `npm run prisma:generate` and start the backend normally; old products stay available.
- Open each Gardenia detail page and confirm 400g/600g appear as size options in both directions;
  stock and price must remain independent.
- Confirm unrelated Gardenia bread and products with generic variants remain separate.
- Review `product_families`, `product_family_aliases`, and the two SKU `family_id` values.
- Execute automated backend tests and CI; database fixture tests require an isolated test DB.

Migration does not merge or delete products, and does not change barcode, stock, or price.
A successful GitHub CI run is necessary but is not a substitute for QA against the live database.
