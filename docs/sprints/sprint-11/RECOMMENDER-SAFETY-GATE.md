# Sprint 11 — Restock Procurement Safety Gate

**Status (2026-10-09): Code implemented; operational release NOT certified.**

This gate protects both automated and manual restock lifecycle operations against
accumulated quantities, unverified demand, excessive stock coverage, and purchases
without reliable cost evidence. It does not certify SARIMA forecast accuracy.

## Incident retained

- `RO-OCT-2026`, `SARIMA-P048`: saved/approved 202,270 units, zero received in the last read-only audit.
- Fresh calculation at the audit was 17 units, from 40.2354 monthly forecast demand
  minus 24 sellable units. **17 is a point-in-time calculation, not a supplier PO authorization.**
- No code change deletes, corrects, or cancels this approved legacy order.
  Only the authorized Owner cancellation flow may do so after supplier confirmation.
- A cancelled monthly batch intentionally prevents automatic regeneration that month.
  The Owner can prepare a separately reviewed manual order if stock is needed.

## Defenses now implemented

1. Draft reconciliation **sets** requested units to the latest recommendation
   rather than adding them repeatedly; preserves Owner edits.
2. Monthly order number is written **inside** the creation transaction; the
   existing unique database constraint blocks concurrent creation across servers.
   A duplicate-key race resolves to the previously created monthly order.
3. Independent policy checks **completed actual POS history** rather than
   accepting SARIMA forecasts as proof of allowable purchasing.
4. Fail-closed limits, pending formal store-policy approval:
   - Absolute maximum **1,000 units per selected line**.
   - Maximum **three months of recent completed POS-demand coverage** after
     deducting sellable and approved incoming stock (and adjusting expiry exposure).
   - Maximum **PHP 5,000 estimated cost per line**, **PHP 20,000 per order**.
   - No authorized purchase on missing POS evidence or unknown/invalid unit cost.
   - No Owner-reason bypass for inflated automated recommendations.
5. All selected approved/restock receipt lines (including manual lines)
   are checked. Version/CAS guards protect order edits; receiving uses
   outstanding units for partial deliveries and rejects accepted quantities
   **above the remaining approved order**, regardless of confirmation flag.
6. Automatic generation skips unsafe candidates. There is **no silent
   substitution** of flagged order quantities.

## Verified evidence

- Dedicated `Restock safety QA` CI workflow exists and runs test files
  `restock-phase11-decision.test.ts`, `restock-phase7-9-contract.test.ts`,
  followed by the backend build.
- Initial workflow result for commit `6ef19c4`: **31/31 tests passed,
  0 failures; backend build passed**.
- Subsequent commits (over-delivery, read-only operational audit) require
  the workflow to pass again before the implementation can be considered
  regression-validated. Do not infer pass status from older runs.
- Read-only audit (requires the local development MySQL URL)
  `npx tsx backend/src/scripts/restockSafetyAudit.ts --order RO-OCT-2026`.
  Never run generation, seed or schema synchronization during this audit.

## Remaining release blockers

- Actual multi-process MySQL race test of monthly creation and reconciliation.
- Approve/receive workflow tested with controlled transaction concurrency; risk
  checks run immediately before the order-version claim but do not yet lock
  underlying inventory/POS rows as one serializable procurement snapshot.
- Budget limits and supplier lead time must be agreed by the actual Owner.
  The defaults deliberately block large/unverified purchases and could also
  block legitimate large orders. No exception bypass is implemented yet.
- Out-of-sample SARIMA demand forecasting remains unverified using original
  completed 2026 POS sales. Workbook-only benchmark statistics are insufficient.
- Full repository CI formatting and dark-mode contract failures are tracked
  separately; scoped backend test success is not a full release sign-off.

**Release posture:** Owner-reviewed decision support only; no unsupervised
purchase authorization and no claim of 100% forecast or system accuracy.
