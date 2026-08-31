# Customer Verified Identity + Quick Sign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require verified customer email at registration, verify optional mobile when supplied, and reuse verified email/mobile identities for passwordless Quick Sign login.

**Architecture:** Keep five OTP purposes isolated: recovery email, registration email, email-auth, registration mobile, and mobile-auth. Persist verification timestamps on `CustomerAccount`; use dedicated registration-email and email-auth challenge tables; bind registration grants to the existing registration intent; require Quick Sign identity timestamps before issuing authentication OTPs. Reuse the existing Resend email transport with purpose-specific templates and the existing customer session creator after successful auth OTP verification.

**Tech Stack:** TypeScript, Express, Prisma/MySQL, React, Vite, Resend, Node crypto/HMAC, existing HttpOnly customer auth cookies and in-memory auth rate limiter.

**Spec:** `docs/superpowers/specs/2026-08-31-customer-verified-identity-quick-sign-design.md`

## Global Constraints

- Email is required and must be registration-OTP verified before account creation.
- Mobile remains optional; if present, it must be registration-OTP verified before account creation.
- Registration OTP grants never create sessions.
- Email/mobile authentication OTPs only create sessions for ACTIVE accounts whose corresponding identity verification timestamp is present.
- Recovery, registration, and authentication OTPs cannot cross purposes.
- Unknown/ineligible request endpoints stay enumeration-resistant.
- OTPs are six digits, HMAC/hashed at rest, short-lived, single-use, capped at five wrong attempts, and protected by resend cooldown and IP/private-identity rate limits.
- Existing password login remains available for legacy accounts even when verification timestamps are null.
- Legacy identities are never silently marked verified.
- Google provider evidence may mark the matching account email verified only when the provider reports a verified authoritative email during the successful social-auth transaction.
- Mobile delivery remains development-terminal only until a production SMS provider is configured; production fails closed.
- Manual QA may start on a functional QA-ready head; Tier 3 repository verification runs only near completion.

---

### Task 1: Persist verified identities and purpose-specific email OTP challenges

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260831090000_customer_verified_identity_quick_sign/migration.sql`
- Test: `backend/test/customer-email-registration.test.ts`
- Test: `backend/test/customer-email-auth.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Produces `CustomerAccount.emailVerifiedAt: DateTime?` and `CustomerAccount.phoneVerifiedAt: DateTime?`.
- Produces `CustomerEmailRegistrationChallenge` rows keyed by registration-intent hash + normalized email.
- Produces `CustomerEmailAuthChallenge` rows keyed by customer account + normalized email.

- [ ] **Step 1: Write failing persistence tests**

Add tests that assert the Prisma client exposes `emailVerifiedAt` / `phoneVerifiedAt`, and that dedicated registration-email and email-auth challenge rows can be created with `otpHash`, `expiresAt`, `consumedAt`, `failedAttempts`, and `createdAt`.

- [ ] **Step 2: Register the tests in `backend/package.json` and run backend tests to confirm RED**

Run: `npm test --prefix backend`

Expected: build/test failure because the new Prisma fields/models do not exist yet.

- [ ] **Step 3: Add schema models and migration**

Add nullable verification timestamps to `CustomerAccount`. Add two dedicated challenge models/tables with indexes on email/created time, expiry, consumed state, and customer/intent ownership. Do not reuse `CustomerPasswordResetToken` or mobile challenge rows.

- [ ] **Step 4: Generate/validate Prisma and rerun the targeted backend tests**

Run: `npm run prisma:generate && npm run prisma:validate && npm test --prefix backend`

Expected: persistence tests pass and existing auth tests remain green except for later intentionally-added behavioral tests.

- [ ] **Step 5: Commit**

Commit message: `feat(auth): persist verified customer identities`

---

### Task 2: Registration email OTP and verified-registration enforcement

**Files:**
- Create: `backend/src/services/customerEmailRegistrationService.ts`
- Create: `backend/src/services/customerIdentityEmailDeliveryService.ts`
- Create: `backend/src/utils/customerEmailRegistrationCookie.ts`
- Modify: `backend/src/controllers/customerAuthController.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/src/security/security.constants.ts`
- Modify: `backend/src/services/customerAuthService.ts`
- Modify: `backend/test/customer-email-registration.test.ts`
- Modify: `backend/test/customer-mobile-registration.test.ts`

**Interfaces:**
- Produces `requestCustomerEmailRegistrationVerification({ email, registrationIntentToken })`.
- Produces `verifyCustomerEmailRegistrationCode({ email, verificationCode, registrationIntentToken }) -> signed grant`.
- Produces endpoints `POST /api/customer-auth/registration/email/request` and `POST /api/customer-auth/registration/email/verify`.
- Registration controller requires a valid email grant for the exact normalized email and exact registration intent; optional mobile grant remains required when mobile is supplied.
- `registerCustomer` receives verification timestamps from the controller and persists them atomically with the account.

- [ ] **Step 1: Write failing registration-email behavior tests**

