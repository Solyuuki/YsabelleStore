# Sprint 8 Phase 0 — Baseline & Safety Lock

## Purpose

Phase 0 records the server behavior and invariants that later Sprint 8 phases must preserve. It is intentionally documentation-only. No production server or frontend behavior is changed in this phase.

## Source baseline

- Repository: `Solyuuki/YsabelleStore`
- Sprint branch: `sprint/v0.8/sprint-8`
- Base revision: `0866eb7acfc9ffaa8ee8f1b3a8d7abbe06cc1842`
- Base source: final verified Sprint 7 head

## Existing reliability foundation

The baseline already contains:

- centralized `HttpError` carrying an HTTP status, application error code, message, and optional details;
- centralized Express error middleware;
- route-level 404 handling;
- `/api/health` with a real Prisma/MySQL connectivity check;
- frontend system-health classification and periodic polling;
- existing 400/401/403/404/409/413/422/429/500 usage across active modules;
- authentication throttling with `Retry-After`;
- Prisma transactions and stock-domain invariants protecting POS/inventory mutations;
- CI, pull-request checks, repository governance, and sprint-specific validation patterns.

## Confirmed baseline gaps to address later

1. `/api/health` currently responds with HTTP 200 even when the database reports `unavailable` or `not_configured`.
2. Frontend health classification understands warning/degraded-like states, but the current backend health payload does not provide one canonical top-level health status.
3. Public health output includes operational detail that should be reviewed for production-safe disclosure.
4. There is no repository-wide documented HTTP status contract.
5. Unexpected server failures do not yet have a request/correlation identifier for safe end-to-end tracing.
6. Safe structured logging and explicit sensitive-field exclusion rules are not yet a Sprint-level invariant.
7. Permanent failure-injection and compatibility gates for server-health/error behavior need stronger coverage.

## Non-negotiable server invariants

All later Sprint 8 phases must preserve these unless the user explicitly approves a design change.

### Authentication and authorization

- Internal OWNER/STAFF authentication and public customer authentication remain separate trust domains.
- Customer session credentials must never authorize internal staff APIs.
- Internal bearer credentials must never become customer identity.
- Authentication failures fail closed.
- Invalid/missing credentials never grant partial access.
- Passwords, JWTs, trusted-device tokens, customer session tokens, and cookies must not be exposed through API errors or logs.

### Inventory and POS

- Batch stock remains authoritative under existing repository semantics.
- Aggregate inventory remains synchronized with valid batch stock.
- Stock must never become negative.
- FEFO/FIFO allocation behavior must not be weakened.
- POS/inventory mutations remain transactional where currently required.
- A server-health/error-handling change must not bypass stock invariant or concurrency protections.
- Failed multi-record sale/stock operations must not leave partial committed state.

### API compatibility

- Existing endpoint paths must not be renamed or removed silently.
- Existing response shape `{ success, message, data/meta/error }` must not be broken accidentally.
- Existing application error codes must not be renamed casually when clients or tests may depend on them.
- HTTP status changes require explicit contract tests and compatibility review.
- Guest storefront checkout behavior must remain available unless separately approved.

### Error and health safety

- Unexpected failures must remain client-safe and must not expose stack traces or secrets.
- Health responses must not disclose credentials or raw sensitive configuration.
- A dependency failure must never be mislabeled as fully healthy after the readiness contract is introduced.
- Liveness must answer process availability; readiness must answer ability to serve critical application traffic.
- Optional subsystem failure should not automatically disable unrelated healthy critical paths unless architecture requires it.

### Change safety

- Each implementation phase begins from inspected current behavior.
- Behavior changes use TDD: failing regression test first, then minimal implementation.
- Bugs use root-cause investigation before fixes.
- Security-sensitive changes receive exact-diff security review where supported.
- Completion claims require fresh exact-head verification evidence.
- Critical/Important review findings block progression until resolved or explicitly accepted by the user.
- No Sprint 8 merge to `main` occurs without explicit human approval after manual acceptance testing.

## HTTP baseline observed before Sprint 8 implementation

- `200` — successful reads, login, updates and normal operations.
- `201` — created resources, registrations, orders and POS sales.
- `400` — invalid request/query/input.
- `401` — missing, invalid or expired authentication/session.
- `403` — authenticated caller lacks required permission.
- `404` — missing route/resource/product/inventory.
- `409` — duplicates, state conflicts, inventory invariant conflicts.
- `413` — oversized upload.
- `422` — validly-shaped request rejected by business/domain rule.
- `429` — authentication throttling, including `Retry-After`.
- `500` — unexpected server failure.

Status codes such as 101, 502 and 504 are not Sprint 8 requirements unless a later approved architecture introduces a real protocol/upstream condition that requires them.

## Phase 0 allowed changes

Allowed:

- Sprint 8 branch creation;
- Sprint 8 documentation and baseline records;
- read-only repository inspection.

Not allowed in Phase 0:

- server middleware behavior changes;
- route changes;
- health response changes;
- frontend health behavior changes;
- database/schema changes;
- dependency changes;
- deployment changes.

## Phase 0 exit gate

Phase 0 is ready to close only when:

- the Sprint 8 branch is isolated from Sprint 7;
- the base revision is recorded;
- the current health/error foundation and gaps are recorded;
- server invariants are explicit;
- later phases have a defined safety boundary;
- no production behavior changed during Phase 0.

After this gate, stop and review Phase 0 before beginning Phase 1.
