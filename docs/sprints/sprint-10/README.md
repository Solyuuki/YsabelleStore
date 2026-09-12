# Sprint 10 — Inventory Truth, Restock, Forecasting, and Release Integrity

Sprint 10 evolves the existing Product, Inventory, Receiving, Reports, and SARIMA foundations into one controlled inventory and restocking lifecycle without replacing their existing domain authorities.

## Execution rule

Sprint 10 is executed phase-by-phase. Each active phase must pass automated verification and applicable manual QA before it is treated as complete. Later phases must not be pulled forward merely to satisfy an earlier phase.

## Phase sequence

1. Inventory Truth
2. Expiry & Batch Lifecycle
3. Inventory Import Hardening
4. Restock Domain Model
5. Reports ↔ Product ↔ Inventory Sync
6. Owner Custom Restock Workflow
7. New Product from Restock/Reports
8. Restock Approval Lifecycle
9. Arrival / Receiving Upgrade
10. Bulk Delivery Workflow
11. Forecast-driven Restocking
12. Fast SARIMA Pipeline
13. Reports → Action
14. POS / FEFO Hardening
15. Audit + Doctor + Release Gates

## Current active slice

Phase 4–6 is the current implementation and QA scope on `sprint/v0.10/sprint-10`.

Phase 7–15 remains pending and must not be treated as implemented by Phase 4–6 QA.

## Domain boundary

- Product is the canonical product identity authority.
- Inventory Batch is the physical quantity and expiry authority.
- Inventory Movement is the audit authority for stock changes.
- Forecast is prediction only.
- Recommendation is suggested action only.
- Report is visibility and decision support.
- Restock Order is procurement intent.
- Physical stock changes only when goods actually arrive and are recorded through the stock domain.

Supplier logistics, fleet tracking, ETA, routing, and automatic purchasing without Owner approval are outside Sprint 10 scope.

## Dependency security hygiene

The Sprint 10 dependency lockfile is kept aligned with the repository's safe transitive overrides. On September 12, 2026, stale lock resolutions were refreshed for affected transitive packages and the resulting dependency graph was verified with `npm audit` at zero reported vulnerabilities before final CI certification.
