# Customer Social Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade Google and Facebook authentication for CUSTOMER accounts across browser and packaged Electron while preserving existing password/recovery auth and OWNER/STAFF isolation.

**Architecture:** Keep OAuth backend-owned. Persist provider identities separately from `CustomerAccount`, reuse existing customer sessions, require ownership proof for email collisions, and use a one-use verifier-bound handoff for packaged Electron. Provider secrets stay server-side and live-provider credentials are never required by automated tests.

**Tech Stack:** TypeScript, Express, Prisma/MySQL, Node `crypto`, native `fetch`, React, Electron, Node test runner, existing auth-rate-limit/security middleware.

**Spec:** `docs/superpowers/specs/2026-08-29-customer-social-auth-design.md`

## Global Constraints

- Work only on `m1/v0.9/feat/customer-social-auth` until explicit promotion approval.
- CUSTOMER auth remains cookie/session based and isolated from OWNER/STAFF bearer authentication.
- Continue with Google and Continue with Facebook only; phone OTP remains Phase 7.
- Real provider client secrets never enter source control, frontend `VITE_*`, Electron bundle, logs, test fixtures, or chat.
- Password login, username/email/PH-mobile identifiers, Forgot Password, and email-OTP recovery must remain functional.
- A matching email must never silently take over or duplicate an existing customer account.
- Automated tests must not call live Google/Facebook endpoints.
- Browser and packaged Electron are both production targets.

---

### Task 1: RED — Social-auth persistence and password-compatibility contracts

**Files:**
- Create: `backend/test/customer-social-auth.test.ts`
- Create: `backend/test/customer-social-auth-concurrency.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Tests expect Prisma models `customerSocialIdentity`, `customerOAuthTransaction`, `customerSocialLinkIntent`, and `customerOAuthHandoff`.
- Tests expect `resolveCustomerSocialIdentity`, `completeCustomerSocialLink`, `createCustomerOAuthHandoff`, and `redeemCustomerOAuthHandoff` from `backend/src/services/customerSocialAuthService.ts`.
- Existing `loginCustomer` must accept a social-only customer with `passwordHash = null` and still emit generic invalid credentials.

- [ ] Add a failing test proving `CustomerAccount.passwordHash` may be null for a social-only customer.
- [ ] Add a failing test proving password login for that social-only customer returns `INVALID_CUSTOMER_CREDENTIALS`, identical to wrong-password/missing-account behavior.
- [ ] Add failing service tests for new Google/Facebook customer creation, returning provider identity, email collision requiring link proof, inactive customer rejection, provider-link conflict, and successful authenticated link completion.
- [ ] Add a failing concurrency test that runs two simultaneous first-login resolutions for the same provider subject and asserts one customer plus one provider identity.
- [ ] Add the new tests to the backend test command.
- [ ] Run the focused tests and verify RED for missing schema/service behavior before production changes.

### Task 2: GREEN — Prisma schema, migration, nullable-password compatibility

**Files:**
- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260829150000_customer_social_auth/migration.sql`
- Modify: `backend/src/services/customerAuthService.ts`

**Interfaces:**
- `CustomerSocialProvider = GOOGLE | FACEBOOK`
- `CustomerOAuthTransport = WEB | ELECTRON`
- `CustomerAccount.passwordHash: string | null`

- [ ] Add the provider/transport enums and four social-auth persistence models from the spec, with exact unique indexes, expiry indexes, cascade relations, and hashed-token fields.
- [ ] Make only customer `password_hash` nullable; internal `User.passwordHash` remains required.
- [ ] Add a matching additive MySQL migration.
- [ ] Change `loginCustomer` so null password hashes execute the existing dummy-password verification path and return the same generic credential error.
- [ ] Keep password upgrade behavior unchanged for non-null hashes.
- [ ] Run Prisma generate/validate plus Task 1 tests until GREEN.

### Task 3: RED/GREEN — OAuth transaction crypto and provider adapters

**Files:**
- Create: `backend/test/customer-social-oauth-crypto.test.ts`
- Create: `backend/test/customer-social-provider.test.ts`
- Create: `backend/src/utils/customerSocialOAuthCrypto.ts`
- Create: `backend/src/services/customerSocialProviderService.ts`
- Modify: `backend/src/config/env.ts`
- Modify: `.env.example`

**Interfaces:**
- `createOAuthStateMaterial()` returns raw state plus SHA-256 hash.
- `createPkceMaterial()` returns verifier plus S256 challenge.
- `protectOAuthSecret()` / `unprotectOAuthSecret()` use `CUSTOMER_OAUTH_TRANSACTION_KEY`.
- `CustomerSocialProviderClient.exchangeAndVerify(input)` returns `{ provider, subject, name, email, emailVerified }`.

