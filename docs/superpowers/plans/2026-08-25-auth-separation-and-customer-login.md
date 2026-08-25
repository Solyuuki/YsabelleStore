# Auth Separation and Customer Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate public customer navigation from internal Staff/Owner access first, then upgrade the customer login/register baseline without destabilizing the mature internal auth system.

**Architecture:** Preserve two authentication realms: customer accounts continue to use `CustomerAccount` + HttpOnly `CustomerSession`, while OWNER/STAFF continue to use `User` + JWT + `TrustedDevice`. The public storefront stops advertising `/staff-login`; customer auth then gains username/email/phone identifier login before any social or OTP provider work. Internal visual re-theming happens only after customer auth is accepted so both surfaces can share one Ysabelle brand language without sharing credentials or sessions.

**Tech Stack:** React + TypeScript, Express, Prisma/MySQL, Node test runner, existing YsabelleStore auth contexts/services, Tailwind/CSS.

**Spec:** `docs/superpowers/specs/2026-08-25-auth-access-and-customer-login-design.md`

## Global Constraints

- Keep `CustomerAccount` and internal `User` authentication realms separate.
- Preserve existing Staff/Owner known-account, trusted-device, role authorization, route protection, owner-managed account creation, and rate-limit behavior.
- Do not use a secret URL or query parameter as the primary Staff/Owner security mechanism.
- No public storefront surface may advertise `/staff-login`.
- Do not render fake Google, Facebook, or Phone OTP buttons before their backend flows exist.
- Preserve HttpOnly customer session cookies.
- Invalid customer login must not reveal which identifier type matched or whether an account exists.
- Shared branding does not mean shared authentication state.

---

### Task 1: Remove public Staff/Owner discovery without changing internal auth

**Files:**
- Modify: `frontend/src/components/customer/CustomerHeader.tsx`
- Create: `scripts/test/customer-internal-access-separation.test.mjs`

**Interfaces:**
- Consumes: existing `/staff-login` route in `AppShell` and `app/routes.ts`.
- Produces: storefront navigation with no Staff/Owner link while direct internal routing remains untouched.

- [ ] **Step 1: Write the failing regression test**

