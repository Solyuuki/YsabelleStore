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

- [x] Historical implementation reused the canonical Product create pipeline rather than creating a second backend Product engine.
- [x] Preserve Product duplicate, barcode, category, pricing, quality, and storefront validation.
- [x] Keep physical Inventory unchanged until receiving.
- [x] Retire the standalone Reports new-product restock entry after architecture review; Products remains the sole product-creation surface.
- [x] Keep Reports and Restock limited to existing canonical Products.

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

## Phase 10 — Bulk Restocking

- [ ] Replace the legacy Inventory bulk-stock presentation with the established Product Import dialog shell so import experiences remain visually consistent.
- [ ] Support only local Excel/CSV and PDF delivery files; do not add ZIP/archive or Google Drive handling to Inventory.
- [ ] Use Excel/CSV for structured bulk delivery rows and PDF as a supplier delivery-document source.
- [ ] Create a Delivery Session review surface before any physical stock mutation.
- [ ] Support product identification by existing Restock Order, SKU, Product search, barcode, and YSB internal label without requiring a scanner.
- [ ] Show per-line expected quantity, received quantity, batch/lot, and expiry/no-expiry state.
- [ ] Summarize total lines, discrepancies, missing expiry values, and unresolved products before completion.
- [ ] Keep unknown products unresolved until they are matched to an existing canonical Product or created through Products, then return to the Delivery Session; Inventory/Reports/Receiving must not create Products.
- [ ] Preserve Phase 9 damaged/return-report handling when bulk delivery lines linked to a Restock Order contain damaged or rejected quantities.
- [ ] Preserve partial-delivery semantics: physically missing units remain pending and are not treated as damaged returns.
- [ ] Complete receipt only after blocking delivery-session issues are resolved.
- [ ] Reuse canonical Product, Restock receiving, Batch, Inventory Movement, and stock-domain authorities; no direct UI Inventory mutation shortcut.
- [ ] Add Phase 10 backend/frontend regression contracts and scale coverage for large delivery sessions.
- [ ] Complete exact-head automated certification and Owner browser QA for Phase 10.

## Phase 11 — SARIMA-driven Restocking

- [ ] Connect existing SARIMA forecast output and recommendation types into restock recommendation calculations.
- [ ] Use forecasted demand, sellable stock, incoming approved stock, expiry losses, target stock, reorder level, and safety stock as recommendation inputs.
- [ ] Produce projected stockout date, suggested quantity, risk level, reason, and recommended action date.
- [ ] Preserve forecast recommendation and Owner-requested quantity as separate values.
- [ ] Keep recommendations advisory until Owner approval.

## Phase 12 — Fast SARIMA

- [ ] Preserve real SARIMAX candidate fitting and mathematical behavior.
- [ ] Mark only affected products DIRTY after relevant source changes.
- [ ] Add background forecast queue processing for affected products only.
- [ ] Reuse persisted forecast results through source-versioned cache semantics.
- [ ] Add parallel worker processing, previous-best parameter reuse, stale-while-revalidate behavior, and fallback handling for SARIMA-ineligible series.
- [ ] Keep Reports reading persisted READY results without waiting for synchronous global recomputation.

## Phase 13–15

- [ ] Phase 13 — Reports → Action.
- [ ] Phase 14 — POS / FEFO Hardening.
- [ ] Phase 15 — Audit + Doctor + Release Gates.

## Sprint Activity Log

Phases 7–9 are implemented and Owner-tested on `sprint/v0.10/sprint-10`. Phase 10 is the active implementation slice and evolves the legacy Inventory bulk-stock flow into a validated Delivery Session workflow while preserving the certified Receiving and stock-domain invariants. Product creation remains owned exclusively by Products; unresolved delivery rows must be resolved against that canonical catalog before stock can be received.