Cover privacy-safe request response, dedicated hashed intent-bound challenge, successful single-use verification grant, five wrong attempts locking the challenge, changed email rejected, missing email grant rejected, optional mobile still enforced, and successful account storing `emailVerifiedAt` plus `phoneVerifiedAt` when mobile was also verified.

- [ ] **Step 2: Run backend tests to confirm RED**

Run: `npm test --prefix backend`

Expected: failures on missing registration-email endpoints/service and verification timestamps.

- [ ] **Step 3: Implement registration-email OTP mechanics**

Use purpose namespace `customer-email-registration-otp:v1`; 10-minute lifetime; 30-second resend cooldown; single active challenge per intent+email; HMAC OTP; five wrong attempts; signed short-lived registration grant bound to registration intent hash + normalized email. Delivery uses Resend with a registration-specific subject/body and deletes the active challenge if delivery fails.

- [ ] **Step 4: Add request/verify rate limits**

Add 15-minute IP and HMAC-private normalized-email limits equivalent in strength to mobile OTP: request IP 30, request email 5, verify IP 50, verify email 10.

- [ ] **Step 5: Enforce both identity grants at `/register`**

Email is always required and must match its registration-email grant. Mobile is optional, but when supplied it must match its existing registration-mobile grant. Pass `emailVerifiedAt: now` and optional `phoneVerifiedAt: now` into account creation; clear both registration verification cookies after successful creation only.

- [ ] **Step 6: Run backend tests**

Run: `npm test --prefix backend`

Expected: registration-email + mobile-registration + existing customer-auth tests pass.

- [ ] **Step 7: Commit**

Commit message: `feat(auth): require verified identities at registration`

---

### Task 3: Email OTP Quick Sign and verified mobile Quick Sign eligibility

**Files:**
- Create: `backend/src/services/customerEmailAuthService.ts`
- Modify: `backend/src/services/customerIdentityEmailDeliveryService.ts`
- Modify: `backend/src/controllers/customerAuthController.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/src/security/security.constants.ts`
- Modify: `backend/src/services/customerMobileAuthService.ts`
- Modify: `backend/test/customer-email-auth.test.ts`
- Modify: `backend/test/customer-mobile-auth.test.ts`

**Interfaces:**
- Produces `requestCustomerEmailAuth({ email })` and `verifyCustomerEmailAuth({ email, verificationCode }) -> CustomerSessionResult`.
- Produces endpoints `POST /api/customer-auth/email/request` and `POST /api/customer-auth/email/verify`.
- Mobile-auth request/verify only operate when `phoneVerifiedAt` is non-null.
- Email-auth request/verify only operate when `emailVerifiedAt` is non-null.

- [ ] **Step 1: Write failing Quick Sign tests**

Cover generic request response for unknown/unverified/inactive email, no challenge/no delivery for ineligible identities, challenge+delivery for verified ACTIVE email, five wrong attempts, resend cooldown, old-code invalidation after resend, single-use verification, session creation, and recovery/registration challenge non-interchangeability. Add regression coverage proving legacy/null-`phoneVerifiedAt` accounts cannot Mobile Quick Sign while password login remains unaffected.

- [ ] **Step 2: Run backend tests to confirm RED**

Run: `npm test --prefix backend`

Expected: missing email Quick Sign endpoints and current mobile Quick Sign eligibility mismatch.

- [ ] **Step 3: Implement Email Quick Sign service**

Use namespace `customer-email-auth-otp:v1`, the same 10-minute/30-second/five-attempt mechanics, dedicated email-auth table, generic request semantics, Resend auth-specific message, and existing `createCustomerSession(customer.id)` after atomic challenge consumption.

- [ ] **Step 4: Enforce verified identity eligibility**

Require `emailVerifiedAt != null` for Email Quick Sign and `phoneVerifiedAt != null` for Mobile Quick Sign. Do not alter password login eligibility.

- [ ] **Step 5: Add request/verify rate limits and rerun backend tests**

Use request IP 30 / identity 5 and verify IP 50 / identity 10 for email auth, with private HMAC email keys.

Run: `npm test --prefix backend`

Expected: email/mobile Quick Sign tests and existing recovery/login tests pass.

- [ ] **Step 6: Commit**

Commit message: `feat(auth): add verified email quick sign`

---

### Task 4: Carry verified provider email evidence into customer accounts

**Files:**
- Modify: `backend/src/services/customerSocialAuthService.ts`
- Modify: `backend/test/customer-social-auth.test.ts`

**Interfaces:**
- Existing Google social-auth flow may set `emailVerifiedAt` for the exact customer email only when current provider input is verified and authoritative.
- Existing social linking semantics remain unchanged.

- [ ] **Step 1: Write failing social-auth verification-state tests**

Cover a new Google-created customer getting `emailVerifiedAt`, authoritative Google auto-link updating the matching account when null, and non-authoritative/link-required flows not silently verifying the account before ownership/link completion.

- [ ] **Step 2: Run the social-auth test to confirm RED**

Run: `npm test --prefix backend`

Expected: verification timestamp assertions fail.

