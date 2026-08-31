# Customer Remembered Quick Sign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a max-3 Known Accounts experience for customer Email/Mobile Quick Sign with 30-day trusted browser login, expired-card OTP renewal, and Forget support.

**Architecture:** Add a customer-specific remembered-browser credential model separate from OWNER/STAFF trusted devices. Store only a hash of an opaque HttpOnly browser token, bind remembered rows to that browser token and one customer, and store the remembered method plus absolute 30-day trust expiry. Existing Email/Mobile auth OTP services remain the only reverification mechanisms after trust expiry.

**Tech Stack:** TypeScript, Express, Prisma/MySQL, React, Vite, existing customer session cookies, Node crypto, existing Email/Mobile OTP services.

**Spec:** `docs/superpowers/specs/2026-08-31-customer-remembered-quick-sign-design.md`

## Global Constraints

- Maximum 3 remembered customer accounts per browser; no pagination.
- Same customer occupies one slot even if remembered through Email and Mobile at different times.
- 30-day trust is absolute and is not extended by ordinary Continue.
- Expired remembered cards remain visible and require purpose-correct Email or Mobile OTP to renew.
- Forget deletes only the remembered row and frees a slot.
- Browser trust secret is HttpOnly and hashed at rest; frontend receives only safe display data.
- Existing customer sessions remain separate from remembered trust.
- Password reset expires remembered trust without deleting remembered cards.
- Registration labels remove `OTP`; Google gets matching helper copy.
- Google OAuth does not create remembered trust in this phase.

---

### Task 1: Persist customer remembered browser trust

