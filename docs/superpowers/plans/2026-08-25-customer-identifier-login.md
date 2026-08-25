# Customer Identifier Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade customer password authentication so new customers register with a username and can sign in using username, email, or a canonical Philippine mobile number without weakening Phase 1 privacy/security controls or breaking legacy email-only accounts.

**Architecture:** Add nullable unique `username` and `phoneNormalized` fields to `CustomerAccount`, centralize customer identity normalization/classification in a focused backend utility, keep new-registration requirements stricter than legacy persistence nullability, and resolve one login `identifier` deterministically to exactly one identity class. Preserve generic auth failures, HMAC-private rate limiting, customer session behavior, and complete isolation from the internal OWNER/STAFF auth realm.

**Tech Stack:** TypeScript, Node.js >=20.11.0, Express, Zod, Prisma 6/MySQL, React/Vite, Node test runner, tsx.

**Spec:** `docs/superpowers/specs/2026-08-25-customer-identifier-login-design.md`

## Global Constraints

- Philippine mobile login only; canonical form is `+639XXXXXXXXX`.
- New registrations require username; legacy accounts may keep `username = null`.
- Username: 3-30 chars, lowercase/case-insensitive, `a-z 0-9 _ .`, begins alphanumeric, not all digits, no `@`, `+`, whitespace, or other punctuation.
- Reserved usernames: `admin`, `owner`, `staff`, `support`, `ysabelle`, `ysabellestore`.
- Email remains required and unique.
- Mobile remains optional, but canonical mobile login identity is unique when present.
- Exact invalid-login response remains `401 / INVALID_CUSTOMER_CREDENTIALS / Invalid credentials.`.
- Duplicate username/email/mobile registration remains `409 / CUSTOMER_ACCOUNT_CONFLICT / Unable to create customer account with the supplied details.`.
- Never expose `phoneNormalized`, password hashes, session-token hashes, raw session tokens, or raw limiter keys.
- Preserve Phase 1 registration intent, Origin enforcement, no-cache headers, scrypt behavior, session cookie/token lifecycle, and metadata-only logging.
- Do not modify Staff/Owner `/api/auth/*`, trusted-device behavior, roles, or `/staff-login` behavior.
- Do not implement Phase 3/4 visual redesign, OAuth, OTP, verification, shipping addresses, or cross-tab logout synchronization.

---

## File Structure

**Create**
- `backend/src/utils/customerIdentity.ts` — canonical username/email/PH-mobile normalization and deterministic login identifier classification.
- `backend/test/customer-auth-identifier.test.ts` — focused registration/login/legacy/privacy contract tests for Phase 2.
- `backend/test/customer-identity.test.ts` — pure normalization/classification unit tests.
- `backend/src/scripts/backfillCustomerMobileIdentities.ts` — metadata-only dry-run/apply legacy phone backfill.
- `backend/test/customer-mobile-backfill.test.ts` — deterministic unique/duplicate/invalid legacy-phone backfill tests.
- `database/prisma/migrations/20260825230000_customer_identifier_login/migration.sql` — additive nullable fields/indexes only.
- `scripts/test/customer-auth-identifier-client.test.mjs` — source-contract guard for frontend identifier/username wiring and confirm-password non-transmission.

**Modify**
- `database/prisma/schema.prisma` — add nullable unique `username` and `phoneNormalized`.
- `backend/src/validators/customerAuth.validators.ts` — registration username/PH phone rules and login `identifier` contract.
- `backend/src/services/customerAuthService.ts` — uniqueness checks, identifier lookup, safe customer username, canonical mobile persistence.
- `backend/src/routes/customerAuth.routes.ts` — identifier-aware HMAC limiter keys and independent registration identity keys.
- `backend/src/security/security.constants.ts` — only if separate username/email/mobile registration limiter scopes require explicit constants; preserve thresholds.
- `frontend/src/types/customerAuth.ts` — `username: string | null`, login `identifier`, registration `username`.
- `frontend/src/utils/customerAuthForms.ts` — functional username/PH-mobile validation and generic nonempty login identifier validation.
- `frontend/src/services/customerAuthService.ts` — submit updated request contracts without confirm password.
- `frontend/src/context/CustomerAuthContext.tsx` — updated input types only; session mechanics unchanged.
- `frontend/src/pages/customer/CustomerLoginPage.tsx` — one identifier field.
- `frontend/src/pages/customer/CustomerRegisterPage.tsx` — username and confirm-password functional fields; preserve intent prewarm.
- Existing backend auth tests — update fixture/request shapes only where required by the intentional contract change; do not weaken assertions.
- `package.json` — add dry-run/apply customer mobile identity backfill scripts.

