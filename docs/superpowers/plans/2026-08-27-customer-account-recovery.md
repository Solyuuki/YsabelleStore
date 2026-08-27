# Customer Account Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade, email-based customer password recovery flow with premium YsabelleStore UI and high-risk auth/security verification.

**Architecture:** Extend the existing customer-auth subsystem with a dedicated reset-token persistence model, recovery service, Resend delivery adapter, guarded HTTP endpoints, and a public `/account-recovery` UI using the current `CustomerAuthFrame`. Recovery request responses remain enumeration-resistant; reset completion is transactional, single-use, concurrency-safe, and revokes all customer sessions.

**Tech Stack:** TypeScript, Express, Prisma/MySQL, Node `crypto`, native `fetch` for Resend HTTP API, React, existing CSS/auth frame, Node test runner, existing repository guardrails.

**Spec:** `docs/superpowers/specs/2026-08-27-customer-account-recovery-design.md`

## Global Constraints

- Work only on the Phase 4 lineage; do not merge into `sprint/v0.9/sprint-9`.
- Recovery accepts username, email, or Philippine mobile number.
- Public request response must never disclose whether an account exists or email delivery succeeded.
- Raw reset tokens must never be persisted, returned by the API, or logged.
- Reset-token lifetime is exactly 15 minutes.
- Successful reset revokes every existing customer session and does not auto-login.
- A reset token is single-use and two concurrent reset attempts may produce at most one success.
- Email provider is Resend via `RESEND_API_KEY`; secrets are never committed.
- UI must match the existing blue -> purple -> pink premium customer-auth palette and remain responsive/accessibility-safe.

---

### Task 1: RED — Recovery security contract tests

**Files:**

- Create: `backend/test/customer-password-recovery.test.ts`
- Create: `backend/test/customer-password-recovery-concurrency.test.ts`
- Modify: `backend/package.json`

**Interfaces:**

- Tests expect `requestCustomerPasswordRecovery`, `resetCustomerPassword`, `hashCustomerPasswordResetToken`, and injectable email delivery from `backend/src/services/customerPasswordRecoveryService.ts`.
- Tests expect Prisma model `customerPasswordResetToken`.

- [ ] Write service tests proving: identifier parity for username/email/mobile, generic missing/inactive outcome, hashed persistence, exact 15-minute expiry, prior-token invalidation, delivery-failure cleanup, password replacement, session revocation, single-use behavior, and generic invalid/expired/used error.
- [ ] Write concurrency test using two simultaneous reset calls against the same token and assert exactly one fulfills.
- [ ] Add both test files to the backend test script.
- [ ] Open/update a PR from `m1/v0.9/feat/customer-account-recovery` to `feature/sprint9-account-security` and run CI.
- [ ] Verify RED: CI/backend tests must fail because recovery model/service do not exist yet. Do not proceed unless failure is caused by the missing recovery feature rather than a typo or unrelated failure.

### Task 2: GREEN — Reset-token persistence and recovery service

**Files:**

- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260827040000_customer_password_recovery/migration.sql`
- Create: `backend/src/services/customerPasswordRecoveryService.ts`
- Modify: `backend/src/services/customerAuthService.ts` only if a small shared identity/session helper is needed; avoid unrelated refactor.

**Interfaces:**

- `hashCustomerPasswordResetToken(token: string): string`
- `requestCustomerPasswordRecovery(input: { identifier: string }, delivery: CustomerRecoveryEmailDelivery, now?: Date): Promise<void>`
- `resetCustomerPassword(input: { token: string; newPassword: string }, now?: Date): Promise<void>`
- `CustomerRecoveryEmailDelivery` exposes `sendPasswordRecoveryEmail(input: { to: string; recoveryUrl: string; expiresAt: Date }): Promise<void>`.

- [ ] Add `CustomerPasswordResetToken` relation to `CustomerAccount` with unique 64-char hash, expiry, nullable used timestamp, created timestamp, cascade relation, and indexes.
- [ ] Add SQL migration matching the Prisma model exactly.
- [ ] Implement token creation with `randomBytes(32).toString("base64url")`, SHA-256 storage, 15-minute expiry, and invalidation of older unused tokens.
- [ ] Resolve recovery identifiers through the existing `classifyCustomerLoginIdentifier` behavior.
- [ ] For missing/inactive account, return without disclosing lookup result.
- [ ] On delivery failure, delete/invalidate the newly created token and still let the controller return the generic public response.
- [ ] Implement transactional reset: validate unused/unexpired token, hash new password, conditionally consume token (`updateMany` count must equal 1), update password, invalidate sibling tokens, revoke all active sessions.
- [ ] Run Prisma generate/validate and targeted backend recovery tests until GREEN.

### Task 3: RED/GREEN — Resend adapter, validation, rate limits, and HTTP contract

**Files:**

- Create: `backend/src/services/customerRecoveryEmailService.ts`
- Modify: `backend/src/config/env.ts`
- Modify: `.env.example`
- Modify: `backend/src/security/security.constants.ts`
- Modify: `backend/src/validators/customerAuth.validators.ts`
- Modify: `backend/src/controllers/customerAuthController.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Create or extend: `backend/test/customer-auth-http.test.ts`

