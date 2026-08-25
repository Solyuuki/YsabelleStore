# Sprint 8 Phase 2 Evidence — Health, Liveness, and Readiness

## Scope

Phase 2 separates backend process liveness from application readiness while preserving the existing `/api/health` summary contract for current clients. It does not perform Phase 3 error sanitization, Phase 4 request logging, or Phase 5 frontend reliability-state changes.

## TDD RED evidence

The Phase 2 regression suite was added before production behavior. On commit `7a2fb01609b17522cc918a473fef1f8fd67ffe5e`, CI reached the workspace-test step with formatting, lint, typecheck, and guardrail checks already passing, then failed the four new health assertions because:

- `/api/health/live` returned 404 instead of 200.
- `/api/health/ready` returned 404 instead of 200 for a ready service.
- `/api/health/ready` returned 404 instead of 503 when the database configuration was absent.
- `/api/health` did not yet expose a canonical top-level service status.

This established that the tests were exercising behavior that did not exist before Phase 2.

## Implemented contract

- `GET /api/health/live` answers process liveness without making database readiness a prerequisite.
- `GET /api/health/ready` evaluates critical database and authentication configuration readiness.
- Ready service: HTTP 200, `status: healthy`, `ready: true`.
- Database unavailable or not configured: HTTP 503, `status: unavailable`, `ready: false`.
- Required authentication configuration missing while the database remains connected: HTTP 503, `status: degraded`, `ready: false`.
- Existing `GET /api/health` remains HTTP 200 for compatibility while now exposing canonical `status` and `ready` fields.
- Phase 1 `HTTP_STATUS` constants are used for 200 and 503 behavior.

## Regression coverage

`backend/test/health-readiness.test.ts` covers:

- liveness independent of database configuration;
- healthy readiness;
- degraded readiness caused by missing required JWT configuration;
- unavailable readiness caused by missing database configuration;
- backward-compatible HTTP 200 summary behavior with truthful canonical health fields.

The health regression is included in the normal backend test command and therefore runs under repository CI.

## Compatibility and scope controls

- The original `/api/health` route remains available.
- Frontend health-service behavior was not changed in this phase.
- Existing database-health implementation remains authoritative for connection checks.
- Raw diagnostic sanitization is intentionally deferred to Phase 3 rather than mixed into this phase.
- Request IDs and structured logging remain Phase 4 work.
- No POS, inventory, customer-auth, internal-auth, storefront, forecasting, or database schema behavior was intentionally changed.

## Verification rule

The final Phase 2 status is determined from CI, Repository Governance, and Pull Request Checks on the exact final documentation head after this evidence file is committed. Phase 3 must not begin until that exact-head verification is green.