---

### Task 1: Customer Identity Normalization and Classification

**Files:**
- Create: `backend/src/utils/customerIdentity.ts`
- Create: `backend/test/customer-identity.test.ts`

**Interfaces:**
- Produces: `normalizeCustomerUsername(value: string): string | null`
- Produces: `normalizeCustomerEmail(value: string): string | null`
- Produces: `normalizePhilippineMobile(value: string): string | null`
- Produces: `classifyCustomerLoginIdentifier(value: string): { kind: "email" | "phone" | "username"; normalized: string } | null`
- Produces: `isReservedCustomerUsername(value: string): boolean`

- [ ] **Step 1: Write failing pure unit tests**

Cover at minimum:

```ts
assert.equal(normalizePhilippineMobile("09171234567"), "+639171234567");
assert.equal(normalizePhilippineMobile("639171234567"), "+639171234567");
assert.equal(normalizePhilippineMobile("+639171234567"), "+639171234567");
assert.equal(normalizePhilippineMobile("0917 123 4567"), "+639171234567");
assert.equal(normalizePhilippineMobile("0917-123-4567"), "+639171234567");
assert.equal(normalizePhilippineMobile("(+63) 917 123 4567"), "+639171234567");
assert.equal(normalizePhilippineMobile("+14155552671"), null);
assert.equal(normalizeCustomerUsername("Maria.Santos"), "maria.santos");
assert.equal(normalizeCustomerUsername("09171234567"), null);
assert.equal(normalizeCustomerUsername("maria@gmail.com"), null);
assert.equal(normalizeCustomerUsername("admin"), null);
assert.deepEqual(classifyCustomerLoginIdentifier("Maria@Example.COM"), {
  kind: "email",
  normalized: "maria@example.com"
});
assert.deepEqual(classifyCustomerLoginIdentifier("09171234567"), {
  kind: "phone",
  normalized: "+639171234567"
});
assert.deepEqual(classifyCustomerLoginIdentifier("Maria.Santos"), {
  kind: "username",
  normalized: "maria.santos"
});
```

Also prove an email-looking value never becomes username and a malformed foreign phone never becomes an accepted PH mobile identity.

- [ ] **Step 2: Run RED**

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-identity.test.ts
```

Expected: FAIL because `customerIdentity.ts`/exports do not exist.

- [ ] **Step 3: Implement the minimal identity utility**

Use one canonical implementation for username, email, and PH mobile normalization. Strip only approved phone presentation characters before structural validation; do not silently accept arbitrary punctuation or international formats.

Identifier classification order must be exactly:

```ts
if (trimmed.includes("@")) return normalizedEmailOrNull;
if (looksLikePhoneCandidate(trimmed)) return normalizedPhilippinePhoneOrNull;
return normalizedUsernameOrNull;
```

Class-specific invalid input returns `null`; there is no cross-class fallback after selection.

- [ ] **Step 4: Run GREEN**

Run the Task 1 test command again. Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/customerIdentity.ts backend/test/customer-identity.test.ts
git commit -m "feat(auth): add customer identifier normalization"
```

---

### Task 2: Additive Prisma Identity Migration and Safe Legacy Mobile Backfill

**Files:**
- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260825230000_customer_identifier_login/migration.sql`
- Create: `backend/src/scripts/backfillCustomerMobileIdentities.ts`
- Create: `backend/test/customer-mobile-backfill.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `normalizePhilippineMobile()` from Task 1.
- Produces schema fields: `CustomerAccount.username: string | null`, `CustomerAccount.phoneNormalized: string | null`.
- Produces script commands: `npm run customer-mobile-identities:audit` and `npm run customer-mobile-identities:apply`.

- [ ] **Step 1: Write failing backfill tests before schema/script implementation**

Test a pure planning helper exported by the script module so DB mutation logic is testable without printing PII. Given rows such as:

```ts
[
  { id: "a", phone: "09171234567" },
  { id: "b", phone: "09981234567" },
  { id: "c", phone: "+63 917 123 4567" },
  { id: "d", phone: "not-a-phone" },
  { id: "e", phone: null }
]
```

prove that `a` and `c` are both marked duplicate/ambiguous for `+639171234567` and neither receives an update; `b` receives `+639981234567`; invalid/null rows receive no update; summary contains only counts and IDs needed internally, never raw phone strings in user-facing log output.