**Interfaces:**

- Env: `RESEND_API_KEY?: string`, `CUSTOMER_RECOVERY_FROM_EMAIL?: string`.
- Request schema: `{ identifier: string }`.
- Reset schema: `{ token: string; newPassword: string }`.
- Routes: `POST /api/customer-auth/recovery/request`, `POST /api/customer-auth/recovery/reset`.

- [ ] First add HTTP tests for generic request response, validation failures, allowed-origin enforcement, no-cache headers, recovery request rate limiting, private identity limiter keys, reset rate limiting, and generic reset-token error.
- [ ] Verify RED on the new route tests.
- [ ] Add optional recovery env fields so ordinary dev/test boot does not fail when email delivery is unused; the delivery adapter must throw only when a real eligible recovery request requires email but provider config is absent.
- [ ] Implement Resend adapter using native `fetch("https://api.resend.com/emails")` with Bearer auth, configured sender, branded HTML/text content, and no raw-token logging.
- [ ] Add recovery-specific rate-limit constants: request IP 10/15m, identifier 3/15m, reset IP 10/15m.
- [ ] Add request/reset validators.
- [ ] Add controller handlers with the exact generic public request message and generic invalid/expired reset error from the spec.
- [ ] Apply existing allowed-origin and sensitive-response no-cache middleware to both routes.
- [ ] Run HTTP/security tests until GREEN.

### Task 4: RED/GREEN — Premium customer recovery UI

**Files:**

- Create: `frontend/src/pages/customer/CustomerAccountRecoveryPage.tsx`
- Create: `frontend/src/styles/customer-auth-recovery.css`
- Modify: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Modify: `frontend/src/app/CustomerApp.tsx`
- Modify: `frontend/src/utils/customerRoutes.ts`
- Modify: `frontend/src/services/customerAuthService.ts`
- Create: `scripts/customer-account-recovery-frontend-test.ts`
- Modify root `package.json` only if required to expose the focused frontend contract script.

**Interfaces:**

- `requestCustomerPasswordRecovery(identifier: string): Promise<void>`
- `resetCustomerPassword(input: { token: string; newPassword: string }): Promise<void>`
- `CustomerAuthPageKind` adds `recovery`.

- [ ] Add frontend contract test first asserting login contains a recovery action, `/account-recovery` is routed and public, query token is handled, service endpoints are correct, and the page contains identify/check-email/reset/success states.
- [ ] Verify RED before creating the page.
- [ ] Add premium `Forgot password?` action beside the login password controls without disturbing existing Phase 3 composition.
- [ ] Implement `CustomerAccountRecoveryPage` with four states: identify account, check email, set new password when `token` query exists, and reset complete.
- [ ] Reuse `CustomerAuthFrame`; style with existing blue/purple/pink palette, glass surface, restrained shader/depth treatment, responsive layout, keyboard-safe fields, `aria-invalid`, `role=alert/status`, disabled/loading states.
- [ ] Keep recovery reachable even if a different customer session exists; authenticated redirect behavior remains limited to login/register.
- [ ] Run focused frontend contract test, frontend typecheck, and frontend build until GREEN.

### Task 5: Full high-risk verification and cleanup

**Files:**

- Update required Sprint 9/member implementation artifacts only through repository status tooling or factual evidence; do not fabricate passed commands.

- [ ] Run targeted recovery service, concurrency, HTTP, and frontend tests.
- [ ] Run `npm run prisma:validate` and `npm run prisma:generate`.
- [ ] Run format check, lint, typecheck, guardrail tests, repo-context tests, all workspace tests, catalog image regression, frontend/backend/electron builds, production dependency audit, version check, and status/artifact verification.
- [ ] Confirm no committed secret values and no raw recovery token appears in logs, fixtures, docs, or API responses.
- [ ] Confirm diff contains only account-recovery/Auth Phase 4 scope plus required migration/tests/status evidence.
- [ ] Confirm PR CI, Pull Request Checks, and Repository Governance are all green on the exact final head.
- [ ] Fast-forward `feature/sprint9-account-security` to the validated recovery head only after the exact recovery head is green. Do not merge into `sprint/v0.9/sprint-9`.