- [ ] Write failing crypto tests for state hashing, PKCE S256, encryption round-trip, tamper rejection, and fixed lifetimes.
- [ ] Write failing provider-adapter tests using injected `fetch`/JWKS fixtures for Google issuer/audience/nonce/email verification and Facebook App-ID/token validation plus missing-email behavior.
- [ ] Add optional validated env fields for Google/Facebook credentials, public backend URL, OAuth transaction key, and Facebook graph version.
- [ ] Implement crypto helpers with Node `crypto`, using authenticated encryption for recoverable transaction secrets and hashes for state/handoff/link-intent raw values.
- [ ] Implement Google authorization URL, token exchange, and ID-token verification against issuer/audience/expiry/nonce/JWKS.
- [ ] Implement Facebook authorization URL, code exchange, access-token app validation, minimal profile fetch, and immediate token discard.
- [ ] Provider start must fail closed with `SOCIAL_AUTH_PROVIDER_UNAVAILABLE` if required credentials are absent.
- [ ] Run focused crypto/provider tests until GREEN.

### Task 4: RED/GREEN — Social identity resolution, linking, replay safety

**Files:**
- Create: `backend/src/services/customerSocialAuthService.ts`
- Create: `backend/src/utils/customerSocialAuthCookie.ts`
- Extend: `backend/test/customer-social-auth.test.ts`
- Extend: `backend/test/customer-social-auth-concurrency.test.ts`

**Interfaces:**
- `resolveCustomerSocialIdentity(identity, now?)` returns either `{ kind: "authenticated", customer, session }` or `{ kind: "link-required", linkIntentToken }`.
- `completeCustomerSocialLink(customerId, rawIntentToken, now?)` attaches the pending identity exactly once.
- `createCustomerOAuthHandoff(customerId, verifierChallenge, now?)` returns raw one-use code plus expiry.
- `redeemCustomerOAuthHandoff(code, verifier, now?)` returns a customer session once.

- [ ] Verify existing provider subject always resolves to the same active customer.
- [ ] For a new verified/usable email with no customer, transactionally create social-only customer plus provider identity.
- [ ] For an existing customer email, create a short-lived hashed link intent and return link-required without creating a duplicate customer.
- [ ] Require the authenticated customer id to match the intended customer before link completion.
- [ ] Convert Prisma uniqueness races to deterministic retry/resolution outcomes.
- [ ] Add single-use conditional updates for link intents and handoffs.
- [ ] Verify two simultaneous first-login and two simultaneous link attempts cannot produce duplicates or double success.
- [ ] Run Task 1/4 service and concurrency tests until GREEN.

### Task 5: RED/GREEN — HTTP OAuth start/callback/link/Electron contracts

**Files:**
- Create: `backend/test/customer-social-auth-http.test.ts`
- Create: `backend/src/controllers/customerSocialAuthController.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/src/security/security.constants.ts`
- Modify: `backend/src/middleware/customerAuthSecurity.ts` only if a focused helper is needed.

**Interfaces:**
- `GET /api/customer-auth/social/:provider/start?returnTo=/login`
- `GET /api/customer-auth/social/:provider/callback`
- `POST /api/customer-auth/social/link/complete`
- `POST /api/customer-auth/social/electron/start`
- `POST /api/customer-auth/social/electron/redeem`

- [ ] Write failing HTTP tests for provider allow-listing, sanitized redirects, state mismatch, expired/replayed transaction, cancel/provider error, link-required, successful web cookie creation, inactive customer, missing email, and no sensitive values in JSON/redirects.
- [ ] Write failing HTTP tests for Electron start/redeem, wrong verifier, expiry, and replay.
- [ ] Add social-specific IP rate limits and apply existing no-cache middleware.
- [ ] Start endpoint creates transaction + HttpOnly binding cookie and redirects to provider.
- [ ] Callback verifies state/binding/transaction/provider result, consumes transaction, then either sets existing customer cookie or creates link intent.
- [ ] Link completion requires `requireCustomerAuth` plus one-use link intent.
- [ ] Electron start accepts only provider and verifier challenge plus optional existing customer session; it returns an authorization URL but no secret/token.
- [ ] Electron redeem returns customer session material only to the Electron direct backend call after one-use verifier validation.
- [ ] Keep all routes strictly under `/api/customer-auth`; never issue internal bearer tokens.
- [ ] Run HTTP/security boundary tests until GREEN.

