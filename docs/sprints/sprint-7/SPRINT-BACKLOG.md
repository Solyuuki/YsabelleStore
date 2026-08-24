# Sprint 7 Backlog

## Phase 1 — Customer authentication backend

- [x] Define and approve the customer authentication architecture.
- [x] Add dedicated `CustomerAccount` and `CustomerSession` persistence.
- [x] Add optional customer ownership to storefront orders.
- [x] Add customer registration/login validators.
- [x] Implement customer registration, login, finite opaque sessions, session restore, and revocation.
- [x] Add customer-auth middleware and secure HttpOnly cookie handling.
- [x] Add `/api/customer-auth/register`, `/login`, `/me`, and `/logout` routes.
- [x] Enable credentialed CORS without wildcard origins.
- [x] Add HTTP integration tests for session cookies and auth lifecycle.
- [x] Add privilege-boundary tests proving customer sessions cannot access OWNER/STAFF APIs.
- [x] Complete Phase 1 verification: Prisma, targeted tests, backend typecheck/build, and relevant regression tests.

## Phase 2 — Customer authentication UI

- [x] Add frontend customer-auth test harness.
- [x] Add `CustomerAuthProvider` without localStorage customer tokens.
- [x] Add Sign In and Create Account experiences.
- [x] Add authenticated customer header/account state.
- [x] Add loading, validation, error, logout, and session-expired states.
- [x] Preserve guest storefront behavior.

## Phase 3 — Account-linked checkout and order history

- [x] Prefill checkout from the signed-in customer while keeping fields editable.
- [x] Link new orders to the authenticated customer server-side.
- [x] Add authenticated order history.
- [x] Prove horizontal/IDOR isolation between customer accounts.
- [x] Preserve guest checkout and avoid automatic historical guest-order claiming.
- [x] Add stale-session regression coverage proving guest-capable checkout remains safe.

## Phase 4 — Hardening and final verification

- [x] Harden internal auth error behavior and token typing.
- [x] Add real login/register rate limiting.
- [x] Enforce trusted-device expiration.
- [x] Strip internal bearer credentials from storefront/customer requests.
- [x] Run full repository verification and focused security diff review.
- [x] Remove temporary validation helpers/workflows that are no longer needed.
- [x] Complete permanent exact-head workflow verification on the implementation cleanup head.

## Pre-integration completion gate

- [x] Audit repository for separate `v0.7` branches or additional Sprint 7 PR workstreams; none remain outside `sprint/v0.7/sprint-7` / PR #12.
- [x] Reconcile Sprint 7 backlog and status documentation with delivered Phase 1–4 behavior.
- [ ] Confirm exact-head automated checks are green after documentation reconciliation.
- [ ] Confirm no known Sprint 7 bug/error remains unresolved.
- [ ] Receive explicit user authorization to integrate accepted Sprint 6 into Sprint 7.

## Post-integration completion gate

- [ ] Merge accepted Sprint 6 into Sprint 7 with conflict resolution that preserves both Sprint 6 and Sprint 7 behavior.
- [ ] Run fresh Tier 3/full repository regression verification on the combined branch.
- [ ] Re-run focused auth/security and Sprint 6 storefront/catalog regressions.
- [ ] Complete manual acceptance of the combined Sprint 7 branch.
- [ ] Receive explicit final user approval before any final merge/promotion decision.

## Sprint Activity Log

| Date       | Member     | Work Item                                                                                                        | Status | Evidence                                                                                                                                                                                                                                                               |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-24 | M1 Abarado | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed | .github/workflows/sprint-7-artifact-refresh-temp.yml<br>.gitignore<br>.prettierignore<br>.prettierrc.json<br>backend/package.json<br>backend/src/config/env.ts<br>backend/src/controllers/productImageController.ts<br>backend/src/controllers/storefrontController.ts |