- [ ] **Step 2: Run RED**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-mobile-backfill.test.ts
```

Expected: FAIL because the backfill module does not exist.

- [ ] **Step 3: Add Prisma fields and additive SQL migration**

Schema shape:

```prisma
username        String? @unique(map: "uq_customer_accounts_username") @db.VarChar(30)
phoneNormalized String? @unique(map: "uq_customer_accounts_phone_normalized") @map("phone_normalized") @db.VarChar(16)
```

Migration SQL must only add nullable columns first. Because pre-existing duplicates are possible, do not populate `phone_normalized` in raw SQL. The unique index may be added safely while all existing values are null; the controlled script then fills only unique canonical values.

- [ ] **Step 4: Implement dry-run/apply backfill**

Default invocation audits only. `--apply` performs only planned unique updates. Console output is metadata-only, for example:

```text
Customer mobile identity backfill
scanned=5 valid_unique=1 duplicate=2 invalid=1 empty=1
mode=dry-run
```

Do not print email, username, raw phone, canonical phone, password/session data.

- [ ] **Step 5: Add package scripts**

```json
"customer-mobile-identities:audit": "tsx backend/src/scripts/backfillCustomerMobileIdentities.ts",
"customer-mobile-identities:apply": "tsx backend/src/scripts/backfillCustomerMobileIdentities.ts --apply"
```

- [ ] **Step 6: Run GREEN and schema validation**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-mobile-backfill.test.ts
npm run prisma:validate
npm run prisma:generate
```

Expected: test pass, Prisma schema valid, client generated.

- [ ] **Step 7: Commit**

```bash
git add database/prisma/schema.prisma database/prisma/migrations/20260825230000_customer_identifier_login/migration.sql backend/src/scripts/backfillCustomerMobileIdentities.ts backend/test/customer-mobile-backfill.test.ts package.json
git commit -m "feat(auth): add customer login identities"
```

---

### Task 3: Backend Registration and Multi-Identifier Login Contract

**Files:**
- Create: `backend/test/customer-auth-identifier.test.ts`
- Modify: `backend/src/validators/customerAuth.validators.ts`
- Modify: `backend/src/services/customerAuthService.ts`
- Modify existing customer-auth tests only for intentional request/response shape changes.

**Interfaces:**
- Consumes Task 1 normalizers/classifier and Task 2 Prisma fields.
- Produces `CustomerLoginInput = { identifier: string; password: string }`.
- Produces registration input containing required `username` and optional `phone`.
- Produces `SafeCustomer.username: string | null`.

- [ ] **Step 1: Write focused failing integration/service tests**

Test all of the following before implementation:

```text
new registration requires username
new registration lowercases username
optional PH phone is persisted canonically to phone + phoneNormalized
registering duplicate username returns generic CUSTOMER_ACCOUNT_CONFLICT
registering duplicate email returns same generic conflict
registering equivalent duplicate phone formats returns same generic conflict
username uniqueness race/P2002 stays generic
login succeeds by username
login succeeds by case-variant username
login succeeds by email and case variant
login succeeds by 09 phone
login succeeds by 63 phone
login succeeds by +63 phone
legacy username-null account still logs in by email
malformed/nonexistent/inactive/wrong-password login returns exact Invalid credentials.
email-looking input never falls through to username
safe customer JSON includes username but excludes phoneNormalized/passwordHash/tokenHash/sessionToken
```

- [ ] **Step 2: Run RED**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-auth-identifier.test.ts
```

Expected: failures because validators/service are still email-only and schema-safe customer shape lacks username.

- [ ] **Step 3: Update Zod contracts**

Registration validates/normalizes username, email, optional PH phone, and existing password bounds. Login validates nonempty identifier/password but delegates identity classification to the shared utility so response privacy is preserved.

Do not produce field-specific account-existence errors from backend login.

- [ ] **Step 4: Update registration service**

Pre-check username/email/phoneNormalized conflicts without returning which one collided. Use canonical new-account values. Preserve Prisma P2002 -> generic conflict mapping for races.

- [ ] **Step 5: Update login service**

Classify once; query exactly one field:

```text
email -> customerAccount.findUnique({ where: { email } })
phone -> customerAccount.findUnique({ where: { phoneNormalized } })
username -> customerAccount.findUnique({ where: { username } })
```

If classification fails, no account exists, or account is inactive, execute the existing dummy current-password verification and return the exact generic invalid-credentials response. Wrong-password behavior remains generic. Session/password-upgrade code remains unchanged.

- [ ] **Step 6: Update safe customer mapping**

Expose `username: customer.username` only; never expose `phoneNormalized`.

- [ ] **Step 7: Run GREEN plus Phase 1 backend regressions**

```bash
npx tsx --test --test-concurrency=1 \
  backend/test/customer-auth-identifier.test.ts \
  backend/test/customer-auth.test.ts \
  backend/test/customer-auth-http.test.ts \
  backend/test/customer-auth-password-security.test.ts \
  backend/test/customer-registration-intent.test.ts \
  backend/test/customer-auth-origin-cache.test.ts \
  backend/test/customer-auth-privacy.test.ts
