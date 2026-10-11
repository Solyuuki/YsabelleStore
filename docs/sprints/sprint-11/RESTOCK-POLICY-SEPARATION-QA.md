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
