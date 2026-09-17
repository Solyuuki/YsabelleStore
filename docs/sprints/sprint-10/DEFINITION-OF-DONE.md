# Sprint 10 Definition of Done

Sprint 10 work is complete only when implementation, data integrity, domain boundaries, automated verification, and applicable manual QA agree on the exact committed head.

## Domain integrity

- Product remains canonical catalog authority.
- Inventory Batch remains physical quantity and expiry authority.
- Inventory Movement remains the audit authority for every stock change.
- Forecasts and Recommendations never mutate Inventory directly.
- Restock approval creates procurement intent and incoming stock only.
- Physical stock is created only after actual arrival through the stock domain.

## Phase 4–6 acceptance

- RestockOrder and RestockOrderLine persistence and lifecycle compile against Prisma.
- OWNER-only Restock APIs support planning, audited dismissal, draft creation/editing, and approval.
- Automated quantity overrides preserve recommended and requested quantities and require a reason.
- Selective synchronization avoids brute-force SARIMA refreshes.
- Reports exposes the Owner restock planner without adding Phase 7 new-product creation.
- Planning and approval do not create InventoryBatch or InventoryMovement records.
- Backend and frontend Phase 4–6 contracts pass.

## Validation Status

Before manual Owner QA is accepted, the exact branch head must pass:

- Prisma generate and validate.
- Disposable CI database synchronization.
- Guardrail preflight.
- Formatting.
- Lint.
- Typecheck.
- Guardrail tests.
- Workspace tests.
- Repository production build.
- Production dependency security reachability audit.
- Version consistency.
- Sprint and artifact status verification.
- Backend, frontend, and Electron workspace builds.

Manual QA must confirm that approving a Restock Order changes incoming procurement state but does not increase physical Inventory before goods arrive.