```

Expected: all pass. If an old test fails only because it sends the old intentional contract, update its fixture/request shape without weakening its original assertion.

- [ ] **Step 8: Commit**

```bash
git add backend/src/validators/customerAuth.validators.ts backend/src/services/customerAuthService.ts backend/test/customer-auth-identifier.test.ts backend/test/customer-auth*.test.ts backend/test/customer-registration-intent.test.ts
git commit -m "feat(auth): support customer identifier login"
```

---

### Task 4: Identifier-Private Rate Limiting

**Files:**
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/src/security/security.constants.ts` only if needed for distinct scopes.
- Modify: `backend/test/customer-auth-rate-limit.test.ts`

**Interfaces:**
- Consumes Task 1 canonical normalization.
- Preserves `derivePrivateRateLimitKey(scope, canonicalIdentifier)` HMAC behavior.

- [ ] **Step 1: Extend rate-limit tests and verify RED**

Add assertions that:

```text
Maria.Santos and maria.santos share one login identifier bucket
Maria@Example.com and maria@example.com share one bucket
09171234567, 639171234567, and +639171234567 share one bucket
raw canonical or submitted identifiers never appear as limiter storage keys
registration username/email/mobile are independently throttled
changing username cannot bypass the same email/mobile identity throttle
changing email cannot bypass the same username identity throttle
Phase 1 IP and identifier thresholds remain unchanged
```

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-auth-rate-limit.test.ts
```

Expected: FAIL against the current email-only key resolver.

- [ ] **Step 2: Replace email-only route key extraction**

Login uses `classifyCustomerLoginIdentifier()` and feeds a class-prefixed canonical identity into HMAC key derivation, e.g. `email:<normalized>`, `phone:<normalized>`, `username:<normalized>`.

Registration uses independent private keys for normalized username, email, and optional mobile. Preserve existing thresholds and no-lockout behavior.

- [ ] **Step 3: Run GREEN**

Run the rate-limit test plus `backend/test/auth-security.test.ts`. Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/customerAuth.routes.ts backend/src/security/security.constants.ts backend/test/customer-auth-rate-limit.test.ts
git commit -m "feat(auth): protect customer identifier login rates"
```

---

### Task 5: Frontend Functional Identifier Contract

**Files:**
- Create: `scripts/test/customer-auth-identifier-client.test.mjs`
- Modify: `frontend/src/types/customerAuth.ts`
- Modify: `frontend/src/utils/customerAuthForms.ts`
- Modify: `frontend/src/services/customerAuthService.ts`
- Modify: `frontend/src/context/CustomerAuthContext.tsx`
- Modify: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Modify: `frontend/src/pages/customer/CustomerRegisterPage.tsx`

**Interfaces:**
- Login submits `{ identifier, password }`.
- Registration submits `{ name, username, email, phone?, password }`.
- `Customer.username` is `string | null`.
- `confirmPassword` is UI state/validation only and is never part of `CustomerRegisterInput` or the HTTP payload.

- [ ] **Step 1: Add a failing frontend source-contract guard**

The test must prove source-level contract requirements:

```text
customer auth type has identifier, not login email
customer type has username: string | null
registration input has username
login page label is Username, email or mobile number
register page has Username and Confirm password fields
register HTTP payload does not contain confirmPassword
registration intent prewarm remains present
no Google/Facebook/OTP controls are introduced
```

- [ ] **Step 2: Run RED**

```bash
node --test scripts/test/customer-auth-identifier-client.test.mjs
```

Expected: FAIL because frontend still uses email-only login and no username/confirm-password registration field.

- [ ] **Step 3: Update types/service/context**

Change only the credential contract. Keep `credentials: "include"`, customer session restore, logout, and error parsing behavior unchanged.

- [ ] **Step 4: Update functional form validation**

Login: require a nonblank identifier but do not reject based on whether it is an email/phone/username client-side; backend remains privacy authority.

