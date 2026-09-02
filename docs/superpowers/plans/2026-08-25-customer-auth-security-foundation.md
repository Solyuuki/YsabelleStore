# Customer Auth Security Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing customer email/password authentication against enumeration, brute force, automated signup, session caching, and cross-origin abuse before adding new login identifiers or quick sign-in providers.

**Architecture:** Preserve the existing `CustomerAccount` + HttpOnly `CustomerSession` model and internal OWNER/STAFF auth separation. Add versioned scrypt profiles, constant-work invalid login verification, layered privacy-safe auth throttling, a signed registration-intent cookie, origin enforcement for state-changing customer-auth endpoints, and explicit no-store response headers. Keep the first limiter implementation in-memory for the current local-first/single-process deployment, with a documented Redis migration gate before horizontal scale.

**Tech Stack:** Node.js 20+, TypeScript, Express, Node crypto/scrypt/HMAC, Prisma/MySQL, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-customer-auth-security-foundation-design.md`

## Global Constraints

- Do not modify username/phone login, Google/Facebook OAuth, phone OTP, shipping verification, or Staff/Owner auth behavior in this phase.
- Preserve customer HttpOnly session cookies and server-side session-token hashing.
- Never store raw email/phone identifiers in rate-limit maps.
- Never log passwords, cookies, session tokens, OTPs, or auth request bodies.
- Keep invalid customer login responses generic across missing, inactive, and wrong-password cases.
- Do not enable Express `trust proxy` without deployment-specific proxy topology.
- Do not add always-on CAPTCHA.

---

### Task 1: Version password hashing and remove fast-fail enumeration

**Files:**

- Modify: `backend/src/services/passwordHashService.ts`
- Modify: `backend/src/services/customerAuthService.ts`
- Create: `backend/test/customer-auth-password-security.test.ts`

**Interfaces:**

- Produces: `hashPassword()` using the current profile, `verifyPassword()` compatible with legacy/current hashes, `passwordHashNeedsUpgrade(hash)`, and constant-work invalid customer login.
- Consumes: existing `scrypt$N$r$p$salt$hash` format.

- [ ] **Step 1: Write failing tests**

Add tests that assert:

```ts
const legacy = await hashPasswordWithProfileForTest("CustomerPass123!", "legacy");
assert.equal(await verifyPassword("CustomerPass123!", legacy), true);
assert.equal(passwordHashNeedsUpgrade(legacy), true);