**Files:**
- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260831190000_customer_remembered_quick_sign/migration.sql`
- Create: `backend/test/customer-remembered-auth.test.ts`

**Interfaces:**
- Produces `CustomerRememberedAuth` Prisma model with `browserTokenHash`, `customerAccountId`, `authMethod`, `trustedUntil`, `lastUsedAt`, `createdAt`, `updatedAt`.
- Unique key: `(browserTokenHash, customerAccountId)`.

- [ ] **Step 1: Write failing persistence test**

Assert `prisma.customerRememberedAuth` exists and can address the expected fields.

- [ ] **Step 2: Run targeted backend test and confirm RED**

Run the repository backend test command for `customer-remembered-auth.test.ts`; expected failure is missing Prisma model.

- [ ] **Step 3: Add Prisma enum/model and migration**

Add `CustomerRememberedAuthMethod { EMAIL MOBILE }`, relation from `CustomerAccount`, unique browser/customer key, indexes for browser hash, expiry, and customer id.

- [ ] **Step 4: Generate/validate Prisma and rerun targeted test**

Expected: PASS.

- [ ] **Step 5: Commit**

Commit: `feat(auth): persist remembered customer trust`

---

### Task 2: Add remembered-browser token and backend trust service

**Files:**
- Create: `backend/src/utils/customerRememberedAuthCookie.ts`
- Create: `backend/src/services/customerRememberedAuthService.ts`
- Modify: `backend/test/customer-remembered-auth.test.ts`

**Interfaces:**
- `readCustomerRememberedBrowserCookie(request): string | undefined`
- `setCustomerRememberedBrowserCookie(response, token): void`
- `ensureCustomerRememberedBrowserToken(request, response): { token: string; tokenHash: string }`
- `listCustomerRememberedAccounts(tokenHash, now): Promise<CustomerRememberedAccount[]>`
- `rememberCustomerAccount({ tokenHash, customerAccountId, method, now }): Promise<{ remembered: boolean; slotLimitReached: boolean }>`
- `continueRememberedCustomer({ tokenHash, rememberedAccountId, now }): Promise<CustomerSessionResult | verificationRequired>`
- `forgetRememberedCustomer({ tokenHash, rememberedAccountId }): Promise<void>`
- `expireRememberedTrustForCustomer(customerAccountId, now): Promise<void>`

- [ ] **Step 1: Write failing service behavior tests**

Cover: max three distinct customers, upsert existing customer at 3/3, absolute 30-day expiry, no silent extension on Continue, expired rows remain listed, Forget frees slot, wrong browser token cannot continue another browser's row.

- [ ] **Step 2: Confirm RED**

Expected: missing service/cookie implementation.

- [ ] **Step 3: Implement opaque browser token + hashed persistence**

Use 32 random bytes, SHA-256 hash, HttpOnly SameSite=Lax cookie, Secure in production. Cookie lifetime may exceed 30 days so expired cards remain visible; trust authorization always uses database `trustedUntil`.

- [ ] **Step 4: Implement listing, remember, continue, forget**

Listing returns masked email/mobile only. Valid Continue creates a fresh normal customer session and updates only `lastUsedAt`; never `trustedUntil`.

- [ ] **Step 5: Rerun tests and commit**

Commit: `feat(auth): add customer remembered browser trust`

---

### Task 3: Integrate remembered trust with Email/Mobile Quick Sign

**Files:**
- Modify: `backend/src/controllers/customerAuthController.ts`
- Modify: `backend/src/services/customerEmailAuthService.ts`
- Modify: `backend/src/services/customerMobileAuthService.ts`
- Modify: `backend/src/validators/customerAuth.validators.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/test/customer-email-auth.test.ts`
- Modify: `backend/test/customer-mobile-auth.test.ts`
- Modify: `backend/test/customer-remembered-auth.test.ts`

**Interfaces:**
- Email/Mobile verify payload accepts `rememberFor30Days?: boolean`.
- Successful OTP verification may call `rememberCustomerAccount` with the method used.
- Add endpoints:
  - `GET /api/customer-auth/remembered`
  - `POST /api/customer-auth/remembered/continue`
  - `POST /api/customer-auth/remembered/request`
  - `POST /api/customer-auth/remembered/verify`
  - `DELETE /api/customer-auth/remembered/:id`

- [ ] **Step 1: Write failing integration tests**

Cover successful remember opt-in, 3/3 slot behavior not breaking login, valid remembered Continue without OTP, expired Continue requiring verification, request/verify using the row's method, and successful OTP renewing exactly 30 days.

- [ ] **Step 2: Confirm RED**

Expected: endpoint/validator behavior missing.

- [ ] **Step 3: Add remember opt-in to Email/Mobile verification handlers**

Always complete authentication first. Remember creation/renewal is secondary; slot-limit failure returns authentication success with safe metadata indicating the account was not newly remembered.

- [ ] **Step 4: Add remembered endpoints**

Expired `request` resolves the current verified identity server-side and starts the existing Email Auth or Mobile Auth OTP challenge. `verify` delegates to the matching existing verification service, renews the remembered row, and sets the normal session cookie.

- [ ] **Step 5: Rerun targeted backend tests and commit**

Commit: `feat(auth): integrate remembered quick sign`

---

### Task 4: Expire remembered trust on password reset

**Files:**
- Modify: `backend/src/services/customerPasswordRecoveryService.ts`
- Modify: `backend/test/customer-password-recovery.test.ts`
- Modify: `backend/test/customer-remembered-auth.test.ts`

**Interfaces:**
- Successful password reset calls `expireRememberedTrustForCustomer(customerAccountId, now)`.
- Rows remain present; `trustedUntil` becomes expired.

- [ ] **Step 1: Write failing reset regression test**

Create a remembered row, reset password, assert row still exists but no longer permits OTP-free Continue.

- [ ] **Step 2: Confirm RED**

Expected: reset currently only revokes sessions/tokens.

- [ ] **Step 3: Add remembered-trust expiry to the successful reset transaction/path**

Do not delete the remembered row.

- [ ] **Step 4: Rerun recovery + remembered tests and commit**

Commit: `fix(auth): expire remembered trust after password reset`

---

### Task 5: Add Known Accounts frontend API and state

**Files:**
- Modify: `frontend/src/services/customerAuthService.ts`
- Create: `frontend/src/components/customer/CustomerKnownAccounts.tsx`
- Modify: `scripts/customer-auth-ui-contract-test.ts`

**Interfaces:**
- `getCustomerRememberedAccounts()`
- `continueCustomerRememberedAccount(id)`
- `requestCustomerRememberedVerification(id)`
- `verifyCustomerRememberedVerification({ id, verificationCode })`
- `forgetCustomerRememberedAccount(id)`

- [ ] **Step 1: Extend UI contract test first**

Require Known Accounts component and safe remembered API paths; no raw browser token handling in frontend source.

- [ ] **Step 2: Confirm RED**

Expected: missing component/functions.

- [ ] **Step 3: Implement service calls and Known Accounts cards**

Render up to 3 cards, trusted/expired states, Continue, Forget, and Use another account.

- [ ] **Step 4: Rerun UI contract/build and commit**

Commit: `feat(auth): add known customer accounts ui`

---

### Task 6: Wire Known Accounts and 30-day remember controls into Login

**Files:**
- Modify: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Modify: `frontend/src/components/customer/CustomerEmailAuthPanel.tsx`
- Modify: `frontend/src/components/customer/CustomerMobileAuthPanel.tsx`
- Modify: `frontend/src/services/customerAuthService.ts`
- Modify: `frontend/src/styles/customer-auth-quick-sign.css`
- Modify: `scripts/customer-auth-ui-contract-test.ts`

**Interfaces:**
- Email/Mobile OTP verify calls accept `rememberFor30Days`.
- Login loads Known Accounts on mount.
- Valid remembered Continue refreshes session and navigates to account.
- Expired remembered Continue opens compact remembered OTP verification UI for the remembered method.

- [ ] **Step 1: Add failing UI contract assertions**

Require `Remember this account for 30 days`, Known Accounts on Login, expired verification state, and Forget action.

- [ ] **Step 2: Confirm RED**

Expected: current Login lacks remembered account state.

- [ ] **Step 3: Add remember checkbox to Email/Mobile auth panels**

Default unchecked. Pass the boolean to verification API.

- [ ] **Step 4: Wire Login Known Accounts lifecycle**

Load list, handle Continue, handle verification-required state, refresh list after successful renew/Forget.

- [ ] **Step 5: Build frontend/UI contract and commit**

Commit: `feat(auth): wire remembered quick sign login`

---

### Task 7: Clean registration Quick Sign copy

**Files:**
- Modify: `frontend/src/components/customer/CustomerSocialAuthButtons.tsx`
- Modify: `frontend/src/pages/customer/CustomerRegisterPage.tsx`
- Modify: `scripts/customer-auth-ui-contract-test.ts`

**Interfaces:**
- Register labels:
  - `Continue with Google` + helper `Use your Google account for faster sign-up and sign-in.`
  - `Verify Email Address` + helper `Verify the required email for your new account.`
  - `Verify Mobile Number` + helper `Verify an optional PH mobile number.`
- Login retains Email OTP/Mobile OTP wording.

- [ ] **Step 1: Add failing copy assertions**

Assert Register source no longer renders `Continue with Email OTP` or `Continue with Mobile OTP`.

- [ ] **Step 2: Confirm RED**

Expected: current shared component uses login-oriented labels.

- [ ] **Step 3: Add configurable action labels/helper copy and wire Register values**

Keep Login defaults unchanged.

- [ ] **Step 4: Build/UI contract and commit**

Commit: `style(auth): clarify registration verification actions`

---

### Task 8: QA-ready checkpoint and final verification

**Files:**
- Modify only files required by test/manual QA fixes.

- [ ] **Step 1: Run targeted backend auth tests, Prisma validation, frontend build, and auth UI contract**

Expected: green.

- [ ] **Step 2: Publish exact QA-ready SHA**

User pulls and tests Known Accounts, 30-day trust, expiry simulation, Forget, Email/Mobile OTP renew, and register copy.

- [ ] **Step 3: Fix manual QA regressions test-first**

Each reported bug gets a failing regression test before production correction.

- [ ] **Step 4: Run final Tier 3 repository verification once near completion**

Run format, lint, typecheck, guardrails, workspace tests/builds, audit, version consistency, and Sprint/artifact verification.
