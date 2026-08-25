# Sprint 8 Server Change-Safety and Rollback Guide

## Invariants

Server reliability changes must preserve these repository boundaries:

- Internal OWNER/STAFF authentication and public customer authentication remain isolated and fail closed.
- Customer/storefront requests must not inherit internal bearer credentials.
- Batch stock remains authoritative; aggregate stock must reconcile to valid batch quantities.
- Stock cannot become negative, allocation remains FEFO/FIFO as applicable, and stock movements remain auditable.
- Multi-record POS/inventory operations retain their existing transaction and concurrency protections.
- Existing public API paths, application error codes, and compatible response envelopes remain stable unless a separately approved change requires otherwise.
- Health responses and logs must never disclose passwords, JWTs, trusted-device tokens, customer session tokens, cookies, connection strings, or stack traces.

## Change procedure

1. Add or update a focused regression before changing server behavior.
2. Reproduce the old failure or missing behavior when feasible.
3. Make the smallest shared-boundary change.
4. Run the focused regression, adjacent package tests, and full repository verification.
5. Review the exact diff for information disclosure, auth isolation, POS/inventory integrity, and compatibility regressions.
6. Record deployment assumptions and any remaining manual checks.

## Compatibility rules

- `/api/health` remains the compatible summary endpoint.
- `/api/health/live` indicates process liveness only.
- `/api/health/ready` indicates readiness of critical dependencies and configuration and may return HTTP 503.
- Unexpected server failures use a client-safe generic 500 response. A request identifier may be returned solely to correlate the response with safe server logs.
- Expected client errors below HTTP 500 preserve their approved status, application error code, safe message, and safe details.

## Logging rules

Structured request logs may contain only fields required for operational correlation, such as request ID, method, route path, status code, and duration. Do not log request bodies, query values, headers, cookies, authorization values, passwords, tokens, or raw exception messages/stacks by default.

## Rollback

If a Sprint 8 server change causes a production regression:

1. Stop promotion of the affected revision.
2. Identify the smallest Sprint 8 commit or merge range responsible for the regression.
3. Revert that range rather than weakening authentication, inventory invariants, validation, logging redaction, or guardrails.
4. Restore the previously verified API/health behavior and rerun focused plus full repository verification.
5. If a database migration is involved, follow the migration-specific recovery plan and validate data integrity before resuming writes. Do not perform destructive rollback without an explicit backup/recovery decision.
6. Record the incident, affected request IDs when available, root cause, and verification evidence before retrying deployment.
