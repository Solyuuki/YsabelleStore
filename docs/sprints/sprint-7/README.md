# Sprint 7 — Authentication and Account Readiness

Sprint 7 focuses on finalizing authentication for YsabelleStore while preserving the existing guest storefront and the strict separation between public customer accounts and internal OWNER/STAFF access.

## Active branch

`sprint/v0.7/sprint-7`

## Primary workstream

- Complete the dedicated customer account persistence model.
- Implement secure customer registration, login, session restore, and logout.
- Add the customer-auth HTTP boundary with HttpOnly cookie sessions.
- Prove customer sessions cannot authorize internal OWNER/STAFF routes and internal credentials cannot be treated as customer sessions.
- Preserve guest shopping and guest checkout.
- Add customer-facing authentication UI only after the backend boundary is verified.

## Current status

Phase 1 is in progress. Customer persistence, migration, validators, and the customer authentication service are implemented and under CI validation. The HTTP middleware/controllers/routes and final isolation tests remain before Phase 2 begins.

## Governance

The required Sprint 7 documentation in this folder is the active source of truth for sprint-level scope and ownership. Implementation details for the customer authentication work are additionally documented in `docs/superpowers/specs/2026-08-22-customer-authentication-design.md` and `docs/superpowers/plans/2026-08-22-customer-authentication.md`.
