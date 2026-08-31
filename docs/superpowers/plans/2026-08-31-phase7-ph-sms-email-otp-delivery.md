# Phase 7 Philippine SMS and Email OTP Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Phase 7 deployment-ready by keeping Resend for email OTP and adding real Semaphore SMS OTP delivery for Philippine mobile numbers only.

**Architecture:** YsabelleStore remains the source of truth for OTP generation, hashing, expiry, replay protection, rate limiting, and session creation. A focused Semaphore adapter handles outbound SMS only, while existing Resend email delivery remains unchanged except for verification coverage. Provider credentials stay backend-only and tests inject fake transports so CI never calls external providers.

**Tech Stack:** Node.js 22, TypeScript, Express, Prisma, React, Resend HTTP API, Semaphore OTP API.

**Spec:** `docs/superpowers/specs/2026-08-31-phase7-ph-sms-email-otp-delivery-design.md`

## Global Constraints

- Accept Philippine mobile numbers only and preserve normalization to `+639XXXXXXXXX`.
- Never expose or log OTP values, provider API keys, session tokens, or raw provider responses.
- Preserve generic anti-enumeration responses for email/mobile request endpoints.
- Preserve existing 10-minute OTP expiry, one-time use, failed-attempt protection, remembered-account behavior, and customer session boundaries.
- Real secrets remain outside source control.
- Test code must not perform real Resend or Semaphore network calls.

---

### Task 1: Add Semaphore environment contract and provider adapter

**Files:**
- Modify: `backend/src/config/env.ts`
- Create: `backend/src/services/customerMobileSmsDeliveryService.ts`
- Test: `backend/src/services/customerMobileSmsDeliveryService.test.ts` or the repository's established auth test script equivalent

**Interfaces:**
- Consumes: normalized PH mobile number and caller-generated six-digit OTP.
- Produces: `sendCustomerMobileVerificationSms(input: { phone: string; verificationCode: string }): Promise<void>` and `CustomerMobileSmsDeliveryError`.

- [ ] **Step 1: Write the failing provider-contract tests**

Assert that the adapter:

```ts
await sendCustomerMobileVerificationSms({
  phone: "+639171234567",
  verificationCode: "123456"
});
```

sends `POST https://api.semaphore.co/api/v4/otp` with form fields containing:

```text
apikey=<server-only key>
number=639171234567
message=Ysabelle Store code: {otp}. Expires in 10 minutes. Do not share this code.
code=123456
sendername=<configured sender when present>
```

Also assert that non-2xx/malformed provider responses throw `CustomerMobileSmsDeliveryError`, and neither API key nor OTP appears in thrown public messages or logs.

- [ ] **Step 2: Run the targeted test and confirm RED**

Run the repository's targeted backend auth test command for the new file/script. Expected failure: adapter/env variables do not exist yet.

- [ ] **Step 3: Add backend environment variables**

Extend `backend/src/config/env.ts` with optional non-empty server-only values:

```ts
SEMAPHORE_API_KEY: optionalNonEmptyString,
SEMAPHORE_SENDER_NAME: optionalNonEmptyString,
```

Do not add any `VITE_*` equivalents.

- [ ] **Step 4: Implement the minimal Semaphore adapter**

Create `customerMobileSmsDeliveryService.ts` with:

```ts
const SEMAPHORE_OTP_ENDPOINT = "https://api.semaphore.co/api/v4/otp";

export class CustomerMobileSmsDeliveryError extends Error {
  constructor() {
    super("Customer mobile verification SMS delivery failed.");
    this.name = "CustomerMobileSmsDeliveryError";
  }
}

export async function sendCustomerMobileVerificationSms(input: {
  phone: string;
  verificationCode: string;
}): Promise<void> {
  // Require SEMAPHORE_API_KEY.
  // Convert +639XXXXXXXXX -> 639XXXXXXXXX for provider transport.
  // POST URLSearchParams to Semaphore OTP endpoint.
  // Include optional sendername only when configured.
  // Throw sanitized CustomerMobileSmsDeliveryError on any transport/provider failure.
}
```

The message must remain exactly:

```text
Ysabelle Store code: {otp}. Expires in 10 minutes. Do not share this code.
```

- [ ] **Step 5: Run targeted tests and confirm GREEN**

