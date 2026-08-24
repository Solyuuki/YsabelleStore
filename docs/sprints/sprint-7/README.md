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

PR #12 remains the Sprint 7 review lane to `main`. PR #13 belongs to Sprint 8 and is intentionally excluded from the Sprint 6 → Sprint 7 integration work.

## Current Sprint 6 → Sprint 7 integration state

The accepted Sprint 6 history has been materialized on the dedicated Sprint 7 integration lane, PR #17 (`m1/v0.7/fix/sprint6-sprint7-integration` → `sprint/v0.7/sprint-7`). The six known merge conflicts were resolved while preserving both the accepted Sprint 6 storefront/catalog/image behavior and the Sprint 7 authentication/security behavior.

The combined integration tree completed fresh full code verification with a disposable MySQL database. The verified checks included Prisma validation/generation, typecheck, lint, formatting, guardrail regression tests, repository-context tests, frontend workspace authentication contracts, 135 backend tests, 34 catalog-image-engine Python tests, production build, production dependency audit, version consistency, and the aggregate `npm run verify:code` gate.

The generated Sprint 7 implementation and sprint-status evidence was refreshed through the repository's own artifact/sprint update tooling. Temporary materialization, diagnostic, and evidence-refresh workflows are not part of the intended final Sprint 7 tree.

The remaining integration action is promotion of the verified PR #17 result into `sprint/v0.7/sprint-7`, followed by fresh exact-head automated verification on the resulting Sprint 7 branch. Manual acceptance remains a separate human gate and is not implied by automated verification.

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

Green automated checks do not replace user manual acceptance. Sprint 7 must not be merged to `main` without an explicit final user merge decision.

## Latest Sprint Activity

| Date       | Member     | Branch                                  | Latest Activity                                                                                                  | Validation Status |
| ---------- | ---------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| 2026-08-24 | M1 Abarado | m1/v0.7/fix/sprint6-sprint7-integration | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed            |
