# Sprint 11 — Quality of Life, Stabilization, and Optimization

Sprint 11 starts from the certified Sprint 10 release on `main` and focuses on improving the existing system rather than expanding its core product scope.

## Sprint theme

Quality of Life / Stabilization & Optimization.

## Execution rule

Sprint 10 domain authorities remain the baseline. Sprint 11 changes must be justified by a concrete defect, reliability problem, measurable performance issue, maintainability concern, or user-experience improvement. Existing inventory, receiving, restock, forecasting, POS, storefront, and audit contracts must not be rewritten casually.

## Workstreams

1. Bug and error correction.
2. HTTP/API reliability and consistent error semantics.
3. Global system-health, reconnect, and failure UX.
4. Performance and runtime optimization.
5. User workflow and interface quality-of-life improvements.
6. Technical cleanup, maintainability, and regression hardening.
7. Release verification and manual QA.

## Current active slice

The first active Sprint 11 slice standardizes the HTTP status/transport contract so later reliability UI can react consistently to authentication, authorization, validation, conflict, rate-limit, dependency, timeout, and service-unavailable conditions.

## Integration rule

Task branches target `sprint/v0.11/sprint-11`. Accepted Sprint 11 work is promoted through the established staging and main release path only after relevant automated gates and manual QA pass.

## Migration/canonical-state hardening checkpoint

Phase 4 is activated for the Generation 2 canonical release. The production-50 candidate corpus is reconciled, all 200 runtime image identities are integrity-pinned, exact-byte reconstruction from the Git-pinned sources is verified, approved canonical data materialization is wired into pull convergence, and guarded EMPTY/LEGACY recovery requires a database backup plus explicit confirmation. CI rehearsal covers EMPTY, LEGACY, compatible Generation 2, idempotent CURRENT, AHEAD refusal, DRIFTED refusal, runtime/private sentinel preservation, and exact 200-file asset convergence; `distributionReady` is `true`.

## Phase 5 canonical publication checkpoint

Canonical pushes use deterministic field-level changesets keyed by stable table/row/field identity and a concrete base commit/version. Pre-push protection refreshes the Sprint canonical ref, rejects stale bases and frozen-history rewrites, requires canonical catalog edits to carry a committed changeset, checks same-record/same-field conflicts against intervening remote changesets, blocks hidden canonical DB drift, and requires image changes to publish the complete state/release/reconciliation/distribution bundle. Runtime/private tables are excluded from the publication contract. `npm run state:rebase` performs guarded non-overlapping rebases; conflicting canonical fields stop for explicit review. Remote CI validates changeset security and rehearses deterministic merge/conflict/privacy/image-publication rules before a candidate state is accepted as team-latest. Phase 5 completion is certified only by a green CI run on the current Sprint 11 head.

## Phase 6 full rehearsal and release-hardening checkpoint

The final canonical-state hardening gate now composes the Phase 4 convergence rehearsal and Phase 5 publication rehearsal, then explicitly verifies same-schema stale catalog/assets convergence without a schema reset, runtime/private sentinel preservation, database image-reference to physical-file parity, corrupt runtime-image detection and repair, restartable/idempotent convergence, frozen-migration push rejection, Prisma client generation, and a web development-stack startup/health smoke against the disposable rehearsal database. Phase 6 completion remains gated on a green CI run at the current Sprint 11 head; no migration-hardening temporary workbench is part of the release path.
