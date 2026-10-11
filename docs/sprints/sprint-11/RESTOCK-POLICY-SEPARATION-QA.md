# Sprint 11 — Automated restock vs Owner purchasing policy

## Intended purchasing boundaries

- Automated restock batch **generation**: the existing independent POS-history,
  3-month coverage, absolute units and estimated cost ceilings remain strict.
  Unsafe automated product lines are not purchased automatically.
- Automated monthly restock **snapshot**: a persisted `RO-MMM-YYYY` draft
  freezes all eligible recommended product lines for that month. Each worker
  retry/server restart checks for this draft **before recalculating**. Existing
  monthly drafts cannot be silently reconciled or inflated. Database uniqueness
  on order number remains the multi-process duplicate-creation boundary.
- Owner-created/manual restock: POS history, forecast coverage and provisional
  budget thresholds are warnings, not buying restrictions. Approval returns
  `RESTOCK_OWNER_WARNING_ACK_REQUIRED` with product-specific advisory details;
  the Owner can explicitly proceed with original requested quantities. The
  acknowledgment and actor are included in the persisted order notes.
- Receiving / Awaiting Delivery: validate frozen approved quantities, proper
  state/version, whole units, stock/batch/barcode constraints and duplicate
  receipts, **not fresh procurement calculations**. A stale forecast or changed
  cost cannot independently reject a legitimate accepted supplier delivery.
- Historical automated tickets: persisted system-generated monthly tickets
  with inflated (>1,000) or invalid quantities, or requested quantities far
  beyond their saved recommendation baseline, remain quarantined before
  shipment transition and before **any** physical stock mutation.

## Existing operational workflow

1. Closed September data contribute to October recommendation inputs.
2. An October automation run evaluates the full eligible product list and saves
   a single frozen owner-review multi-product draft.
3. The draft appears in **Recommended & saved restock plans**. Owner approval
   changes the existing draft to an approved incoming restock ticket.
4. After approval, **Reports → Restock Order History** offers Download PDF,
   Print and Excel-compatible CSV supplier copies.
5. **Receiving** processes confirmed actual deliveries (including partial or
   damaged shipments). Only accepted units enter physical Inventory.

### Limitations and release gates

- This patch freezes **created** monthly batches, but does not create a new
  persistent month-close snapshot table. Months with **zero eligible automated
  candidates** are checked on later worker runs and may generate a batch if
  candidates become eligible. This cannot inflate an existing batch, but exact
  once-only execution for zero-action months needs future persisted
  no-action monthly run records and a database migration.
- The first eligible automation run of the target month is used as the
  snapshot creation time. Backdating input changes is not supported. Formal
  immutable closed-month demand-source provenance and forecast accuracy are
  separate certification tasks.
- No migration, automatic historical ticket adjustment, cancellation,
  opening stock or supplier purchase occurs in this patch.
- Legacy inflated orders remain blocked and require authorized audit/correction.
  Previously confirmed clean manual tickets do not need to reauthorize their
  current purchasing quantity during physical receiving.
- The owner-acknowledgment audit is recorded on order notes; future richer
  per-product commercial decision history could use a dedicated audit table.

## Validation

Automated:

- `npx tsx --test --test-concurrency=1 backend/test/restock-owner-policy.test.ts backend/test/restock-phase11-decision.test.ts backend/test/restock-phase7-9-contract.test.ts`
- `node --test scripts/test/restock-forecast-automation-source.test.mjs scripts/test/restock-owner-warning-ui.test.mjs`
- Backend + frontend + Electron builds; existing POS and Storefront concurrent
  stock reservations must remain green.

Manual:

1. Review six-product manual saved restock (300 units): triggering a warning
   must not create a second draft/ticket; Owner chooses **Continue with my quantities**;
   authorized quantity is unchanged and acknowledgment recorded.
2. Review an automated monthly draft: generated quantities stay unchanged after
   refresh, worker retry, and restart; re-approve only once.
3. Confirm clean `RO-SEP-2026` through Receiving, including partial/damaged
   delivery and valid integer quantities. Current POS/cost limits may no longer
   veto the receipt, but other receipt protections still apply.
4. Confirm known historical inflated `RO-OCT-2026` cannot be received or
   advanced, and inventory remains unchanged when blocked.
5. Supplier PDF/print/CSV and return history remain operational.
6. Run read-only safety audit first and independently confirm local DB state.

**Do not run migrations, auto-backfill old tickets, or amend live stock during
release checks.** Manual QA and safe staging/live MySQL concurrency validation
are required before calling this production-certified.

## Owner warning dialog scroll QA

Both Restock Planner **Review restock** and Recommended & Saved Restock
draft confirmation use a viewport-bounded dialog with a non-scrolling header,
a single keyboard- and pointer-scrollable content region (products and all
purchasing warnings), and a pinned Back/Confirm footer. On warning response the
content region scrolls to the advisory list. The Radix body scroll lock remains
intentional; the dialog body itself must scroll without clipping the final
Owner decision buttons.

- Exercise an 8-product / 80-unit manual plan whose POS-history advisories
  yield at least eight warnings; verify the warning content is scrollable,
  keyboard focus reaches its control and the footer remains accessible.
- Exercise a saved draft with many lines and warnings; check Back/Keep draft
  and **Continue with my quantities** in narrow and short viewport sizes.
- `node --test scripts/test/restock-owner-warning-scroll.test.mjs`
- No quantity, approval, supplier ticket, or physical inventory logic changed
  in this layout fix.

## Saved Draft review spacing and permanent removal

- Manual saved-draft review rows reserve horizontal breathing room with
  `px-4 sm:px-5`, inside the existing `px-5 sm:px-6` scroll region.
  Product names and quantity labels no longer touch the list border.
- Draft action is **Remove draft**, distinct from **Cancel ticket** in
  Receiving. The Owner must explicitly confirm **Yes, remove draft**; selecting
  Back to draft never removes anything.
- The `DELETE /api/restock-orders/:orderId` endpoint is Owner-only and accepts
  an `expectedVersion` concurrency precondition. It requires `DRAFT`,
  rejects previously received units, and atomically deletes only that restock
  order and its dependent draft lines (Prisma `onDelete: Cascade`). No
  inventory or recommendation records are deleted.
- Persisted automated monthly drafts are protected from deletion to avoid
  retries regenerating the same monthly recommendation. The UI omits Remove
  draft for those batches; the backend independently checks both marker and
  deterministic monthly order number. Approved, cancelled or received tickets
  cannot use this endpoint.
- No migration and no automatic cleanup is performed; deletion occurs only
  after explicit user confirmation.
- Regression commands:
  `npx tsx --test backend/test/restock-draft-removal.test.ts`
  and `node --test scripts/test/restock-draft-removal-ui.test.mjs`.

Manual QA: review a draft with 8+ products in a narrow/short viewport.
Verify visible left/right spacing, pinned actions, scrollable content, and
high-contrast Remove action. Cancel removal, verify draft remains. Then on an
intentionally disposable manual test draft, confirm removal and verify it
disappears from the list without appearing as a CANCELLED Receiving ticket.
Verify no inventory movement occurs. An automated monthly draft must not
offer removal and the delete endpoint must reject it.
