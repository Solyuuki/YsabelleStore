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
- [x] Keep physical Inventory unchanged by planning and approval.
- [x] Complete exact-head automated certification for the Phase 4–6 implementation baseline.
- [ ] Complete Owner browser QA for the combined Restock workspace.

## Phase 7 — New Product from Restock/Reports

- [x] Reuse the canonical Product create pipeline from Reports instead of creating a second Product engine.
- [x] Preserve Product duplicate, barcode, category, pricing, quality, and storefront validation.
- [x] Create the normal zero-stock Inventory shell and link the new canonical productId to a manual restock draft.
- [x] Keep physical Inventory unchanged until receiving.
- [x] Add Phase 7 frontend contract coverage.

## Phase 8 — Restock Approval Lifecycle

- [x] Preserve DRAFT → APPROVED Owner approval with optimistic versioning.
- [x] Add APPROVED → AWAITING_DELIVERY lifecycle transition.
- [x] Add reason-required audited cancellation while preserving order history.
- [x] Block cancellation after physical stock has been received.
- [x] Add a STAFF/OWNER request entry point while keeping approval and lifecycle actions Owner-controlled.
- [x] Add Phase 8 backend/frontend regression contracts.

## Phase 9 — Arrival / Receiving Upgrade

- [x] Reuse the canonical transactional receiving and stock-domain engines.
- [x] Record delivered, damaged, and accepted quantities separately.
- [x] Add only accepted quantity to physical Inventory.
- [x] Preserve batch, expiry/no-expiration, barcode enrollment, movement history, and inventory aggregate invariants.
- [x] Require explicit confirmation for over-delivery.
- [x] Use optimistic order version claims to block duplicate/concurrent receipt submission.
- [x] Support partial and multiple deliveries with PARTIALLY_RECEIVED / RECEIVED progression.
- [x] Add Phase 9 backend/frontend regression contracts.

## Phase 10–15

- [ ] Phase 10 — Bulk Delivery Workflow.
- [ ] Phase 11 — Forecast-driven Restocking.
- [ ] Phase 12 — Fast SARIMA Pipeline.
- [ ] Phase 13 — Reports → Action.
- [ ] Phase 14 — POS / FEFO Hardening.
- [ ] Phase 15 — Audit + Doctor + Release Gates.

## Sprint Activity Log

Phases 7–9 are implemented on `sprint/v0.10/sprint-10` and are under exact-head automated certification. Manual Owner browser QA remains an explicit gate for the combined Reports → Restock → Receiving experience before the implementation is treated as visually certified.
