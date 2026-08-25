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

- [x] Standardize client-safe unexpected failures.
- [x] Review dependency/Prisma failure translation where appropriate.
- [x] Prove stack traces, credentials, connection details, and sensitive configuration are not exposed through server-error or health-response boundaries.

## Phase 4 — Request traceability and safe logging

- [x] Add a request/correlation identifier.
- [x] Add safe structured request/error logging with explicit sensitive-field exclusions.
- [x] Prove request identifiers can correlate client-safe errors with server-side diagnostics without logging secrets.

## Phase 5 — Frontend reliability states

- [x] Distinguish healthy, degraded, database unavailable, backend unavailable, timeout, and offline conditions.
- [x] Preserve the existing lightweight system-health indicator.
- [x] Add frontend regression tests for each supported health state.

## Phase 6 — Server change-safety guardrails

- [x] Add permanent server contract/failure-injection safeguards.
- [x] Add compatibility and rollback guidance for risky server/database changes.
- [x] Define and document Sprint 8 server-security and data-integrity invariants.

## Phase 7 — Security and failure audit

- [x] Review the exact Sprint 8 diff and security-sensitive boundaries.
- [x] Run supported information-disclosure and correlation-safety checks.
- [x] Resolve the discovered public database-diagnostic disclosure path and add permanent regression coverage.
- [x] Confirm no unresolved Critical/Important Sprint 8 finding remains in the reviewed diff; record tooling/coverage limitations explicitly.

## Phase 8 — Final verification and release-candidate handoff

- [x] Run full exact-head repository verification after final Sprint 8 documentation reconciliation.
- [x] Confirm CI, governance, PR checks, workspace builds, tests, dependency audit, and committed-status verification are green on the verified implementation head `a19927933ec5255ff7b1b5f6776cd453feda9844`.
- [ ] Promote the final verified Sprint 8 documentation head by replacing the stale `staging` branch state with that exact commit.
- [ ] Run the full release-candidate verification again on `staging`; repair any staging-only issue before considering `main`.
- [ ] Hand the verified staging candidate to the user for manual acceptance testing.
- [ ] Do not promote `staging` to `main` without explicit user approval after manual acceptance.