Create `scripts/test/customer-internal-access-separation.test.mjs` that reads `CustomerHeader.tsx`, `AppShell.tsx`, and `routes.ts` and asserts:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("customer UI does not expose staff login while internal route remains available", () => {
  const header = read("frontend/src/components/customer/CustomerHeader.tsx");
  const shell = read("frontend/src/app/AppShell.tsx");
  const routes = read("frontend/src/app/routes.ts");

  assert.doesNotMatch(header, /Staff \/ Owner Login|href="\/staff-login"/);
  assert.match(shell, /internalRoutePaths[\s\S]*?"\/staff-login"/);
  assert.match(routes, /path:\s*"\/staff-login"/);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node --test scripts/test/customer-internal-access-separation.test.mjs
```

Expected: FAIL because `CustomerHeader.tsx` currently exposes `Staff / Owner Login` in the mobile panel.

- [ ] **Step 3: Remove only the public customer link**

Delete this customer-menu entry from `CustomerHeader.tsx`:

```tsx
<CustomerLink href="/staff-login" navigate={navigate} onClick={() => setMenuOpen(false)}>
  Staff / Owner Login
</CustomerLink>
```

Do not modify `AppShell`, `AuthContext`, backend `/api/auth/*`, `WelcomePage`, or `app/routes.ts` in this task.

- [ ] **Step 4: Run focused and route regression tests**

Run:

```bash
node --test scripts/test/customer-internal-access-separation.test.mjs
npm run customer:header-route:test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/customer/CustomerHeader.tsx scripts/test/customer-internal-access-separation.test.mjs
git commit -m "fix(sprint9): hide internal staff entry from storefront"
```

---

### Task 2: Establish shared auth brand tokens before redesigning either login surface

**Files:**
- Create: `frontend/src/styles/auth-brand.css`
- Modify: `frontend/src/app/CustomerApp.tsx`
- Modify: internal app stylesheet import location used by `WelcomePage`/`AppLayout`
- Create: `scripts/test/auth-brand-boundary.test.mjs`

**Interfaces:**
- Produces: shared visual tokens/classes for purple/blue/pink brand surfaces while leaving semantic success/warning/error colors available.
- Consumes: existing Ysabelle brand colors already used by customer storefront.

- [ ] **Step 1: Write a failing source-contract test**

Assert that a shared auth brand stylesheet exists, exposes brand background/accent variables, and is imported by both customer and internal application surfaces without changing auth logic.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/test/auth-brand-boundary.test.mjs
```

Expected: FAIL because shared auth branding is not yet centralized.

- [ ] **Step 3: Add shared brand primitives**

Create tokens/classes for:

```css
:root {
  --ys-auth-primary: #625bff;
  --ys-auth-secondary: #008cff;
  --ys-auth-accent: #d946ef;
  --ys-auth-surface: rgb(255 255 255 / 86%);
  --ys-auth-border: rgb(98 91 255 / 16%);
}
```

Use semantic green only for healthy/success status, not the page's primary identity.

- [ ] **Step 4: Run GREEN plus lint/typecheck for touched frontend files**

```bash
node --test scripts/test/auth-brand-boundary.test.mjs
npm run lint
npm run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/auth-brand.css frontend/src/app/CustomerApp.tsx scripts/test/auth-brand-boundary.test.mjs
git commit -m "style(sprint9): establish shared auth brand language"
```

---

### Task 3: Add username and normalized phone identity to CustomerAccount

**Files:**
- Modify: `database/prisma/schema.prisma`
- Create: new Prisma migration under `database/prisma/migrations/<timestamp>_customer_login_identifiers/`
- Modify: `backend/src/validators/customerAuth.validators.ts`
- Modify: `backend/src/services/customerAuthService.ts`
- Modify: `backend/test/customer-auth-http.test.ts`
- Create or modify customer-auth service tests as appropriate.

**Interfaces:**
- Produces: unique `username`, normalized unique phone when present, and a login identifier resolver.
- Preserves: required email and password hash during this phase.

- [ ] **Step 1: Write failing backend tests**

Cover at minimum:

```ts
// registration rejects duplicate username
// registration normalizes username casing/whitespace according to selected rule
// login succeeds with username + password
// login succeeds with email + password
// login succeeds with normalized PH phone + password when phone exists
// wrong identifier and wrong password return the same 401 code/message
// duplicate normalized phone is rejected when phone is supplied
```

- [ ] **Step 2: Run targeted backend test and verify RED**

Run the backend test command used by the workspace for `customer-auth-http.test.ts` (or the repository's backend test script if broader execution is required).

Expected: FAIL because `CustomerAccount` currently has no username login and phone is not a unique login identifier.

- [ ] **Step 3: Extend Prisma model**

Target shape:

```prisma
model CustomerAccount {
  id           String                @id @default(cuid()) @db.VarChar(191)
  name         String                @db.VarChar(120)
  username     String                @unique(map: "uq_customer_accounts_username") @db.VarChar(80)
  email        String                @unique(map: "uq_customer_accounts_email") @db.VarChar(191)
  phone        String?               @unique(map: "uq_customer_accounts_phone") @db.VarChar(40)
  passwordHash String                @map("password_hash") @db.VarChar(255)
  // existing status/session/order fields remain
}
```

Migration must backfill existing customers deterministically before making `username` required. Use a collision-safe rule based on the existing email local-part plus a stable suffix when necessary; do not drop existing customer rows.

- [ ] **Step 4: Add normalization helpers and identifier resolution**

Implement focused helpers in customer auth service/module, e.g.:

```ts
function normalizeCustomerUsername(value: string): string
function normalizeCustomerPhone(value: string): string
async function findCustomerByLoginIdentifier(identifier: string): Promise<CustomerAccount | null>
```

Rules:
- username lookup is normalized consistently;
- email remains normalized as currently expected by validators;
- PH phone accepts common `09...` / `+63...` input and stores one canonical representation;
- resolution order must not change response messages.

- [ ] **Step 5: Update registration validator/service**

Registration input becomes:

```ts
{
  name: string;
  username: string;
  email: string;
  phone?: string;
  password: string;
}
```

All duplicate cases return customer-safe conflict errors without exposing password/account internals.

- [ ] **Step 6: Update login validator/service**

Login input becomes:

```ts
{
  identifier: string;
  password: string;
}
```

The service resolves username/email/phone and always uses the same invalid-credential response for missing account, inactive account, or password mismatch.

- [ ] **Step 7: Run backend tests + Prisma checks**

```bash
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
```

Run the targeted customer-auth backend tests and require PASS.

- [ ] **Step 8: Commit**

```bash
git add database/prisma backend/src backend/test
git commit -m "feat(sprint9): support customer username email and phone login"
```

---

### Task 4: Redesign customer login around identifier + password

**Files:**
- Modify: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Modify: `frontend/src/utils/customerAuthForms.ts`
- Modify: `frontend/src/types/customerAuth.ts`
- Modify: `frontend/src/services/customerAuthService.ts`
- Modify: `frontend/src/styles/customer-auth.css`
- Create: `scripts/test/customer-login-experience.test.mjs`

**Interfaces:**
- Consumes: backend `{ identifier, password }` login contract from Task 3.
- Produces: branded customer login with username/email/mobile field, password, forgot-password placeholder only if a functional route exists, and no internal staff entry.

- [ ] **Step 1: Write failing UI contract tests**

Assert:
- label includes `Username, email or mobile number`;
- identifier input has a helpful example placeholder;
- password has a placeholder and show/hide control;
- submit button remains functional;
- no `/staff-login` reference;
- no Google/Facebook/Phone OTP controls yet.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/test/customer-login-experience.test.mjs
```

- [ ] **Step 3: Implement the new customer login composition**

Use the existing customer header and shared Ysabelle auth brand language. Reduce dead space and make the login card feel like a retail account surface rather than an internal system form.

Target information hierarchy:

```text
Customer account
Welcome back
Sign in to continue shopping

Username, email or mobile number
Password
Sign In

New to Ysabelle Store? Create Account
```

Do not render nonfunctional quick-sign-in buttons in this task.

- [ ] **Step 4: Update frontend data contract**

Replace `{ email, password }` usage with `{ identifier, password }` throughout customer login service/types/context callers.

- [ ] **Step 5: Run focused tests, typecheck, lint, build**

```bash
node --test scripts/test/customer-login-experience.test.mjs
npm run typecheck
npm run lint
npm run build
```

- [ ] **Step 6: Manual QA**

Verify:
- username login;
- email login;
- phone login;
- wrong credentials;
- show/hide password;
- Enter key submit;
- mobile layout;
- customer session restore after refresh;
- no Staff/Owner link in desktop or mobile storefront.

- [ ] **Step 7: Commit**

```bash
git add frontend/src scripts/test/customer-login-experience.test.mjs
git commit -m "feat(sprint9): redesign customer sign in experience"
```

---

### Task 5: Redesign customer registration and profile carry-through

**Files:**
- Modify: `frontend/src/pages/customer/CustomerRegisterPage.tsx`
- Modify: `frontend/src/pages/customer/CustomerAccountPage.tsx`
- Modify: `frontend/src/utils/customerAuthForms.ts`
- Modify: `frontend/src/types/customerAuth.ts`
- Modify: `frontend/src/services/customerAuthService.ts`
- Create: `scripts/test/customer-registration-profile.test.mjs`

**Interfaces:**
- Consumes: Task 3 registration fields.
- Produces: account registration whose saved values immediately appear in customer profile/account settings.

- [ ] **Step 1: Write RED tests**

Require registration UI fields for full name, username, email, optional phone, password, and confirm password. Require account/profile presentation for persisted name/username/email/phone after login.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/test/customer-registration-profile.test.mjs
```

- [ ] **Step 3: Implement registration UX**

Use the same shared customer auth shell as login. Confirm password remains client-only and is never sent to the backend.

- [ ] **Step 4: Surface persisted account identity in profile**

Customer account page should show the data collected during registration without requiring re-entry. Verification badges are deferred until verification state exists in the schema.

- [ ] **Step 5: Verify**

```bash
node --test scripts/test/customer-registration-profile.test.mjs
npm run typecheck
npm run lint
npm run build
```

Manual QA: create account, redirect to account, refresh, sign out, sign back in via username/email/phone.

- [ ] **Step 6: Commit**

```bash
git add frontend/src scripts/test/customer-registration-profile.test.mjs
git commit -m "feat(sprint9): align customer registration and profile"
```

---

### Task 6: Re-theme Staff/Owner access without changing its behavior

**Files:**
- Modify: `frontend/src/pages/WelcomePage.tsx`
- Modify: `frontend/src/layouts/AppLayout.tsx`
- Modify: `frontend/src/components/app/AppSidebar.tsx`
- Modify: relevant internal auth/ambient styles
- Create: `scripts/test/internal-auth-brand-parity.test.mjs`

**Interfaces:**
- Consumes: shared brand primitives from Task 2.
- Preserves: all `WelcomePage` callbacks and state transitions.

- [ ] **Step 1: Write behavior-preservation + brand-parity tests**

The test must assert the internal page still references known-account/trusted-device behaviors while no longer using emerald as the primary ambient/CTA brand treatment.

- [ ] **Step 2: Run RED**

```bash
node --test scripts/test/internal-auth-brand-parity.test.mjs
```

- [ ] **Step 3: Re-theme, do not rewrite auth logic**

Preserve:
- remembered accounts;
- `Continue` trusted-device action;
- `Forget`;
- `Use another account`;
- email/password form;
- password visibility;
- validation feedback;
- system health;
- OWNER/STAFF badges;
- role redirects.

Change only presentation and shared component styling necessary for brand parity.

- [ ] **Step 4: Verify internal auth regressions**

Run:

```bash
node --test scripts/test/internal-auth-brand-parity.test.mjs
npm run typecheck
npm run lint
npm run build
```

Also run backend internal auth security tests to ensure no internal auth behavior changed.

- [ ] **Step 5: Manual QA**

Test:
- direct `/staff-login` access;
- remembered OWNER account;
- remembered STAFF account;
- trusted-device Continue;
- Forget;
- Use another account;
- wrong password;
- successful password login;
- logout returns to internal login;
- OWNER/STAFF route differences remain correct.

- [ ] **Step 6: Commit**

```bash
git add frontend/src scripts/test/internal-auth-brand-parity.test.mjs
git commit -m "style(sprint9): align internal access with ysabelle brand"
```

---

### Task 7: Add Google Quick Sign In as the first external provider

**Files:**
- Schema migration for customer provider identity records
- Backend customer auth provider service/routes/controller/validators
- Frontend customer login/register quick-sign-in UI
- Backend and frontend regression tests

**Interfaces:**
- Produces: customer-only provider identity linked to `CustomerAccount`.
- Must never authenticate internal `User` records.

- [ ] **Step 1: Choose/configure Google OAuth provider and redirect origins for dev/prod**
- [ ] **Step 2: Write backend RED tests for callback validation, account creation/linking, replay/state failure, and customer-only isolation**
- [ ] **Step 3: Implement provider identity persistence and Google flow**
- [ ] **Step 4: Add functional `Continue with Google` button only after backend flow exists**
- [ ] **Step 5: Run provider-specific tests, security tests, typecheck, lint, build**
- [ ] **Step 6: Manual QA new account, existing-email linking rule, cancellation, provider error, logout/session restore**
- [ ] **Step 7: Commit as an independent provider feature**

Do not start Facebook or Phone OTP until Google is accepted.

---

### Task 8: Add Facebook Quick Sign In

Follow the same isolation, account-linking, CSRF/state, error-handling, and regression requirements as Google, using a separate provider adapter and independent acceptance gate.

---

### Task 9: Add Phone OTP Quick Sign In and contact verification

**Requirements:**
- choose an SMS provider before implementation;
- OTP values are short-lived, one-time, attempt-limited, and never stored plaintext if persisted;
- rate-limit request and verify endpoints;
- normalize PH phone numbers consistently with Task 3;
- successful OTP can mark `phoneVerifiedAt`;
- OTP authenticates customer accounts only;
- no OTP requirement for browsing.

This task also adds the `Verified` / `Not verified` phone state to Account Security.

---

### Task 10: Add delivery-address/profile verification only when delivery scope is implemented

Do not couple this to login work. Add saved customer addresses and require a verified reachable phone before the first delivery order only if the approved delivery workflow needs it. Pickup remains low-friction.

---

## Final Verification Gate

Before Sprint 9 auth acceptance, run fresh:

```bash
npm run test:guardrails
npm run typecheck
npm run lint
npm run build
npm run prisma:validate
```

Run targeted backend customer-auth and internal auth-security suites, then manually verify both realms independently in one browser session:

```text
Customer session -> storefront/account works
Internal OWNER session -> dashboard works
Internal STAFF session -> permitted modules only
Customer logout does not become internal logout
Internal logout does not become customer logout
No customer surface links to internal login
Direct internal entry still works
```

Do not call the auth work complete if provider buttons exist without functional provider backends, if internal trusted-device behavior regresses, or if the public storefront exposes Staff/Owner access again.
