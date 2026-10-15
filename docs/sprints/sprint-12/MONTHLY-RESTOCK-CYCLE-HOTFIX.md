# Sprint 12 — Monthly Restock Cycle Alignment (PR #56)

## Intended behavior

- October 15–31, 2026: November 1 scheduled restock is a preview, not an ordering deadline.
- November 1, 2026 00:00 Asia/Manila (October 31 16:00 UTC): activation becomes eligible.
- The independent hourly automation worker may recover a missed activation when it restarts.
- Existing current-month automated drafts (if any) remain intact. No retroactive October draft is generated after this rollout.
- Only one automated monthly Owner-review draft is authorized; approval and physical receiving remain separate.
- Emergency stock alerts and explicitly created manual Owner procurement remain available, independently of scheduled monthly replenishment.

## Safety and persistence

- Uses the already-deployed catalog audit table for one deterministic restock-run marker per month; no schema migration or stock mutation.
- Atomic primary-key claim and compare-and-swap leasing protect concurrent workers. Interrupted cycles can retry after the lease expires.
- Created and no-action cycles remain recorded. Existing RO-MMM-YYYY uniqueness and frozen snapshot checks remain unchanged.
- Do not count unapproved drafts as incoming stock.
- The forecast read path excludes superseded monthly forecast points while fresh generation runs.

## Verification and gate

- Backend date/decision regressions: `backend/test/restock-monthly-cycle.test.ts`.
- Source integration contracts: `scripts/test/restock-monthly-cycle-contract.test.mjs`.
- Existing phase 11 risk/approval, full restock safety, POS/Storefront, inventory and Receiving tests remain required.
- The dedicated restock safety workflow now covers pushes to `staging`.
- Rollout needs read-only review of existing RO-OCT-2026 drafts and an isolated database rollover / two-worker concurrency rehearsal before production certification. Never replay writes against live inventory.

## Release boundary

Only commit to the existing `staging` branch and let existing PR #56 run its normal review checks. No direct main merge, no forced database migration, and no unrelated catalogue/media modifications.