- [ ] **Step 3: Implement minimal timestamp writes in existing social-auth transactions**

Only set the timestamp from current verified provider evidence for the exact normalized account email. Do not backfill unrelated historical accounts.

- [ ] **Step 4: Rerun backend tests and commit**

Commit message: `feat(auth): record verified google customer email`

---

### Task 5: Register UI for Email/Mobile verification Quick Sign

**Files:**
- Create: `frontend/src/components/customer/CustomerEmailRegistrationPanel.tsx`
- Modify: `frontend/src/components/customer/CustomerSocialAuthButtons.tsx`
- Modify: `frontend/src/pages/customer/CustomerRegisterPage.tsx`
- Modify: `frontend/src/services/customerAuthService.ts`
- Modify: `frontend/src/styles/customer-auth-quick-sign.css`
- Modify: `scripts/customer-auth-ui-contract-test.ts`

**Interfaces:**
- Adds `onEmailStart?: () => void` and configurable helper text to `CustomerSocialAuthButtons`.
- Adds registration API functions for email request/verify.
- Email registration panel mirrors the compact Mobile OTP panel interaction: identity -> code -> verify -> return verified identity to form.

- [ ] **Step 1: Extend the UI contract test first**

Require Register to render Google, Email OTP, and Mobile OTP quick actions; require `CustomerEmailRegistrationPanel`; require Email and Mobile verified-state handling; forbid inline Send-code buttons attached directly to normal form fields.

- [ ] **Step 2: Run the frontend UI contract to confirm RED**

Run the repository command that executes `scripts/customer-auth-ui-contract-test.ts`.

Expected: failure because Email OTP action/panel is missing.

- [ ] **Step 3: Implement frontend service calls and Email registration panel**

Add `/registration/email/request` and `/registration/email/verify` calls using the prepared registration intent. Use the same compact visual language as the mobile registration panel.

- [ ] **Step 4: Wire Register verified identity state**

Email input is required. Email or mobile Quick Sign opens its purpose-specific panel. Successful verification returns to the same form with the exact value prefilled/read-only and `Verified` shown. Changing a value clears only that identity's verified state. `Create Account` refuses when email is unverified or supplied mobile is unverified.

- [ ] **Step 5: Run frontend build/UI contract**

Run: `npm run build --prefix frontend` plus the customer-auth UI contract command.

Expected: frontend compiles and UI contract passes.

- [ ] **Step 6: Commit**

Commit message: `feat(auth): verify register email and mobile identities`

---

### Task 6: Login Email OTP Quick Sign UI

**Files:**
- Create: `frontend/src/components/customer/CustomerEmailAuthPanel.tsx`
- Modify: `frontend/src/components/customer/CustomerSocialAuthButtons.tsx`
- Modify: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Modify: `frontend/src/services/customerAuthService.ts`
- Modify: `scripts/customer-auth-ui-contract-test.ts`

**Interfaces:**
- Adds frontend API calls for `/email/request` and `/email/verify`.
- Successful email verification refreshes the normal customer session and navigates exactly like Mobile OTP Quick Sign.

- [ ] **Step 1: Add failing Login Quick Sign UI contract assertions**

Require Login to expose Google + Email OTP + Mobile OTP and render `CustomerEmailAuthPanel` when Email OTP is chosen.

- [ ] **Step 2: Run UI contract to confirm RED**

Expected: missing Email OTP login action/panel.

- [ ] **Step 3: Implement Email auth panel and Login wiring**

Mirror the current Mobile auth visual/interaction pattern: email input, Send code, 6-digit code, Verify, 30-second resend countdown, change email, other sign-in methods. Successful verification refreshes session and navigates to `/account`.

- [ ] **Step 4: Run frontend build/UI contract and commit**

Commit message: `feat(auth): add email otp quick sign ui`

---

### Task 7: QA-ready checkpoint and final Tier 3 verification

**Files:**
- Modify only files needed to fix issues found by tests/manual QA.

**Interfaces:**
- QA-ready head must support registration Email OTP, optional Mobile OTP, Email Quick Sign, Mobile Quick Sign, Google, and password login without purpose crossover.

- [ ] **Step 1: Run targeted auth/backend/frontend checks**

Run backend auth tests, frontend auth contract, frontend build, backend build/typecheck, and Prisma validation.

- [ ] **Step 2: Publish the exact QA-ready SHA to the user**

At this point the user pulls and manually QA-tests both registration and login. Do not wait for final Sprint evidence bookkeeping before allowing manual QA.

- [ ] **Step 3: Fix any manual QA defects with TDD regression coverage**

Each reported bug gets a failing regression test before production-code correction.

- [ ] **Step 4: Run final Tier 3 repository verification once near completion**

Run the repository-required format, lint, typecheck, guardrail, workspace tests, builds, security audit, version consistency, and committed Sprint/artifact verification. Report code-gate success separately if Sprint evidence is still intentionally WIP.

- [ ] **Step 5: Recheck all ten spec acceptance criteria**

Do not call Phase 7 complete if production SMS remains unresolved or any acceptance criterion is still open.
