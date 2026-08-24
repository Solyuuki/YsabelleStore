# Sprint 7 — Authentication and Account Readiness

Sprint 7 finalizes authentication for YsabelleStore while preserving guest storefront access and strict separation between public customer accounts and internal OWNER/STAFF access.

## Active branch

`sprint/v0.7/sprint-7`

## Delivered scope

- Dedicated `CustomerAccount` and `CustomerSession` persistence.
- Secure customer registration, login, session restore, logout, and finite HttpOnly-cookie sessions.
- Customer/internal authentication isolation across backend and frontend boundaries.
- Customer-facing Sign In, Create Account, Account, and order-history experiences.
- Guest browsing and guest checkout preserved.
- Authenticated checkout ownership derived server-side from the customer session.
- Customer order-history isolation.
- Internal JWT token typing and generic invalid-credential behavior.
- Finite trusted-device expiration.
- Route-level login/register throttling.
- Frontend stripping of internal bearer credentials from storefront/customer requests.
- Permanent regression coverage for stale customer sessions, auth isolation, trusted-device expiry, throttling, and internal-bearer scoping.

## Verification status

Sprint 7 implementation through Phase 4 was fully verified on cleanup head `0866eb7acfc9ffaa8ee8f1b3a8d7abbe06cc1842`.

On that implementation head, the following permanent workflows completed successfully:

- CI
- Sprint 7 Validation
- Repository Governance
- Pull Request Checks

Dedicated Tier 3 verification was also completed before removal of the temporary Phase 4 verification workflow. It covered Prisma generation/validation, isolated-database backend auth tests, frontend auth-boundary contracts, backend/frontend workspace tests, formatting, lint, typecheck, full build, dependency audit, guardrail tests, `verify:code`, and `prepush:local -- --member m1`.

A repository audit found no separate `v0.7` side branch or additional Sprint 7 pull request that still needs integration. PR #12 is the Sprint 7 review lane. PR #13 belongs to Sprint 8 and is intentionally excluded.

## Current pre-integration state

Sprint 7 implementation is complete on its own verified baseline, but final Sprint 7 acceptance is not yet complete because the accepted Sprint 6 branch has advanced since Sprint 7 was created.

Before Sprint 6 is merged into Sprint 7:

1. Sprint 7 documentation must accurately reflect the delivered Phase 1–4 state.
2. The latest Sprint 7 head after documentation reconciliation must pass its exact-head automated checks.
3. No known Sprint 7 defect may remain open.
4. The user must explicitly authorize Sprint 6 → Sprint 7 integration.

After Sprint 6 is integrated, the combined Sprint 7 branch must undergo fresh Tier 3/full regression verification and manual acceptance before any final merge decision.

## Manual acceptance focus after integration

- customer registration, login, session restore, and logout;
- guest browsing and guest checkout;
- signed-in checkout linking orders to the correct customer server-side;
- customer order history showing only the signed-in customer's orders;
- stale/expired customer sessions falling back safely on guest-capable flows;
- customer sessions being unable to authorize internal OWNER/STAFF APIs;
- internal OWNER/STAFF credentials not becoming customer identity;
- internal bearer credentials not being sent to storefront/customer endpoints;
- generic invalid-credential behavior for internal login;
- trusted-device expiration behavior;
- authentication throttling under repeated attempts without blocking normal use;
- Sprint 6 storefront/catalog/image behavior remaining intact after integration.

## Governance

The Sprint 7 documents in this folder are the sprint-level source of truth for scope, ownership, verification state, and remaining acceptance work. Implementation details are additionally documented in `docs/superpowers/specs/2026-08-22-customer-authentication-design.md` and `docs/superpowers/plans/2026-08-22-customer-authentication.md`.

Green automated checks do not replace user manual acceptance. Sprint 7 must not be merged without an explicit final user merge decision.
