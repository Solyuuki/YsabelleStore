# Sprint 10 Goal

## Goal

Deliver an authoritative inventory and restocking architecture in which physical stock, forecasting, recommendations, Owner planning, receiving, POS consumption, and release diagnostics agree without collapsing their domain boundaries.

## Success means

- Physical, sellable, expired, quarantined, and incoming stock have explicit meanings.
- Reports and recommendations consume current canonical Product and Inventory state.
- Restock planning preserves forecast recommendations and Owner overrides separately.
- Restock approval authorizes procurement but does not create physical Inventory.
- Physical stock is created only when goods actually arrive through the stock domain.
- Forecast recomputation is selective rather than global.
- POS and FEFO consume only valid sellable stock.
- Every phase has reproducible automated evidence and applicable manual QA evidence.
- Sprint 10 branch naming, documentation, and guardrail configuration agree on the active sprint.

## Current acceptance target

The current release gate is Phase 4–6: Restock Domain Model, selective synchronization, and Owner-controlled Reports → Restock planning.

## Non-goals for Phase 4–6

- Do not implement Phase 7 new-product creation from Reports early.
- Do not implement Phase 9 physical receiving as part of planning or approval.
- Do not add supplier API, truck, driver, GPS, route, or ETA management.
- Do not bypass Product, Batch, Inventory Movement, or existing stock-domain authority.
