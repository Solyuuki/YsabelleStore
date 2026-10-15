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
- One backend next-month stock projection supplies the product report, recommendation card, monthly preview, and Dashboard. Urgent stockouts use the current shortage quantity instead.
- The forecast read path rejects prior-month SARIMA batches after Manila month rollover and safely uses the completed-POS fallback until a current-month model is ready.

## Verification and gate

- Backend date/decision regressions: `backend/test/restock-monthly-cycle.test.ts`.
- Source integration contracts: `scripts/test/restock-monthly-cycle-contract.test.mjs`.
- Existing phase 11 risk/approval, full restock safety, POS/Storefront, inventory and Receiving tests remain required.
- The dedicated restock safety workflow now covers pushes to `staging`.
- Rollout needs read-only review of existing RO-OCT-2026 drafts and an isolated database rollover / two-worker concurrency rehearsal before production certification. Never replay writes against live inventory.

## Release boundary

Only commit to the existing `staging` branch and let existing PR #56 run its normal review checks. No direct main merge, no forced database migration, and no unrelated catalogue/media modifications.

## Follow-up UI and coverage QA (October 15, 2026)

- Recent completed-POS history and forecast-based cover retain distinct provenance and labels.
- Missing historical coverage never appears as a dash inside an Owner-facing recommendation.
- Limited completed POS history displays a neutral "History limited" status rather than an unexplained "Normal"; forward-looking forecast risk stays separate.
- Public Storefront footer omits the Staff / Owner Login link; protected internal sign-in routes remain intact.
- Visible application release label is v0.12.0; private workspace package versions stay unchanged.
- No changes to SARIMA estimation, monthly automation, Owner approvals, Receiving or stock mutations.
- Verify history-missing, zero-demand, forecast-cover, direct internal login, mobile contrast and version checks before release.