### Task 6: RED/GREEN — Customer login/register social UI

**Files:**
- Create: `frontend/src/components/customer/CustomerSocialAuthButtons.tsx`
- Modify: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Modify: `frontend/src/pages/customer/CustomerRegisterPage.tsx`
- Modify: `frontend/src/styles/customer-auth-quick-sign.css`
- Modify: `frontend/src/services/customerAuthService.ts`
- Modify: `frontend/src/types/customerAuth.ts`
- Create: `scripts/test/customer-social-auth-ui.test.mjs`

**Interfaces:**
- `beginCustomerSocialAuth(provider: "google" | "facebook", returnTo?: string): void | Promise<void>`
- Browser uses a top-level navigation to the backend start URL.
- Electron uses the preload social-auth bridge.

- [ ] Write a failing source-contract test proving Login and Register render both Google/Facebook actions and the Coming Soon Quick Sign placeholder is gone.
- [ ] Add accessible provider buttons with official provider names, loading/disabled state, and current Ysabelle premium styling.
- [ ] On browser, navigate to backend OAuth start endpoint using `resolveApiUrl`/runtime base rather than provider URLs in React.
- [ ] Parse sanitized social-auth result query state on return and surface controlled messages.
- [ ] Preserve existing password login/register, Forgot Password, and current auth redirects unchanged.
- [ ] Run focused UI test, frontend typecheck, and frontend build until GREEN.

### Task 7: RED/GREEN — Packaged Electron system-browser and deep-link handoff

**Files:**
- Create: `electron/src/main/customerSocialAuth.ts`
- Create: `electron/src/types/customerSocialAuth.ts`
- Modify: `electron/src/main/main.ts`
- Modify: `electron/src/main/window.ts` only if the auth module needs the main window reference.
- Modify: `electron/src/ipc/channels.ts`
- Modify: `electron/src/preload/api.ts`
- Modify: `frontend/src/types/window.d.ts`
- Modify: `electron/src/config/app.ts`
- Modify: `electron/.env.example`
- Modify: `electron/electron-builder.config.cjs`
- Create: `scripts/test/customer-social-auth-electron.test.mjs`

**Interfaces:**
- Preload exposes `socialAuth.start(provider)` and `socialAuth.onResult(listener)` only.
- Main opens provider URL using `shell.openExternal`.
- Custom protocol: `ysabellestore://auth/callback?code=<opaque>`.

- [ ] Write a failing source-contract test for protocol registration, narrow IPC channels, system-browser launch, one-use verifier handling, and absence of provider/client secrets in preload/frontend.
- [ ] Register `ysabellestore` protocol in electron-builder and app lifecycle, including Windows second-instance/deep-link handling.
- [ ] Implement Electron main start: generate private verifier, send challenge to backend, hold verifier only in main memory, open returned authorization URL externally.
- [ ] Implement deep-link callback parsing with strict scheme/host/path validation; accept only one opaque code.
- [ ] Redeem code + verifier directly from main to backend, then write `ysabelle_customer_session` into Electron cookie store as HttpOnly with production-appropriate secure/SameSite attributes.
- [ ] Emit only sanitized success/failure to renderer and clear pending verifier material on completion/timeout.
- [ ] Keep context isolation, sandbox, nodeIntegration false, and webSecurity true.
- [ ] Run Electron source-contract test, typecheck, and build until GREEN.

### Task 8: Regression, security, configuration, and acceptance verification

**Files:**
- Modify documentation only where configuration/runbook updates are factually required.

- [ ] Run Prisma validate/generate and disposable DB schema application.
- [ ] Run all new social-auth service/concurrency/provider/HTTP/UI/Electron tests.
- [ ] Run existing customer auth, auth-security, customer-account-security, recovery OTP, password-recovery, recovery concurrency, and auth boundary tests.
- [ ] Run root format check, lint, typecheck, guardrails, all workspace tests, builds, production dependency audit, version check, and status verification.
- [ ] Scan the diff for client secrets, provider access tokens, raw OAuth state, handoff codes, session tokens, or unsafe logging.
- [ ] Verify only CUSTOMER auth uses the new OAuth routes; `/api/auth` behavior remains unchanged.
- [ ] Verify existing username/email/mobile + password login and recovery still pass.
- [ ] Confirm exact final Phase 6 branch SHA and compare against the Phase 5 base.
- [ ] Do not create/merge a Phase 6 PR or promote into Sprint 9 until explicit user approval.
- [ ] Provide live manual QA steps for Google Cloud Console and Meta App configuration without asking the user to paste secrets into chat.