# Sprint 8 Phase 7 — Security and Failure Audit

## Scope

This review covers the Sprint 8 diff against the verified Sprint 7 base, with focused review of every Sprint 8 source change that affects HTTP status semantics, health/readiness output, error handling, request tracing/logging, and frontend reliability classification. Existing Sprint 7 auth, storefront, POS, inventory, forecasting, and data-integrity behavior is treated as compatibility-sensitive inherited behavior rather than rewritten Sprint 8 scope.

## Threat and trust boundaries reviewed

- Public HTTP clients must not receive stack traces, connection strings, credentials, tokens, cookies, raw Prisma/MySQL diagnostics, or sensitive configuration values.
- Internal OWNER/STAFF bearer authentication and public customer authentication remain separate trust domains.
- Request correlation may expose a generated request identifier, but not request headers, bodies, query values, cookies, authorization values, or raw exception text.
- Health endpoints may expose service state and dependency status, but not sensitive dependency diagnostics.
- Sprint 8 must not bypass batch-authoritative inventory, non-negative stock, FEFO/FIFO allocation, stock-movement auditability, transaction boundaries, or existing concurrency protections.

## Reviewed Sprint 8 security-sensitive changes

- `backend/src/app.ts`
- `backend/src/constants/httpStatusContract.ts`
- `backend/src/controllers/healthController.ts`
- `backend/src/database/prismaClient.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/middleware/requestAuditLogger.ts`
- `backend/src/middleware/requestTrace.ts`
- `backend/src/routes/health.routes.ts`
- `frontend/src/services/systemHealthService.ts`
- `frontend/src/pages/WelcomePage.tsx`
- focused backend/frontend/server-reliability regression tests and guardrails

## Finding discovered and remediated

### Public database diagnostic disclosure through health output

Before remediation, `checkDatabaseHealth()` copied `error.message` directly into `database.message`, while Sprint 8 health responses returned that field. A Prisma/MySQL failure could therefore carry internal database diagnostic text across the public health-response boundary.

The shared database-health boundary was repaired so unavailable and not-configured states return only the generic message `Database connection is unavailable.` Raw exception text is no longer copied into the health result. The healthy status still returns `Database connection is available.`

Permanent regression coverage now verifies that readiness and summary responses preserve the approved status/ready semantics while rejecting database configuration names, connection-string forms, passwords, and secret-like content from the public payload.

Remediation commits:

- `e6bd60383438753789dee7acc5f68c67ee4d3af2` — sanitize database health diagnostics
- `fc712cdbb4ce8b49fd7599e044c175603db155f5` — add public health diagnostic regression coverage

## Other reviewed boundaries

- Unexpected server failures use a generic 500 response and do not forward raw exception messages/details.
- Structured request logging records only request ID, method, path, status code, and duration.
- Request IDs are generated server-side and used only for correlation.
- Frontend reliability classification does not introduce credential handling or authorization changes.
- Sprint 8 does not intentionally change POS/inventory mutation logic, database schema, or auth authorization semantics.

## Review result

After the database-health remediation, no unresolved Critical or Important Sprint 8 security finding was identified in the reviewed diff.

The current host does not expose the full Codex Security scan orchestration described by the installed security workflow, so this phase used GitHub exact-diff/source review plus repository regression/CI evidence rather than claiming a completed canonical Codex Security scan. This limitation is recorded explicitly and is not treated as equivalent to a full external penetration test.

## Exit gate

Phase 7 is complete when the remediation and regression are present and the final Sprint 8 exact head passes the repository verification gates. Promotion to `staging` remains a separate release-candidate step, followed by another full verification before any `main` promotion.
