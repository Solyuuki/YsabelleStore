# Sprint 11 — Dashboard monthly restock batch summary

## Scope

Replace the Dashboard single-product "Highest priority this month" teaser with a
compact **Monthly Restock Plan** preview. This is a read-only presentation of
live current-month recommendation actions, **not** a persisted/frozen monthly
snapshot or an approved purchase order. Do not create or approve tickets from
the Dashboard card.

The backend aggregates **all returned planning actions before truncating the
Dashboard assistant's five-item preview**:

- **To restock** — products with a positive replenishment recommendation
  (`RESTOCK` action).
- **Suggested units** — units for restock actions only.
- **Other reviews** — `EXPIRY_REVIEW` and `REDUCE_REPLENISHMENT` products;
  these must never be labelled as units to order.

The single **Review full restock plan** action opens Reports, whose monthly
product report already supports pagination and product-level inspection.
When there are no actionable products, the existing all-clear message and
report link remain. Responsive layout uses three short counters and preserves
light mode and the dashboard's existing dark-mode surface tokens.

## Safeguards

No changes to POS/Storefront reservations, restock safety checks, forecasts,
the 30-second restock worker, procurement tickets, approvals, receiving, or
physical inventory. This patch does **not** fix the separate freeze/month-close
snapshot architecture or the historical inflated `RO-OCT-2026` incident.

## Verification

- `node --test scripts/test/dashboard-monthly-inventory-report.test.mjs`
- `npx tsx --test backend/test/dashboard-monthly-restock-summary.test.ts`
- Frontend/backend/Electron CI builds.
- Manual Dashboard QA in both themes: current screenshot's 8 actions should
  map to 1 product to restock, 17 suggested units, and 7 other reviews,
  **if the underlying live data remains unchanged**.
- Verify Reports navigation, the complete paginated product report, and
  that Dashboard refresh does not create a purchase ticket.

Production/release certification and immutable monthly-batch implementation
are separate work.