const current = await hashPassword("CustomerPass123!");
assert.equal(await verifyPassword("CustomerPass123!", current), true);
assert.equal(passwordHashNeedsUpgrade(current), false);
```

Add a customer-login service test that instruments the password verification path or uses a test hook to prove a missing customer executes one scrypt verification before returning `INVALID_CUSTOMER_CREDENTIALS`.

- [ ] **Step 2: Run targeted tests and verify RED**

Run the backend workspace test command targeting `customer-auth-password-security.test.ts`.

Expected: FAIL because profile upgrade detection and constant-work missing-account verification do not exist.

- [ ] **Step 3: Implement explicit hash profiles**

Use:

```ts
const SCRYPT_PROFILES = {
  legacy: { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
  current: { N: 65536, r: 8, p: 1, maxmem: 160 * 1024 * 1024 }
} as const;
```

Keep the on-disk hash format unchanged. `hashPassword()` uses `current`. `verifyPassword()` reads N/r/p from the stored hash. `passwordHashNeedsUpgrade()` returns true for any supported hash below the current profile or malformed/unsupported profile as appropriate.

- [ ] **Step 4: Add constant-work invalid login**

At module initialization, generate one dummy current-profile hash asynchronously through a module-scoped promise. In `loginCustomer`, when no active customer is found, verify the submitted password against the dummy hash and then throw the same generic 401 used for wrong passwords.

On successful verification of a legacy customer hash, rehash with the current profile and update only `passwordHash` before creating the session.

- [ ] **Step 5: Run GREEN**

Run targeted password-security tests plus existing `customer-auth-http.test.ts` and `auth-security.test.ts`.

- [ ] **Step 6: Commit**

Commit message: `security(auth): harden customer password verification`.

---

### Task 2: Add HMAC-derived identifier throttling

**Files:**

- Modify: `backend/src/middleware/authRateLimit.ts`
- Modify: `backend/src/security/security.constants.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Create: `backend/test/customer-auth-rate-limit.test.ts`

**Interfaces:**

- Produces: reusable `createAuthRateLimit({ keyResolver? })` behavior where custom keys are opaque/HMAC-derived.
- Preserves: current per-IP throttling and `Retry-After` response.

- [ ] **Step 1: Write failing tests**

Test that five failed requests for the same normalized email from rotating synthetic IPs cause the identifier limiter to block the next attempt, while a different identifier remains allowed. Test that internal limiter storage exposed by a test-only inspection helper contains no raw email value.

- [ ] **Step 2: Run RED**

Expected: current IP-only limiter does not block rotated-IP attacks against one identifier.

- [ ] **Step 3: Generalize rate-limit key resolution**

Extend options with:

```ts
keyResolver?: (request: Request) => string | null;
```

If no resolver is provided, retain the current IP behavior. If resolver returns null, skip that limiter without weakening other middleware in the route chain.

Add a process-random HMAC key generated with `randomBytes(32)` and helper:

```ts
export function derivePrivateRateLimitKey(scope: string, value: string): string {
  return createHmac("sha256", PROCESS_RATE_LIMIT_SECRET).update(`${scope}:${value}`).digest("hex");
}
```

Never use raw normalized identifiers as Map keys.

- [ ] **Step 4: Configure layered customer limits**

Add:

```ts
customerLoginIdentifier: { windowMs: 15 * 60 * 1000, maxAttempts: 5, scope: "customer-login-identifier" },
customerRegisterIdentity: { windowMs: 15 * 60 * 1000, maxAttempts: 3, scope: "customer-register-identity" }
```

For the current email/password phase, normalize email via trim + lowercase before deriving the HMAC limiter key. Chain IP limiter first, identifier limiter second.

- [ ] **Step 5: Run GREEN + existing auth rate-limit tests**

Require targeted tests and existing internal auth rate-limit test to pass.

- [ ] **Step 6: Commit**

Commit message: `security(auth): add privacy safe customer throttling`.

---

### Task 3: Add low-friction registration-intent bot guard

**Files:**

- Create: `backend/src/utils/customerRegistrationIntent.ts`
- Modify: `backend/src/controllers/customerAuthController.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Create: `backend/test/customer-registration-intent.test.ts`

**Interfaces:**

- Produces: `GET /api/customer-auth/registration-intent` and required intent-cookie validation on registration.
- Preserves: no CAPTCHA for normal customers.

- [ ] **Step 1: Write failing tests**

Require:

- registration without intent cookie -> 400/403 bot-protection error;
- valid intent cookie after minimum age -> registration reaches normal validation/service path;
- intent younger than 750 ms -> rejected;
- intent older than 10 minutes -> rejected;
- tampered intent -> rejected;
- intent cookie is HttpOnly, SameSite=Lax, `/api/customer-auth`, Secure in production.

- [ ] **Step 2: Run RED**

Expected: registration currently accepts direct POST without any intent.

- [ ] **Step 3: Implement signed intent tokens**

Token payload:

```ts
{ v: 1, iat: number, nonce: string }
```

Encode payload as base64url and append HMAC-SHA-256 signature generated from a process-random 32-byte secret. Cookie lifetime: 10 minutes. Minimum accepted age: 750 ms. Validation uses `timingSafeEqual` for signature comparison.

- [ ] **Step 4: Add intent endpoint and register guard**

`GET /registration-intent` issues a fresh cookie and a minimal `{ ready: true }` response. `POST /register` requires and validates the cookie before expensive password hashing or DB writes. Clear the intent cookie after a successful registration attempt that reaches account creation.

- [ ] **Step 5: Run GREEN**

Run registration-intent tests and customer-auth HTTP tests.

- [ ] **Step 6: Commit**

Commit message: `security(auth): require customer registration intent`.

---

### Task 4: Enforce browser origin and no-store auth responses

**Files:**

- Create: `backend/src/middleware/customerAuthSecurity.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/src/routes/customerAccount.routes.ts`
- Create: `backend/test/customer-auth-origin-cache.test.ts`

**Interfaces:**

- Produces: `requireAllowedCustomerAuthOrigin` and `disableSensitiveResponseCaching`.

- [ ] **Step 1: Write failing tests**

Assert:

- approved `http://localhost:5173` Origin can invoke state-changing customer auth endpoints;
- `https://evil.example` receives 403 before login/register/logout behavior executes;
- absent Origin remains allowed for local/non-browser test clients;
- `/api/customer-auth/me`, login/register responses, and customer-account responses include `Cache-Control: no-store` and `Pragma: no-cache`.

- [ ] **Step 2: Run RED**

Expected: CORS suppresses browser access to an unapproved response but the server does not explicitly reject all state-changing auth actions, and no-store headers are not guaranteed.

- [ ] **Step 3: Implement middleware**

If `Origin` is present and not in `corsOrigins`, throw 403 code `CUSTOMER_AUTH_ORIGIN_REJECTED`. Apply the middleware to registration-intent, register, login, and logout. Apply no-store middleware across `/customer-auth` and authenticated `/customer-account` routes.

- [ ] **Step 4: Run GREEN**

Run origin/cache tests plus existing CORS tests.

- [ ] **Step 5: Commit**

Commit message: `security(auth): enforce customer auth origin and cache policy`.

---

### Task 5: Close privacy leaks and guard logs

**Files:**

- Modify: `backend/src/services/customerAuthService.ts`
- Modify: `backend/test/customer-auth-http.test.ts`
- Create: `backend/test/customer-auth-privacy.test.ts`

**Interfaces:**

- Produces: privacy-safe registration conflict behavior and tests for DTO/log hygiene.

- [ ] **Step 1: Write failing tests**

Require the same public conflict status/code/message for an already-registered normalized email and a uniqueness race. Require login errors to use exactly `Invalid credentials.`. Capture `console.info` during an auth request and prove logs do not contain submitted email/password/cookie/session-token material. Assert customer JSON never contains `passwordHash`, `tokenHash`, or `sessionToken`.

- [ ] **Step 2: Run RED**

Expected: current registration explicitly says an email already exists and login copy says `Invalid email or password.`.

- [ ] **Step 3: Implement privacy-safe errors**

Use generic conflict copy/code such as:

```ts
new HttpError(409, "Unable to create customer account with the supplied details.", {
  code: "CUSTOMER_ACCOUNT_CONFLICT"
});
```

Use one login response: `Invalid credentials.` / `INVALID_CUSTOMER_CREDENTIALS`.

- [ ] **Step 4: Run GREEN**

Run privacy tests plus all customer-auth backend tests.

- [ ] **Step 5: Commit**

Commit message: `security(auth): protect customer authentication privacy`.

---

### Task 6: Phase 1 security acceptance gate

**Files:**

- Modify: `docs/superpowers/specs/2026-08-25-customer-auth-security-foundation-design.md` only if verification reveals a documented limitation.

**Interfaces:**

- Produces: evidence-backed decision whether Phase 2 may start.

- [ ] **Step 1: Run focused security suite**

Run all customer auth, internal auth security, CORS, and new security tests.

- [ ] **Step 2: Run repository validation**

```bash
npm run typecheck
npm run lint
npm run build
npm run prisma:validate
```

- [ ] **Step 3: Run security audit tooling available in the repository**

```bash
npm run security:audit
```

Do not claim a Codex Security full scan was completed unless run inside a supported Codex Security workbench. Record that limitation separately if applicable.

- [ ] **Step 4: Manual acceptance checklist**

Verify customer registration through the frontend after fetching an intent, valid login, invalid login, session restore, logout/revocation, and that Staff/Owner login remains unaffected.

- [ ] **Step 5: Stop for user acceptance**

Do not begin username/email/phone multi-identifier work until the user accepts the Phase 1 security checkpoint.
