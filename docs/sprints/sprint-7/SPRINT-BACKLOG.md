# Sprint 7 Backlog

## Phase 1 — Customer authentication backend

- [x] Define and approve the customer authentication architecture.
- [x] Add dedicated `CustomerAccount` and `CustomerSession` persistence.
- [x] Add optional customer ownership to storefront orders.
- [x] Add customer registration/login validators.
- [x] Implement customer registration, login, finite opaque sessions, session restore, and revocation.
- [ ] Add customer-auth middleware and secure HttpOnly cookie handling.
- [ ] Add `/api/customer-auth/register`, `/login`, `/me`, and `/logout` routes.
- [ ] Enable credentialed CORS without wildcard origins.
- [ ] Add HTTP integration tests for session cookies and auth lifecycle.
- [ ] Add privilege-boundary tests proving customer sessions cannot access OWNER/STAFF APIs.
- [ ] Complete Phase 1 verification: Prisma, targeted tests, backend typecheck/build, and relevant regression tests.

## Phase 2 — Customer authentication UI

- [ ] Add frontend customer-auth test harness.
- [ ] Add `CustomerAuthProvider` without localStorage customer tokens.
- [ ] Add Sign In and Create Account experiences.
- [ ] Add authenticated customer header/account state.
- [ ] Add loading, validation, error, logout, and session-expired states.
- [ ] Preserve guest storefront behavior.

## Phase 3 — Account-linked checkout and order history

- [ ] Prefill checkout from the signed-in customer while keeping fields editable.
- [ ] Link new orders to the authenticated customer server-side.
- [ ] Add authenticated order history.
- [ ] Prove horizontal/IDOR isolation between customer accounts.
- [ ] Preserve guest checkout and avoid automatic historical guest-order claiming.

## Phase 4 — Hardening and final verification

- [ ] Harden internal auth error behavior and token typing.
- [ ] Add real login/register rate limiting.
- [ ] Enforce trusted-device expiration.
- [ ] Run full repository verification and security diff review.
- [ ] Remove temporary validation helpers/workflows that are no longer needed.
- [ ] Update sprint validation documentation and close remaining blockers.
