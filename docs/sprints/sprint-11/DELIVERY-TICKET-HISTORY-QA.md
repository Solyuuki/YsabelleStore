# Sprint 11: Delivery queue, retained ticket history and bounded payloads

## Root cause and scope

The previous Deliveries screen had one mixed queue and one status dropdown. Selecting
`CANCELLED` hid delivered tickets, leading operators to think ticket history had disappeared.
The database stores delivery events and retained order records; the list view lacked a
separate history workflow. The list also loaded all child items and all delivery events
for every row, inflating the response as ticket volume grew.

This change has **no database migration and no data deletion**. It adds:

- **Active queue:** actionable deliveries, reattemptable delivery failures, and delivered
  tickets whose payments are still outstanding.
- **History:** every delivered or cancelled ticket, including COD deliveries awaiting
  collection (these also remain actionable in Active).
- **All tickets:** an unfiltered-by-view, paginated lookup for existing records.
- **Open ticket:** a separate authenticated, role-checked read for the full order,
  product items, courier details and complete delivery-event timeline.
- Server-side page clamping, status/payment/search filters, and compact list records.
- An explicit activity history panel inside each ticket with status, actor, time and notes.
- A read-only audit to compare database totals, status groupings and event counts.

A failed or rejected checkout because of stock conflict **is not a customer delivery
ticket**; its transaction is rolled back and should never be inserted into the queue.
Capturing those attempts requires a separate bounded, privacy-safe rejection audit with
an explicit retention policy. Do not mislabel genuine cancellations as rejected sales.

## Inventory and payment guardrails

All existing POS/Storefront inventory locks, active reservation accounting, release on
cancellation, COD finalization, idempotency keys and duplicate-sale defenses remain
untouched. Delivered-but-unpaid COD tickets appear in both History (the handoff occurred)
and Active (the cash is still due). Thus Active + History counts may exceed All.

## Validation and QA

Automated contracts:
`node --test scripts/test/delivery-history-contract.test.mjs`

Backend transition and view-filter tests:
`npx tsx --test backend/test/customer-delivery.test.ts`

Read-only actual database count audit:
`node --env-file=.env --import tsx backend/src/scripts/deliveryHistoryReadOnlyAudit.ts`

Real concurrent stock test: dedicated ephemeral MySQL GitHub Actions workflow,
`.github/workflows/stock-reservation-concurrency-qa.yml`.

Manual QA (pending): Active, History and All with search/payment/status filters;
cancelled records; delivered paid/unpaid COD; pagination, refresh, dark/light;
Open ticket event history; no duplicate sale or stock mutations; desktop and mobile.

This file records implemented code and planned QA, not certification of the local
store database.
