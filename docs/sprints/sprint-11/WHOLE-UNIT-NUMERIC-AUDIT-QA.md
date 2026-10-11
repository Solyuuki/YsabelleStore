# Sprint 11 — Integer-only stock and quantity inputs

## Incident

The Storefront cart displayed `1.4` sardine units and a proportional checkout
subtotal. Decimal stock/order quantities are invalid under existing MySQL/Prisma
integer stock ledger and checkout schemas. A separate Receiving capture showed
`3.4` delivered units; existing UI parsing used `Math.trunc`, which silently
converted that to 3 before the API could reject the fractional original.

## Audit matrix

| Flow | Unit counts | Handling |
| --- | --- | --- |
| Storefront catalog/card/detail/cart | Whole integer, >=1 | Shared input parser rejects decimals; cart context rejects invalid programmatic inputs without rounding |
| Authenticated cart, checkout | Whole integer, >=1 | Existing backend Zod `.int()` contracts remain |
| POS checkout | Whole integer, >=1 | Existing backend Zod `.int()`; POS uses +/- controls |
| Receiving per-ticket exceptions | Whole integer, >=0 | Controlled text input + pre-submit validation; no truncation |
| Reports/Restock receiving | Whole integer, >=0 | Controlled text input + pre-submit validation; no truncation |
| Restock Planner requested quantity / policy targets | Whole integer, policy-appropriate bounds | Frontend parser rejects fractional changes; backend Zod `.int()` |
| Inventory Stock In / Stock Adjustment | Whole integer, >=1 | Existing frontend submit validation, hardened adjustment onChange and backend transaction guard |
| Bulk inventory delivery import | Whole integer, >=0 | Editable row accepts digit drafts only; backend Zod `.int()` |
| Product reorder / target stock levels | Whole integer, >=0 | Frontend input guards + backend Zod `.int()` |
| Product CSV / inventory CSV / historical sales import | Whole integer for stock and sold units | Existing importer contracts retained |

## Decimal exceptions (intentionally unchanged)

- Money: PHP cash tendered, selling price, cost price, change, totals and discounts.
- Pack measurements: declared size value (ml, L, g, kg), where fractions
  describe **package size**, not a fractional sale of an inventory piece.
- Forecast averages, confidence, ratios and percentages: analytics, not
  physical stock receipts.
- Ratings and descriptive numeric measurements when specified by their schema.

## Defensive layers

1. Product quantity component accepts only safe integer quantities.
2. Cart state refuses fractional programmatic updates and does not round them.
3. Receiving/restock inputs keep only whole-number drafts and validate at
   submission. Never silently truncate or round.
4. Existing API `.int()` validation remains mandatory for mutation requests.
5. Physical stock service refuses unsafe/fractional quantities at write
   boundaries (opening stock, stock-in, adjustment, sale allocation).

The patch does not change inventory movements, procurement policy, or
the existing revalidation of restock purchase safety at receiving. The
`RO-SEP-2026` safety block is a separate known bug.

## Regression and local QA

- `node --test scripts/test/whole-unit-ui-contract.test.mjs`
- `npx tsx --test backend/test/whole-unit-quantity.test.ts`
- In Storefront Shop, Product Detail and Cart: try `1.4`, `3.4`,
  `-1`, `1e3`, empty, paste `12.5`, then a valid integer.
  Fractional values must **never** change the cart quantity or subtotal.
- Repeat on Receiving (all quantity fields), Restock Planner, Reports
  Receiving and bulk-delivery import, Stock adjustment, and product
  reorder/target fields. Validate submit payloads remain integer-only.
- Check POS checkout, stock reservation and inventory updates with valid
  integer quantities, including concurrent POS/Storefront transactions.
- Check that cash tendered `100.50`, cost/selling price `12.25` and
  product size `0.5 L` remain allowed.
- Check Light/Dark Mode cart spinner/button styles and controls.

No existing historical records are mutated. Do not treat this static audit
and test suite as production certification without browser QA.
