# Sprint 8 Phase 1 — HTTP & Error Contract Evidence

## Scope

Phase 1 establishes a canonical set of HTTP status codes for YsabelleStore server behavior. It intentionally does not change endpoint behavior, application error codes, health semantics, authentication behavior, inventory logic, or frontend handling.

## Canonical contract

The approved canonical HTTP statuses for Sprint 8 are:

- `200 OK` — successful reads and normal successful operations.
- `201 Created` — successful resource, order, registration, or sale creation.
- `400 Bad Request` — invalid request shape, query, or input.
- `401 Unauthorized` — missing, invalid, or expired authentication/session.
- `403 Forbidden` — authenticated caller lacks required permission.
- `404 Not Found` — missing route or resource.
- `409 Conflict` — duplicate, concurrent, invariant, or state-transition conflict.
- `413 Payload Too Large` — oversized request/upload.
- `415 Unsupported Media Type` — unsupported content or upload media type when a route requires that distinction.
- `422 Unprocessable Content` — syntactically valid request rejected by a business/domain rule.
- `429 Too Many Requests` — throttling/rate-limit response.
- `500 Internal Server Error` — unexpected application failure.
- `503 Service Unavailable` — critical dependency/readiness failure when Phase 2 introduces readiness semantics.

`101`, `502`, and `504` are deliberately outside the canonical contract until an approved architecture introduces a real protocol-switch, upstream gateway, or upstream-timeout condition that requires them.

## TDD evidence

### RED

The HTTP contract regression test was added before the production contract module. The backend suite then failed on commit:

`0e9a3ffbf7e0cdc3d766cbdc9f6ef66765798cc4`

Observed failure:

`Cannot find module '../src/constants/httpStatusContract.js'`

This confirmed that the new test exercised behavior/code that did not yet exist.

### Minimal GREEN implementation

The minimal implementation introduced `backend/src/constants/httpStatusContract.ts` with:

- the canonical symbolic status names;
- the approved numeric status values; and
- `isCanonicalHttpStatusCode()` for contract validation.

No controllers, middleware, routes, authentication behavior, inventory behavior, or frontend behavior were changed to adopt these constants during Phase 1.

## Guardrail transition evidence

The first Sprint 8 CI attempt exposed a legitimate repository precondition failure: the branch declared Sprint 8 while `config/guardrails.json` still declared active Sprint 7.

The guardrail was not bypassed or weakened. Instead, Sprint 8 required documentation was added and `activeSprint` was advanced to `8`. Subsequent CI reported:

- branch: `sprint/v0.8/sprint-8`
- member: `sprint-integration`
- activeSprint: `8`
- sprintDir: `docs/sprints/sprint-8`
- guardrail preconditions: PASS

## Formatting diagnostic evidence

CI later isolated a Prettier mismatch in `backend/test/http-status-contract.test.ts`. Rather than weakening formatting checks, temporary diagnostic instrumentation ran the repository's installed Prettier and printed the exact formatter diff. That exact output was applied, and all temporary diagnostic workflow/CI instrumentation was then removed.

## Verification evidence before final documentation commit

On head `585b84319cf24d5c5f714ba7117f3f5bc559a06f`, the normal CI repository quality gate passed all of the following:

- Prisma generation and schema validation;
- disposable MySQL schema setup;
- guardrail preconditions;
- formatting;
- lint;
- typecheck;
- guardrail regression tests;
- workspace tests, including the new HTTP contract test;
- full repository build;
- production dependency reachability audit;
- version consistency; and
- committed sprint/artifact status verification.

Frontend, backend, and Electron workspace validation jobs also passed. Pull Request Checks and Repository Governance were green on the same head.

Because this evidence document changes the branch head, Phase 1 still requires one final exact-head CI/governance/PR-check verification after this documentation is committed.

## Compatibility statement

Phase 1 does not intentionally change any live API response, endpoint path, authentication boundary, customer session behavior, POS/inventory transaction rule, application error code, or frontend system-health behavior. It creates the contract that later Sprint 8 phases must adopt through separate test-first changes.

## Phase boundary

Phase 2 must not begin until the final Phase 1 documentation head is freshly verified and Phase 1 is explicitly closed.
