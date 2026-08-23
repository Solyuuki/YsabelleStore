# Sprint 8 Backlog

## Phase 0 — Baseline and safety lock

- [x] Create `sprint/v0.8/sprint-8` from the final verified Sprint 7 head.
- [x] Record current server-health, HTTP, auth, POS/inventory, compatibility, and change-safety invariants.
- [x] Keep Phase 0 documentation-only.

## Phase 1 — HTTP and error contract

- [x] Audit existing HTTP/error handling before changing behavior.
- [x] Write and observe the failing canonical HTTP status contract test.
- [x] Add the minimal canonical status contract for 200, 201, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, and 503.
- [x] Restore Sprint 8 guardrail preconditions without weakening them.
- [x] Run the new contract test within the normal backend test suite.
- [x] Verify full exact-head CI and PR guardrails after the final Phase 1 documentation commit.
- [x] Record Phase 1 evidence and stop before Phase 2.

## Phase 2 — Health, liveness, and readiness

- [x] Preserve a compatible health summary endpoint.
- [x] Add explicit liveness semantics for backend process availability.
- [x] Add explicit readiness semantics for critical dependency availability.
- [x] Return 503 when critical readiness requirements are unavailable.
- [x] Add canonical healthy/degraded/unavailable health states.
- [x] Add failure-simulation regression coverage.

## Phase 3 — Safe error handling

- [ ] Standardize client-safe unexpected failures.
- [ ] Review dependency/Prisma failure translation where appropriate.
- [ ] Prove stack traces, credentials, and sensitive configuration are not exposed.

## Phase 4 — Request traceability and safe logging

- [ ] Add a request/correlation identifier.
- [ ] Add safe structured request/error logging with explicit sensitive-field exclusions.
- [ ] Prove request identifiers can correlate client-safe errors with server-side diagnostics.

## Phase 5 — Frontend reliability states

- [ ] Distinguish healthy, degraded, database unavailable, backend unavailable, timeout, and offline conditions.
- [ ] Preserve the existing lightweight system-health indicator.
- [ ] Add frontend regression tests for each supported health state.

## Phase 6 — Server change-safety guardrails

- [ ] Add permanent server contract/failure-injection safeguards.
- [ ] Add compatibility and rollback guidance for risky server/database changes.
- [ ] Define repository security invariants/policy where approved.

## Phase 7 — Security and failure audit

- [ ] Review the exact Sprint 8 diff.
- [ ] Run supported security-diff review and information-disclosure checks.
- [ ] Resolve Critical/Important findings before progression or record explicit owner acceptance.

## Phase 8 — Final verification and human acceptance handoff

- [ ] Run full exact-head repository verification.
- [ ] Confirm CI, governance, PR checks, and Sprint 8 validation are green.
- [ ] Hand Sprint 8 to the user for manual acceptance testing.
- [ ] Do not merge without explicit user approval.
