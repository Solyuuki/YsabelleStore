# SOP-Aligned Thesis Test Matrix

This matrix is specific to YsabelleStore. It is not derived from another group's test requirements.

## Functional Tests

| ID | SOP / Area | Test Objective | Minimum Evidence |
| --- | --- | --- | --- |
| FT-01 | User Management / Roles | Verify OWNER and STAFF access restrictions | owner navigation, staff navigation, protected owner-only function |
| FT-02 | Inventory Monitoring | Verify stock quantity, reorder/target level, batch, expiry, and status are displayed correctly | inventory list + product detail |
| FT-03 | Inventory Adjustment | Verify authorized add/remove adjustment records the correct quantity and reason | before stock, adjustment form, after stock/activity |
| FT-04 | Sales Recording / Barcode POS | Verify valid barcode-equivalent input resolves the correct product and can be added to sale | POS lookup/cart evidence |
| FT-05 | Sales Recording / POS | Verify a cash sale can be completed and a receipt record is created | payment + completed sale + receipt |
| FT-06 | Sales Recording | Verify completed sale remains available in Sales and can be reopened/reprinted | sales list + receipt detail |
| FT-07 | Receiving | Verify a complete delivery can be recorded against an approved restock ticket | ticket before + received confirmation/history |
| FT-08 | Receiving | Verify a partial delivery retains remaining quantity and open ticket state | expected, accepted, remaining, partial status |
| FT-09 | Supplier Return | Verify damaged/rejected delivery can produce return history/report | return record + report/export |
| FT-10 | Inventory Forecasting | Verify product-level current-month and 12-month forecast presentation | forecast chart/table |
| FT-11 | Purchasing Decision | Verify forecast/inventory conditions produce a restock recommendation | recommendation detail |
| FT-12 | Stock Replenishment | Verify automated monthly restock ticket generation and owner review path | generated ticket + supplier-order view |
| FT-13 | Stock Replenishment | Verify custom restock planner allows owner-defined products and quantities | custom planner + review + confirmed ticket |
| FT-14 | Inventory Reporting | Verify operational/inventory/restock reports can be generated/exported | report preview + output file |
| FT-15 | E-commerce | Verify storefront cart and pickup checkout flow | product, cart, checkout, pending order |
| FT-16 | Product Management | Verify product create/edit and catalog/storefront state handling | product form + product record |
| FT-17 | Data Management | Verify supported inventory/product import accepts valid data and reports invalid data | import screen + result |
| FT-18 | Expiration Monitoring | Verify near-expiry information is surfaced to authorized users | batch/expiry + alert/list state |

## Integration Tests

| ID | SOP / Area | Integration Path | Pass Criterion |
| --- | --- | --- | --- |
| IT-01 | Sales Recording + Inventory Monitoring | POS -> Inventory | completed quantity is deducted exactly once from the correct product |
| IT-02 | Sales Recording | POS -> Sales | completed transaction persists with matching receipt/reference |
| IT-03 | Stock Replenishment | Restock Ticket -> Receiving | confirmed restock ticket appears in Receiving with matching reference and quantities |
| IT-04 | Receiving + Inventory Monitoring | Receiving -> Inventory | inventory increases only by physically accepted units |
| IT-05 | Purchasing Decision | Forecast -> Recommendation | recommendation uses the intended forecast/inventory state and is traceable to the selected product |
| IT-06 | E-commerce + Inventory | Pending Pickup Order -> Inventory | placing a pending pickup request does not immediately deduct physical stock |
| IT-07 | E-commerce + Sales + Inventory | Completed Retail Sale -> Inventory | stock deduction occurs when the corresponding sale is completed |
| IT-08 | Reporting | Source Records -> Report | report values and ticket/product quantities match stored source records |
| IT-09 | Dashboard / Reporting | Transaction or receiving action -> Dashboard | displayed summary reflects the stored operational change after refresh/synchronization |

## Controlled Numeric Scenarios

### POS Stock Deduction

If starting stock is `S` and sold quantity is `Q`:

```
Expected after stock = S - Q
```

Record the exact before and after quantities.

### Partial Receiving

If expected quantity is `E` and accepted quantity is `A`:

```
Remaining = E - A
Inventory increase = A
```

Example already demonstrated by the current system:

```
Expected = 8
Accepted = 5
Remaining = 3
```

The test must verify that inventory increases by 5, not by 8.

## Hardware-Related Validation

| ID | Area | Method | Status Rule |
| --- | --- | --- | --- |
| HW-01 | Barcode input software path | send keyboard-equivalent barcode input and verify correct product resolution | PASS/FAIL allowed |
| HW-02 | Physical USB scanner compatibility | actual device scan | NOT TESTED if device unavailable |
| HW-03 | Receipt generation / print dispatch | complete sale and verify receipt generation / print pathway | PASS/FAIL allowed |
| HW-04 | Physical thermal printing | actual printer output | NOT TESTED if device unavailable |

## Deferred

- Mobile POS (MPOS): **TBC** — implementation/testing status will be finalized separately and is not included in the completed validation results.