Registration: validate approved username syntax/reserved names, existing email rules, optional PH phone format, password >= existing minimum, and confirm-password equality. Do not add `confirmPassword` to the service input type.

- [ ] **Step 5: Update Login/Register pages minimally**

Login state becomes `identifier`; input is text with `autoComplete="username"` and label `Username, email or mobile number`.

Register adds Username before Email and Confirm password after Password. Preserve existing visual shell/classes; no Phase 3 redesign.

- [ ] **Step 6: Run GREEN and frontend guard regressions**

```bash
node --test \
  scripts/test/customer-auth-identifier-client.test.mjs \
  scripts/test/customer-registration-client-intent.test.mjs \
  scripts/test/customer-internal-access-separation.test.mjs
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/test/customer-auth-identifier-client.test.mjs frontend/src/types/customerAuth.ts frontend/src/utils/customerAuthForms.ts frontend/src/services/customerAuthService.ts frontend/src/context/CustomerAuthContext.tsx frontend/src/pages/customer/CustomerLoginPage.tsx frontend/src/pages/customer/CustomerRegisterPage.tsx
git commit -m "feat(auth): add customer identifier forms"
```

---

### Task 6: Phase 2 Acceptance and Regression Gate

**Files:**
- No production files unless a verification failure identifies a real defect.
- Update Phase 2 tests only if a test itself is proven incorrect; do not weaken acceptance assertions.

**Interfaces:**
- Consumes all Tasks 1-5.
- Produces fresh acceptance evidence for Phase 2.

- [ ] **Step 1: Run frontend contract guards**

```bash
node --test \
  scripts/test/customer-auth-identifier-client.test.mjs \
  scripts/test/customer-registration-client-intent.test.mjs \
  scripts/test/customer-internal-access-separation.test.mjs
```

Expected: 0 failures.

- [ ] **Step 2: Run complete customer/internal auth-security backend regression**

```bash
npx tsx --test --test-concurrency=1 \
  backend/test/customer-identity.test.ts \
  backend/test/customer-mobile-backfill.test.ts \
  backend/test/customer-auth-identifier.test.ts \
  backend/test/customer-auth.test.ts \
  backend/test/customer-auth-http.test.ts \
  backend/test/customer-auth-password-security.test.ts \
  backend/test/customer-auth-rate-limit.test.ts \
  backend/test/customer-registration-intent.test.ts \
  backend/test/customer-auth-origin-cache.test.ts \
  backend/test/customer-auth-privacy.test.ts \
  backend/test/auth-security.test.ts
```

Expected: 0 failures.

- [ ] **Step 3: Validate migration/backfill in local development DB**

```bash
npm run prisma:validate
npm run prisma:generate
npm run customer-mobile-identities:audit
```

Inspect audit counts. Do not run `--apply` blindly against an unknown/non-development DB. For the approved local development DB, run:

```bash
npm run customer-mobile-identities:apply
npm run customer-mobile-identities:audit
```

Expected: apply performs only unambiguous valid updates; second audit reports no additional pending unique legacy mappings.

- [ ] **Step 4: Run repository quality gate**

```bash
npm run typecheck
npm run lint
npm run build
npm run prisma:validate
npm run security:audit
```

Expected: all commands exit successfully and security audit reports no high/critical dependency findings.

- [ ] **Step 5: Manual customer QA**

Create a fresh test customer and prove:

```text
registration with username/email/no phone works
registration with username/email/PH phone works
username login works
case-variant username login works
email login works
09 phone login works
63 phone login works
+63 phone login works
wrong password returns Invalid credentials.
duplicate username/email/mobile registration stays generic
legacy username-null QA customer retains email login
logout and hard-refresh session revocation remain correct
```

Do not reuse repeated failed attempts enough to trip the intentional identifier limiter; if a 429 occurs, treat it as a security-control result, not an auth defect, and wait for the window rather than weakening limits.

- [ ] **Step 6: Manual Staff/Owner isolation regression**

Verify customer credentials still fail at `/staff-login`, and local development Owner and Staff fixture credentials still authenticate to the internal dashboard with the correct roles. Never paste real production/internal secrets into chat.

- [ ] **Step 7: Verify branch head and remote status**

Confirm the branch contains only intended Phase 2 commits and inspect available GitHub status checks. Do not claim CI if no remote checks exist.

- [ ] **Step 8: Phase 2 completion decision**

Only after Steps 1-7 have fresh evidence, mark Phase 2 GO. Record any non-blocking performance warnings separately; do not conflate them with auth correctness.