Expected: provider contract, provider failure, secret-redaction, and optional-sender tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/config/env.ts backend/src/services/customerMobileSmsDeliveryService.ts <new-test-file>
git commit -m "feat(auth): add Semaphore mobile OTP delivery"
```

---

### Task 2: Wire real SMS delivery into mobile registration

**Files:**
- Modify: `backend/src/services/customerMobileRegistrationService.ts`
- Modify/Test: existing mobile registration auth test coverage

**Interfaces:**
- Consumes: `sendCustomerMobileVerificationSms` from Task 1.
- Produces: mobile-registration OTP request that creates a challenge only when a real provider delivery succeeds, except test-injected fake transports.

- [ ] **Step 1: Write failing registration-delivery tests**

Cover:

```text
new PH number -> one delivery call
existing customer phone -> zero delivery calls
delivery failure -> active challenge removed
second request inside cooldown -> zero additional delivery calls
```

- [ ] **Step 2: Run targeted tests and confirm RED**

Expected failures: current development transport logs OTP, and registration lacks the required provider-backed production path/cooldown parity.

- [ ] **Step 3: Replace terminal OTP transport**

In `customerMobileRegistrationService.ts`, remove the development branch that logs `verificationCode`. Default delivery becomes the real Semaphore adapter. Keep dependency injection so tests can pass a fake delivery function.

- [ ] **Step 4: Preserve undelivered-challenge cleanup**

Keep the existing pattern:

```ts
try {
  await delivery({ phone: input.phone, verificationCode: otp.verificationCode });
} catch (error) {
  await prisma.customerMobileRegistrationChallenge.deleteMany({
    where: { id: otp.challengeId, consumedAt: null }
  });
  throw error;
}
```

- [ ] **Step 5: Add 30-second registration resend cooldown**

Mirror the login/email behavior by finding the newest active registration-mobile challenge and returning before generating/sending another code when it was created less than 30 seconds ago.

- [ ] **Step 6: Run registration tests and confirm GREEN**

Expected: new-number delivery, existing-number anti-enumeration, provider failure cleanup, expiry, replay, and resend cooldown all pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/customerMobileRegistrationService.ts <affected-tests>
git commit -m "fix(auth): deliver registration mobile OTP by SMS"
```

---

### Task 3: Wire real SMS delivery into mobile Quick Sign login

**Files:**
- Modify: `backend/src/services/customerMobileAuthService.ts`
- Modify/Test: existing customer mobile auth tests

**Interfaces:**
- Consumes: `sendCustomerMobileVerificationSms`.
- Produces: verified-mobile login OTP over real SMS, preserving generic request responses and customer-session creation after verification only.

- [ ] **Step 1: Write failing login-delivery tests**

Cover:

```text
active + verified phone -> one SMS delivery
unknown phone -> zero delivery
inactive customer -> zero delivery
unverified customer phone -> zero delivery
provider failure -> challenge removed
within 30-second cooldown -> zero additional SMS
correct verification -> customer session created
wrong/expired/replayed code -> no session
```

- [ ] **Step 2: Run targeted tests and confirm RED**

Expected failure: current default delivery only logs OTP in development.

- [ ] **Step 3: Replace development logger with Semaphore delivery**

Set the default delivery transport to Task 1's adapter. Preserve injected fake delivery for tests and preserve existing challenge/session logic.

- [ ] **Step 4: Run login mobile tests and confirm GREEN**

