# Sprint 8 Phases 3–6 Evidence

## Phase 3 — Safe error handling

The backend now treats unexpected failures and server-side `HttpError` values as an information-disclosure boundary. Client responses use the generic `INTERNAL_SERVER_ERROR` code and `An unexpected error occurred.` message rather than forwarding raw internal exception messages or details. Expected client errors below HTTP 500 preserve their existing safe status, application error code, message, and details. File-size upload errors retain their established 413 contract.

Regression coverage in `backend/test/error-handler-security.test.ts` exercises raw exception content containing connection credentials/internal host data, a server-side `HttpError` carrying token-like diagnostics, and a legitimate 422 validation response.

## Phase 4 — Request traceability and safe logging

`requestTrace` assigns a UUID request identifier before API routing and returns it through `x-request-id`. `requestAuditLogger` records only request ID, method, path, response status, and duration. It intentionally does not record request headers, cookies, authorization values, query values, or request bodies.

Unexpected server failures return only the request identifier as diagnostic response detail and emit a safe structured error event containing the same identifier, status, error type, and application error code. Raw exception messages, details, and stacks are not emitted by this boundary.

`backend/test/request-traceability.test.ts` verifies correlation and rejects logs containing authorization tokens, cookies, query secrets, passwords, or the simulated raw exception secret.

## Phase 5 — Frontend reliability states

The system-health service distinguishes the Sprint 8 conditions `healthy`, `degraded`, `database-unavailable`, `backend-unavailable`, `timeout`, and `offline`, while preserving the existing lightweight welcome-screen health indicator. The service classifies an abort as a timeout, browser-reported network disconnection as offline, and an online fetch failure as backend unavailable.

`scripts/system-health-reliability-test.ts` provides focused classification regression coverage. The frontend workspace test command includes this contract.

## Phase 6 — Change-safety guardrails

`scripts/test/server-reliability-contract.test.mjs` permanently guards middleware ordering, the generic server-error boundary, safe request-log field selection, and the required frontend reliability-state set. `docs/sprints/sprint-8/SERVER-CHANGE-SAFETY.md` records compatibility rules, security/POS/inventory invariants, safe logging restrictions, and rollback guidance.

## Verification status

These phases are implementation-complete but are not called final until the existing Sprint 8 branch is reconciled with the latest verified Sprint 7 head and the resulting combined exact head passes the full repository verification, security/failure review, Sprint 8 validation, governance, and PR checks. Human acceptance remains a separate user-run gate.
