# Sprint 10 Backlog

## Phase 1 — Inventory Truth

- [x] Establish physical, sellable, expired, quarantined, and incoming stock semantics.

## Phase 2 — Expiry & Batch Lifecycle

- [x] Preserve expiry-aware batch-backed inventory behavior as the operational foundation.

## Phase 3 — Inventory Import Hardening

- [x] Preserve canonical Product identity and batch-backed stock-in behavior for imports.

## Phase 4 — Restock Domain Model

- [x] Add RestockOrder and RestockOrderLine persistence.
- [x] Add draft, approval, optimistic versioning, selected lines, provenance, and Owner override fields.
- [x] Keep Restock approval separate from physical Inventory mutation.
- [x] Add Phase 4 backend regression contracts.

## Phase 5 — Reports ↔ Product ↔ Inventory Sync

- [x] Define selective domain-change propagation policy.
- [x] Keep Product presentation changes from triggering SARIMA refits.
- [x] Keep target/reorder changes focused on planning and recommendation refresh behavior.
- [x] Mark only sold Product forecasts dirty after POS checkout.
- [x] Add Phase 5 regression coverage.

## Phase 6 — Owner Custom Restock Workflow

- [x] Expose canonical restock planning data to the Owner Reports UI.
- [x] Allow quantity increase/decrease while preserving recommended and requested values.
- [x] Require an Owner reason for automated quantity overrides.
- [x] Allow removing a line and adding an existing canonical Product.
- [x] Allow target-stock and reorder-level updates before draft creation.
- [x] Support audited recommendation dismissal.
- [x] Support draft creation, draft line replacement, and selected-line approval.
- [x] Keep Phase 7 new Product creation out of the Phase 6 UI.
- [x] Keep physical Inventory unchanged by planning and approval.
- [ ] Complete exact-head CI certification and Owner browser QA.

## Phase 7–15

- [ ] Phase 7 — New Product from Restock/Reports.
- [ ] Phase 8 — Restock Approval Lifecycle hardening.
- [ ] Phase 9 — Arrival / Receiving Upgrade.
- [ ] Phase 10 — Bulk Delivery Workflow.
- [ ] Phase 11 — Forecast-driven Restocking.
- [ ] Phase 12 — Fast SARIMA Pipeline.
- [ ] Phase 13 — Reports → Action.
- [ ] Phase 14 — POS / FEFO Hardening.
- [ ] Phase 15 — Audit + Doctor + Release Gates.

## Sprint Activity Log

Phase 4–6 is currently under exact-head automated certification on `sprint/v0.10/sprint-10`; manual Owner QA follows only after the branch quality gates are green.