Expected: delivery, anti-enumeration, cooldown, failed-attempt, session, expiry, and replay coverage pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/customerMobileAuthService.ts <affected-tests>
git commit -m "fix(auth): deliver mobile quick sign OTP by SMS"
```

---

### Task 4: Verify and harden email OTP delivery paths

**Files:**
- Modify only if tests reveal a defect: `backend/src/services/customerIdentityEmailDeliveryService.ts`
- Modify only if tests reveal a defect: `backend/src/services/customerEmailRegistrationService.ts`
- Modify only if tests reveal a defect: email auth service/controller files
- Test: existing email registration/auth test coverage

**Interfaces:**
- Consumes: existing Resend delivery service.
- Produces: proven registration and login email OTP behavior without weakening anti-enumeration.

- [ ] **Step 1: Add failing/explicit contract tests where coverage is missing**

Prove:

```text
new registration email -> Resend delivery invoked
existing registration email -> no delivery + generic success
eligible login email -> Resend delivery invoked
unknown/inactive/ineligible login email -> no delivery + generic success
delivery failure -> no usable challenge remains
```

- [ ] **Step 2: Run targeted email tests**

If all tests already pass, do not change production email code. If a real defect appears, implement only the minimal fix required by the failing test.

- [ ] **Step 3: Re-run targeted email tests and confirm GREEN**

- [ ] **Step 4: Commit only if code/tests changed**

```bash
git add <affected-email-files>
git commit -m "test(auth): verify customer email OTP delivery"
```

---

### Task 5: Preserve controller anti-enumeration and sanitized provider failure handling

**Files:**
- Modify if required: `backend/src/controllers/customerAuthController.ts`
- Modify if required: `backend/src/controllers/customerEmailVerificationController.ts`
- Test: controller/integration auth tests

**Interfaces:**
- Consumes: sanitized delivery errors from Semaphore and Resend services.
- Produces: unchanged generic request responses with safe internal logging.

- [ ] **Step 1: Add controller tests**

Assert that provider delivery failure never changes public account-existence semantics and never returns provider raw body, OTP, API key, or internal account id.

- [ ] **Step 2: Run tests and confirm current behavior**

- [ ] **Step 3: If needed, update mobile controller error handling**

Catch `CustomerMobileSmsDeliveryError` through the existing mobile delivery error boundary or map it to the existing sanitized mobile delivery event without exposing the provider error.

- [ ] **Step 4: Re-run and confirm GREEN**

- [ ] **Step 5: Commit if changed**

```bash
git add backend/src/controllers/customerAuthController.ts backend/src/controllers/customerEmailVerificationController.ts <affected-tests>
git commit -m "fix(auth): preserve OTP delivery privacy boundaries"
```

---

### Task 6: Configuration and deployment documentation

**Files:**
- Modify: `.env.example` if present
- Modify: relevant deployment/auth documentation already used by Sprint 9

**Interfaces:**
- Produces: deployment operator contract for Resend + Semaphore without secrets.

- [ ] **Step 1: Document server-only configuration**

Add placeholders only:

```env
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=YSABELLE
```

Keep existing:

```env
RESEND_API_KEY=
CUSTOMER_RECOVERY_FROM_EMAIL=
```

- [ ] **Step 2: Document live-provider prerequisites**

State that production requires a funded Semaphore account, approved sender name, Resend production sender/domain, and secret-store configuration.

- [ ] **Step 3: Confirm no real secrets are committed**

Search tracked changes for `SEMAPHORE_API_KEY=` with a non-empty value and for known local secret material. Expected: none.

- [ ] **Step 4: Commit**

```bash
git add .env.example <deployment-docs>
git commit -m "docs(auth): document OTP provider configuration"
```

---

### Task 7: Tier 3 auth/security verification

**Files:**
- No production changes unless a verification failure is caused by this implementation.

- [ ] **Step 1: Run targeted mobile/email auth tests**

Run the exact repository scripts covering customer mobile registration, mobile Quick Sign, email registration/auth, remembered accounts, recovery, and auth UI contracts.

Expected: all targeted tests pass.

- [ ] **Step 2: Run backend build/typecheck**

Expected: success.

- [ ] **Step 3: Run frontend auth tests/build**

Expected: success; provider delivery changes must not alter the current Login/Register UI contract.

- [ ] **Step 4: Run full repository auth/security-required verification**

Use the repo's required full validation/pre-push command. If an unrelated pre-existing formatting or repository gate fails, record the exact failing step separately; do not claim full green.

- [ ] **Step 5: Verify exact branch head and diff**

Confirm only Phase 7 SMS/email delivery, tests, environment contract, and documentation changed. Do not merge.

- [ ] **Step 6: Prepare manual live QA checklist**

Require controlled tests for:

```text
new email registration OTP
new PH mobile registration SMS OTP
email Quick Sign
mobile Quick Sign
resend cooldown
wrong code
expired code
replay
existing registration email/mobile anti-enumeration
unknown login email/mobile anti-enumeration
logout + remembered account behavior
```

- [ ] **Step 7: Final implementation commit if verification-driven fixes were needed**

```bash
git add <verification-fix-files>
git commit -m "test(auth): verify Phase 7 OTP delivery readiness"
```
