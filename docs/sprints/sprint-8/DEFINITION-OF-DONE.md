# Sprint 8 Definition of Done

Sprint 8 is complete only when all applicable conditions below are satisfied.

## HTTP and health correctness

- Supported HTTP outcomes follow the approved canonical contract.
- Status codes are chosen by semantics, not for completeness or appearance.
- Liveness and readiness have distinct, tested meanings.
- Critical dependency unavailability is not reported as fully ready.
- Existing API paths, response envelopes, and application error codes are not broken accidentally.

## Security and failure safety

- Authentication remains fail-closed and internal OWNER/STAFF and customer credentials stay isolated.
- Unexpected failures do not expose stack traces, credentials, tokens, cookies, connection strings, or other sensitive configuration.
- Health endpoints expose only approved operational information.
- Request/logging changes never record passwords, JWTs, trusted-device tokens, customer session tokens, or cookies.
- Security-sensitive changes receive focused exact-diff review where supported.

## POS and inventory preservation

- Server reliability work does not bypass batch-authoritative stock rules, non-negative stock, FEFO/FIFO allocation, stock-movement auditability, transaction boundaries, or concurrency protection.
- Failed multi-record inventory or sale operations cannot leave partial committed state because of Sprint 8 changes.

## Change safety and verification

- Behavior changes use test-first development with observed RED then GREEN evidence.
- Bugs and CI failures receive root-cause investigation before fixes.
- Backend and frontend regression suites pass where applicable.
- Formatting, lint, typecheck, builds, guardrail tests, dependency checks, version consistency, and committed-status verification pass on the exact final head.
- Critical/Important review findings are resolved or explicitly accepted by the user before progression.
- Every phase records enough evidence to identify what changed, why, how it was tested, and how it can be reviewed.

## Repository governance

- `config/guardrails.json` and Sprint 8 branch/documentation agree on the active sprint; guardrails are never weakened to make CI pass.
- Sprint 8 required documentation remains complete and current.
- Changes stay within approved Sprint 8 scope unless the user explicitly expands it.
- Sprint 8 remains unmerged until automated verification is complete, the user performs manual acceptance testing, and the user explicitly approves the merge.
