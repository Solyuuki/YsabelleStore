# Sprint 7 Definition of Done

Sprint 7 work is considered complete only when all applicable conditions below are satisfied.

## Authentication correctness

- Customer accounts are separate from internal OWNER/STAFF users.
- Customer sessions are finite, revocable, server-tracked, and represented client-side only by an HttpOnly cookie.
- No raw customer session token is returned in JSON or stored in browser localStorage/sessionStorage.
- Unknown customer email and wrong password use the same public login failure response.
- Inactive, expired, revoked, and invalid sessions are rejected.
- Customer authentication cannot grant access to OWNER/STAFF APIs.
- Internal authentication cannot be treated as a customer session.

## Storefront compatibility

- Guest browsing remains available.
- Guest checkout remains available.
- Signed-in checkout may associate the order with the authenticated customer, but the server derives identity from the session rather than a client-supplied account ID.
- Historical guest orders are not automatically claimed.

## Quality and verification

- New behavior follows test-first development with observed RED then GREEN.
- Prisma schema validates and client generation succeeds.
- Relevant migrations are present and reviewed.
- Targeted customer-auth tests pass against an isolated test database.
- Backend typecheck and build pass.
- Relevant existing regression tests pass or any unrelated pre-existing failure is explicitly documented with evidence.
- Repository guardrail preconditions pass for Sprint 7.
- Security-sensitive changes receive a focused review before completion.

## Repository hygiene

- Changes are limited to Sprint 7 scope.
- Sprint 6 is not modified as part of Sprint 7 implementation except where historical documentation is read for reference.
- Sprint 7 documentation accurately reflects current scope, ownership, testing, and blockers.
- Temporary validation infrastructure is removed or intentionally documented before final completion.
