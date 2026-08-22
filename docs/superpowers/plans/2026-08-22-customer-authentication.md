# Customer Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure optional customer accounts to the YsabelleStore storefront while preserving guest checkout and keeping customer identity strictly isolated from OWNER/STAFF authentication.

**Architecture:** Customer accounts use a dedicated `CustomerAccount` model plus server-side `CustomerSession` records backed by a random opaque token stored only in an HttpOnly cookie. Internal OWNER/STAFF authentication remains a separate bearer-token system, but Sprint 7 hardens its token type discrimination and credential errors. Storefront orders gain an optional `customerAccountId`, so guests continue to order while authenticated orders are linked to the signed-in customer and become visible in that customer's order history.

**Tech Stack:** TypeScript, Express 4, Prisma 6/MySQL, Node `crypto`/`scrypt`, React 19, Vite 6, Tailwind/customer CSS, Vitest + Testing Library for new frontend auth tests.

**Spec:** `docs/superpowers/specs/2026-08-22-customer-authentication-design.md`

## Global Constraints

- Keep guest shopping and guest checkout available.
- Customer identities are public storefront accounts, never OWNER/STAFF users.
- A customer credential/session must never satisfy internal OWNER/STAFF authorization.
- Server authorization is authoritative; frontend guards are UX only.
- Use the existing `hashPassword` / `verifyPassword` scrypt implementation unless verification proves a migration is required.
- Customer sessions must have finite expiration and explicit server-side revocation.
- Invalid customer email and invalid customer password must return the same public credential error.
- Preserve the existing Ysabelle blue/purple/pink storefront design system.
- Do not add MFA, social login, online payment, saved payment credentials, or automatic claiming of old guest orders in this sprint.
- All behavior changes follow TDD: failing test -> verify red -> minimal implementation -> verify green -> refactor.
- Auth/database changes are Tier 3/high risk and require full repository verification before completion.

---

## File Map

### Database
- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260822_customer_accounts/migration.sql`

### Backend customer authentication
- Create: `backend/src/validators/customerAuth.validators.ts`
- Create: `backend/src/services/customerAuthService.ts`
- Create: `backend/src/services/customerSessionCookie.ts`
- Create: `backend/src/middleware/customerAuthMiddleware.ts`
- Create: `backend/src/controllers/customerAuthController.ts`
- Create: `backend/src/routes/customerAuth.routes.ts`
- Create: `backend/src/routes/customerAccount.routes.ts`
- Create: `backend/src/controllers/customerAccountController.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/test/customer-auth.test.ts`

### Backend storefront/account integration
- Modify: `backend/src/services/storefrontService.ts`
- Modify: `backend/src/controllers/storefrontController.ts`
- Modify: `backend/src/routes/storefront.routes.ts`
- Test: `backend/test/customer-order-account.test.ts`
- Modify: `backend/package.json`

### Internal-auth hardening
- Modify: `backend/src/services/authService.ts`
- Modify: `backend/src/routes/auth.routes.ts`
- Create: `backend/src/middleware/authRateLimit.ts`
- Test: `backend/test/auth-security.test.ts`

### Frontend customer authentication
- Create: `frontend/src/types/customerAuth.ts`
- Create: `frontend/src/services/customerAuthService.ts`
- Create: `frontend/src/context/CustomerAuthContext.tsx`
- Create: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Create: `frontend/src/pages/customer/CustomerRegisterPage.tsx`
- Create: `frontend/src/pages/customer/CustomerAccountPage.tsx`
- Modify: `frontend/src/app/CustomerApp.tsx`
- Modify: `frontend/src/components/customer/CustomerHeader.tsx`
- Modify: `frontend/src/pages/customer/CheckoutPage.tsx`
- Modify: `frontend/src/services/storefrontService.ts`
- Modify: `frontend/src/types/storefront.ts`
- Modify: `frontend/src/styles/customer.css`
- Create: `frontend/src/test/setup.ts`
- Test: `frontend/src/context/CustomerAuthContext.test.tsx`
- Test: `frontend/src/pages/customer/CustomerLoginPage.test.tsx`
- Test: `frontend/src/pages/customer/CustomerRegisterPage.test.tsx`
- Test: `frontend/src/pages/customer/CustomerAccountPage.test.tsx`
- Modify: `frontend/package.json`
- Modify: `package-lock.json`

---

# Phase 1 - Consumer Authentication Foundation

## Task 1: Add customer identity, session, and optional order ownership to Prisma

**Files:**
- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260822_customer_accounts/migration.sql`
- Test: `backend/test/customer-auth.test.ts`

**Interfaces:**
- Produces Prisma models `CustomerAccount`, `CustomerSession`, and nullable `CustomerOrder.customerAccountId`.
- Later tasks depend on `CustomerAccount.id`, `CustomerSession.tokenHash`, `CustomerSession.expiresAt`, and `CustomerOrder.customerAccountId`.

- [ ] **Step 1: Write the failing database contract test**

Create `backend/test/customer-auth.test.ts` with a first test that attempts to create a customer account and session through Prisma:

```ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";

const createdCustomerIds: string[] = [];

test("customer account and finite session persist independently from internal users", async () => {
  const suffix = randomUUID().slice(0, 8);
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Customer Auth Test",
      email: `customer-auth-${suffix}@example.com`,
      phone: "09171234567",
      passwordHash: "scrypt$test-placeholder",
      status: "ACTIVE"
    }
  });
  createdCustomerIds.push(customer.id);

  const expiresAt = new Date(Date.now() + 60_000);
  const session = await prisma.customerSession.create({
    data: {
      customerAccountId: customer.id,
      tokenHash: randomUUID().replaceAll("-", ""),
      expiresAt
    }
  });

  assert.equal(session.customerAccountId, customer.id);
  assert.equal(session.revokedAt, null);
  assert.equal(session.expiresAt.getTime(), expiresAt.getTime());
});

test.after(async () => {
  await prisma.customerSession.deleteMany({ where: { customerAccountId: { in: createdCustomerIds } } });
  await prisma.customerAccount.deleteMany({ where: { id: { in: createdCustomerIds } } });
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
npm run prisma:generate
npx tsx --test --test-concurrency=1 backend/test/customer-auth.test.ts
```

Expected: TypeScript/runtime failure because `prisma.customerAccount` and `prisma.customerSession` do not exist.

- [ ] **Step 3: Add the Prisma models and relation**

Add a dedicated customer status enum and models:

```prisma
enum CustomerAccountStatus {
  ACTIVE
  INACTIVE
}

model CustomerAccount {
  id           String                @id @default(cuid()) @db.VarChar(191)
  name         String                @db.VarChar(120)
  email        String                @unique(map: "uq_customer_accounts_email") @db.VarChar(191)
  phone        String?               @db.VarChar(40)
  passwordHash String                @map("password_hash") @db.VarChar(255)
  status       CustomerAccountStatus @default(ACTIVE)
  createdAt    DateTime              @default(now()) @map("created_at")
  updatedAt    DateTime              @updatedAt @map("updated_at")
  sessions     CustomerSession[]
  orders       CustomerOrder[]

  @@index([status], map: "idx_customer_accounts_status")
  @@map("customer_accounts")
}

model CustomerSession {
  id                String          @id @default(cuid()) @db.VarChar(191)
  customerAccountId String          @map("customer_account_id") @db.VarChar(191)
  tokenHash         String          @unique(map: "uq_customer_sessions_token_hash") @map("token_hash") @db.VarChar(64)
  expiresAt         DateTime        @map("expires_at")
  revokedAt         DateTime?       @map("revoked_at")
  lastUsedAt        DateTime?       @map("last_used_at")
  createdAt         DateTime        @default(now()) @map("created_at")
  updatedAt         DateTime        @updatedAt @map("updated_at")
  customerAccount   CustomerAccount @relation(fields: [customerAccountId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@index([customerAccountId], map: "idx_customer_sessions_customer")
  @@index([expiresAt], map: "idx_customer_sessions_expires")
  @@index([revokedAt], map: "idx_customer_sessions_revoked")
  @@map("customer_sessions")
}
```

Add to `CustomerOrder`:

```prisma
customerAccountId String?          @map("customer_account_id") @db.VarChar(191)
customerAccount   CustomerAccount? @relation(fields: [customerAccountId], references: [id], onDelete: SetNull, onUpdate: Cascade)
```

and:

```prisma
@@index([customerAccountId, createdAt], map: "idx_customer_orders_customer_created")
```

- [ ] **Step 4: Create the migration SQL**

Create `database/prisma/migrations/20260822_customer_accounts/migration.sql` with concrete `CREATE TABLE customer_accounts`, `CREATE TABLE customer_sessions`, `ALTER TABLE customer_orders ADD customer_account_id`, indexes, and foreign keys matching the Prisma model. The `customer_orders.customer_account_id` foreign key must use `ON DELETE SET NULL ON UPDATE CASCADE` so deleting an account never deletes a historical order.

- [ ] **Step 5: Regenerate/validate and confirm GREEN**

Run:

```bash
npm run prisma:generate
npm run prisma:validate
npx tsx --test --test-concurrency=1 backend/test/customer-auth.test.ts
```

Expected: Prisma validation passes and the new persistence test passes against the configured test/development database.

- [ ] **Step 6: Commit the schema unit**

```bash
git add database/prisma/schema.prisma database/prisma/migrations/20260822_customer_accounts/migration.sql backend/test/customer-auth.test.ts
git commit -m "feat: add customer account persistence"
```

## Task 2: Implement opaque HttpOnly customer sessions and auth service

**Files:**
- Create: `backend/src/validators/customerAuth.validators.ts`
- Create: `backend/src/services/customerAuthService.ts`
- Create: `backend/src/services/customerSessionCookie.ts`
- Create: `backend/src/middleware/customerAuthMiddleware.ts`
- Expand: `backend/test/customer-auth.test.ts`

**Interfaces:**
- Produces `SafeCustomer`, `registerCustomer`, `loginCustomer`, `createCustomerSession`, `getCustomerFromSessionToken`, `revokeCustomerSession`.
- Produces middleware helpers `requireCustomerAuth`, `optionalCustomerAuth`, `getAuthenticatedCustomer`.
- Cookie name: `ysabelle_customer_session`.
- Session lifetime: 7 days.

- [ ] **Step 1: Add failing service tests for normalization, credentials, inactive accounts, expiration, and revocation**

Add tests that prove:

```ts
await registerCustomer({
  name: "  Maria Customer  ",
  email: "  MARIA@example.com ",
  phone: "09171234567",
  password: "CustomerPass123!"
});
```

persists `maria@example.com`, returns no `passwordHash`, rejects a second registration using `MARIA@EXAMPLE.COM`, and that both a missing account and wrong password throw an `HttpError` with status `401`, code `INVALID_CUSTOMER_CREDENTIALS`, and message `Invalid email or password.`.

Also create a session with an expiration in the past and assert `getCustomerFromSessionToken` rejects it with `CUSTOMER_SESSION_INVALID`; create a revoked session and assert the same public rejection.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-auth.test.ts
```

Expected: imports/functions are missing.

- [ ] **Step 3: Implement validation contracts**

Create `customerAuth.validators.ts`:

```ts
import { z } from "zod";

export const customerRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(40).optional().or(z.literal("")),
  password: z.string().min(8).max(128)
});

export const customerLoginSchema = z.object({
  email: z.string().trim().email().max(191).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
```

- [ ] **Step 4: Implement session token hashing and auth service**

Use `randomBytes(32).toString("base64url")` for the raw session token and SHA-256 for the stored token hash. Reuse `hashPassword` / `verifyPassword` from `passwordHashService.ts`.

Define:

```ts
export type SafeCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export type CustomerSessionResult = {
  customer: SafeCustomer;
  sessionToken: string;
  expiresAt: Date;
};
```

Use a fixed `CUSTOMER_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000`.

`getCustomerFromSessionToken` must query by token hash, include the account, reject missing/revoked/expired sessions and inactive accounts with the same `401 CUSTOMER_SESSION_INVALID`, and update `lastUsedAt` only after validation.

- [ ] **Step 5: Implement cookie helpers**

`customerSessionCookie.ts` must expose:

```ts
export const CUSTOMER_SESSION_COOKIE = "ysabelle_customer_session";
export function readCustomerSessionCookie(request: Request): string | null;
export function setCustomerSessionCookie(response: Response, token: string, expiresAt: Date): void;
export function clearCustomerSessionCookie(response: Response): void;
```

Cookie contract:

```ts
{
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/api",
  expires: expiresAt
}
```

Do not expose the raw session token in JSON responses.

- [ ] **Step 6: Implement required and optional customer middleware**

`requireCustomerAuth` rejects missing/invalid cookie with `401 CUSTOMER_AUTH_REQUIRED`. `optionalCustomerAuth` leaves the request anonymous when no cookie is present but validates and attaches a customer when the cookie exists.

- [ ] **Step 7: Verify GREEN**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-auth.test.ts
npm run typecheck --workspace @ysabellestore/backend
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/validators/customerAuth.validators.ts backend/src/services/customerAuthService.ts backend/src/services/customerSessionCookie.ts backend/src/middleware/customerAuthMiddleware.ts backend/test/customer-auth.test.ts
git commit -m "feat: add secure customer sessions"
```

## Task 3: Expose customer auth HTTP routes and configure credentialed CORS

**Files:**
- Create: `backend/src/controllers/customerAuthController.ts`
- Create: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/app.ts`
- Expand: `backend/test/customer-auth.test.ts`

**Interfaces:**
- `POST /api/customer-auth/register`
- `POST /api/customer-auth/login`
- `GET /api/customer-auth/me`
- `POST /api/customer-auth/logout`

- [ ] **Step 1: Write failing HTTP tests**

Start `createApp()` on an ephemeral port and assert:

1. Register returns `201`, `Set-Cookie` contains `ysabelle_customer_session`, `HttpOnly`, `SameSite=Lax`, and JSON contains safe customer data only.
2. `GET /me` with that cookie returns the same customer.
3. Logout returns `200` and clears the cookie.
4. Reusing the pre-logout cookie against `/me` returns `401`.
5. Missing and wrong-password logins both return `401` with the exact same `INVALID_CUSTOMER_CREDENTIALS` public message.
6. A permitted frontend origin receives `Access-Control-Allow-Credentials: true`.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-auth.test.ts
```

- [ ] **Step 3: Implement controllers and routes**

Controllers parse the Zod schemas, call service functions, set/clear the cookie, and return only:

```ts
{ customer: SafeCustomer }
```

Never return `sessionToken` or `passwordHash`.

- [ ] **Step 4: Mount the router and credentialed CORS**

In `routes/index.ts`:

```ts
router.use("/customer-auth", customerAuthRouter);
```

In `app.ts`, update CORS to:

```ts
cors({
  credentials: true,
  origin(origin, callback) {
    callback(null, origin === undefined || corsOrigins.includes(origin));
  }
})
```

- [ ] **Step 5: Verify GREEN plus existing CORS regression**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-auth.test.ts backend/test/cors.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/customerAuthController.ts backend/src/routes/customerAuth.routes.ts backend/src/routes/index.ts backend/src/app.ts backend/test/customer-auth.test.ts
git commit -m "feat: expose customer authentication API"
```

---

# Phase 2 - Consumer Authentication UI

## Task 4: Add frontend customer-auth test harness, service, and context

**Files:**
- Modify: `frontend/package.json`
- Modify: `package-lock.json`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/types/customerAuth.ts`
- Create: `frontend/src/services/customerAuthService.ts`
- Create: `frontend/src/context/CustomerAuthContext.tsx`
- Test: `frontend/src/context/CustomerAuthContext.test.tsx`

**Interfaces:**
- `CustomerAuthStatus = "loading" | "authenticated" | "unauthenticated"`
- `useCustomerAuth()` exposes `customer`, `status`, `isReady`, `login`, `register`, `logout`, `refreshSession`.
- All customer auth requests use `credentials: "include"`; no customer token is stored in localStorage/sessionStorage.

- [ ] **Step 1: Install frontend test dependencies before writing production code**

```bash
npm install -D --workspace @ysabellestore/frontend vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Add scripts to `frontend/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write the failing context test**

Test startup `/me` restoration, successful login, failed login, and logout using a mocked `global.fetch` that returns the real project API response shape. Assert no customer auth token is written to `localStorage`.

Core expectation:

```ts
expect(result.current.status).toBe("authenticated");
expect(result.current.customer?.email).toBe("customer@example.com");
expect(localStorage.length).toBe(0);
```

- [ ] **Step 3: Run and verify RED**

```bash
npm test --workspace @ysabellestore/frontend -- CustomerAuthContext.test.tsx
```

- [ ] **Step 4: Implement customer auth types/service**

`customerAuthService.ts` calls:

```ts
/api/customer-auth/me
/api/customer-auth/login
/api/customer-auth/register
/api/customer-auth/logout
```

with `credentials: "include"` on every request.

- [ ] **Step 5: Implement `CustomerAuthProvider`**

Startup calls `/me`; a 401 resolves to unauthenticated without showing an error. Login/register set authenticated state only after a successful API response. Logout clears customer state even if the network request fails after the local user intentionally signs out, but surfaces a toast that the server session could not be confirmed revoked.

- [ ] **Step 6: Verify GREEN**

```bash
npm test --workspace @ysabellestore/frontend -- CustomerAuthContext.test.tsx
npm run typecheck --workspace @ysabellestore/frontend
```

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json package-lock.json frontend/src/test/setup.ts frontend/src/types/customerAuth.ts frontend/src/services/customerAuthService.ts frontend/src/context/CustomerAuthContext.tsx frontend/src/context/CustomerAuthContext.test.tsx
git commit -m "feat: add storefront customer auth state"
```

## Task 5: Build Sign In, Create Account, and authenticated header states

**Files:**
- Create: `frontend/src/pages/customer/CustomerLoginPage.tsx`
- Create: `frontend/src/pages/customer/CustomerRegisterPage.tsx`
- Modify: `frontend/src/app/CustomerApp.tsx`
- Modify: `frontend/src/components/customer/CustomerHeader.tsx`
- Modify: `frontend/src/styles/customer.css`
- Test: `frontend/src/pages/customer/CustomerLoginPage.test.tsx`
- Test: `frontend/src/pages/customer/CustomerRegisterPage.test.tsx`

**Interfaces:**
- Public routes: `/login`, `/register`.
- Authenticated header target: `My Account` -> `/account`.
- Guest header target: `Sign In` plus route to `Create Account` from the login page.
- Existing `/staff-login` remains available from the mobile secondary/internal link and must not be mislabeled as customer login.

- [ ] **Step 1: Follow `ysabelle-ui-orchestrator` before component implementation**

Inspect existing shared form/button/input patterns. Use `21st-cli-use` only if no project-native form pattern is strong enough; do not introduce a second visual system.

- [ ] **Step 2: Write failing UI tests**

Login test must cover:

```tsx
await user.type(screen.getByLabelText(/email/i), "customer@example.com");
await user.type(screen.getByLabelText(/password/i), "wrong-password");
await user.click(screen.getByRole("button", { name: /sign in/i }));
expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
```

Register test covers name/email/phone/password, password visibility control, disabled/submitting state, and successful navigation to `/account`.

- [ ] **Step 3: Run and verify RED**

```bash
npm test --workspace @ysabellestore/frontend -- CustomerLoginPage.test.tsx CustomerRegisterPage.test.tsx
```

- [ ] **Step 4: Implement `CustomerLoginPage`**

Requirements: semantic labels, `autoComplete="email"` and `autoComplete="current-password"`, show/hide password button with accessible label, server error region with `role="alert"`, loading button text, link to `/register`, and no OWNER/STAFF language.

- [ ] **Step 5: Implement `CustomerRegisterPage`**

Use `autoComplete="name"`, `email`, `tel`, and `new-password`; client validation mirrors server boundaries but server remains authoritative. Do not add confirm-password unless required by an existing repo pattern; a single correctly labeled password field plus visibility control is sufficient for this sprint.

- [ ] **Step 6: Wire routes/provider/header**

Wrap the customer app with `CustomerAuthProvider` inside the storefront branch and add:

```ts
/login
/register
/account
```

For authenticated visitors reaching `/login` or `/register`, navigate to `/account`. For guests reaching `/account`, navigate to `/login` after auth startup resolves.

Header rules:

```text
Guest: Home | Shop | About Us | Sign In | Cart
Authenticated: Home | Shop | About Us | My Account | Cart
```

- [ ] **Step 7: Add storefront-native CSS using existing tokens**

Use `--customer-primary`, `--customer-surface-raised`, `--customer-line`, `--customer-focus`, existing radii, and existing typography variables. Verify 320px/mobile, tablet, and desktop without fixed-height form containers.

- [ ] **Step 8: Verify GREEN**

```bash
npm test --workspace @ysabellestore/frontend
npm run lint --workspace @ysabellestore/frontend
npm run typecheck --workspace @ysabellestore/frontend
npm run build --workspace @ysabellestore/frontend
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/customer/CustomerLoginPage.tsx frontend/src/pages/customer/CustomerRegisterPage.tsx frontend/src/app/CustomerApp.tsx frontend/src/components/customer/CustomerHeader.tsx frontend/src/styles/customer.css frontend/src/pages/customer/CustomerLoginPage.test.tsx frontend/src/pages/customer/CustomerRegisterPage.test.tsx
git commit -m "feat: add customer sign in and registration UI"
```

---

# Phase 3 - E-commerce Account Integration

## Task 6: Link authenticated checkout orders and expose customer-owned order history

**Files:**
- Create: `backend/src/controllers/customerAccountController.ts`
- Create: `backend/src/routes/customerAccount.routes.ts`
- Modify: `backend/src/routes/index.ts`
- Modify: `backend/src/routes/storefront.routes.ts`
- Modify: `backend/src/controllers/storefrontController.ts`
- Modify: `backend/src/services/storefrontService.ts`
- Test: `backend/test/customer-order-account.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- `GET /api/customer-account/orders` requires customer auth.
- `POST /api/storefront/orders` stays public but uses `optionalCustomerAuth`.
- `createStorefrontOrder(input, { customerAccountId?: string })` persists ownership when authenticated.

- [ ] **Step 1: Write failing ownership/isolation tests**

Create two customer accounts A/B, create an authenticated order for A, then assert:

```ts
assert.equal(order.customerAccountId, customerA.id);
```

Request A's order history and assert the order is present. Request B's order history and assert A's order is absent. Create a guest order and assert `customerAccountId === null`.

- [ ] **Step 2: Run and verify RED**

```bash
npx tsx --test --test-concurrency=1 backend/test/customer-order-account.test.ts
```

- [ ] **Step 3: Attach optional auth to order creation**

Route:

```ts
storefrontRouter.post("/orders", optionalCustomerAuth, createStorefrontOrderController);
```

Controller passes:

```ts
const customer = getAuthenticatedCustomer(request);
await createStorefrontOrder(body, { customerAccountId: customer?.id });
```

Service writes `customerAccountId` into `customerOrder.create` while leaving guest orders null.

- [ ] **Step 4: Implement customer account order history**

`GET /api/customer-account/orders` uses `requireCustomerAuth` and queries strictly:

```ts
where: { customerAccountId: customer.id }
```

Order by `createdAt desc`, include item product names, and return only storefront-safe order fields. Do not accept an arbitrary customer id from route/query/body.

- [ ] **Step 5: Mount route and update backend test script**

Add `/customer-account` to `routes/index.ts` and append `test/customer-auth.test.ts`, `test/customer-order-account.test.ts`, and `test/auth-security.test.ts` to the explicit backend test command.

- [ ] **Step 6: Verify GREEN including guest regression**

```bash
npm test --workspace @ysabellestore/backend
npm run typecheck --workspace @ysabellestore/backend
```

The existing `storefront orders remain pending and do not deduct inventory` test must still pass unchanged in intent.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/customerAccountController.ts backend/src/routes/customerAccount.routes.ts backend/src/routes/index.ts backend/src/routes/storefront.routes.ts backend/src/controllers/storefrontController.ts backend/src/services/storefrontService.ts backend/test/customer-order-account.test.ts backend/package.json
git commit -m "feat: link customer accounts to storefront orders"
```

## Task 7: Add My Account, order history, and authenticated checkout UX

**Files:**
- Create: `frontend/src/pages/customer/CustomerAccountPage.tsx`
- Test: `frontend/src/pages/customer/CustomerAccountPage.test.tsx`
- Modify: `frontend/src/pages/customer/CheckoutPage.tsx`
- Modify: `frontend/src/services/storefrontService.ts`
- Modify: `frontend/src/types/storefront.ts`
- Modify: `frontend/src/styles/customer.css`

**Interfaces:**
- `fetchCustomerOrders()` is called only for authenticated account UI.
- `placeStorefrontOrder()` uses `credentials: "include"`, allowing the backend to link the order when a customer session exists while still working for guests.

- [ ] **Step 1: Write failing account-page test**

Authenticated state with two orders renders order number, status, total, created date, and item summary. Empty response renders an explicit empty state. 401/session expiry moves auth state to unauthenticated and presents a sign-in path.

- [ ] **Step 2: Write failing checkout prefill test**

When customer context contains:

```ts
{
  name: "Maria Customer",
  email: "maria@example.com",
  phone: "09171234567"
}
```

checkout inputs start with those values, remain editable for this specific order, and submitting still sends the existing storefront order shape.

- [ ] **Step 3: Run and verify RED**

```bash
npm test --workspace @ysabellestore/frontend -- CustomerAccountPage.test.tsx
```

- [ ] **Step 4: Implement account page and order service**

Add `fetchCustomerOrders()` with `credentials: "include"`. The page includes account identity, Logout action, and order history. It must not expose internal OWNER/STAFF navigation.

- [ ] **Step 5: Update checkout**

Use authenticated account data as default contact values. Preserve current required `customerName` and `customerPhone` and optional `customerEmail`. Keep guest behavior identical when no customer is authenticated.

- [ ] **Step 6: Ensure order creation includes credentials**

Update `placeStorefrontOrder`:

```ts
apiClient.request<StorefrontOrder, unknown>("/api/storefront/orders", {
  method: "POST",
  credentials: "include",
  json: input
});
```

- [ ] **Step 7: Verify GREEN**

```bash
npm test --workspace @ysabellestore/frontend
npm run lint --workspace @ysabellestore/frontend
npm run typecheck --workspace @ysabellestore/frontend
npm run build --workspace @ysabellestore/frontend
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/customer/CustomerAccountPage.tsx frontend/src/pages/customer/CustomerAccountPage.test.tsx frontend/src/pages/customer/CheckoutPage.tsx frontend/src/services/storefrontService.ts frontend/src/types/storefront.ts frontend/src/styles/customer.css
git commit -m "feat: add customer account order history"
```

---

# Phase 4 - Security and Final Verification

## Task 8: Harden internal/public auth boundaries and add real login throttling

**Files:**
- Create: `backend/src/middleware/authRateLimit.ts`
- Modify: `backend/src/services/authService.ts`
- Modify: `backend/src/routes/auth.routes.ts`
- Modify: `backend/src/routes/customerAuth.routes.ts`
- Modify: `backend/src/security/security.constants.ts`
- Test: `backend/test/auth-security.test.ts`

**Interfaces:**
- Internal bearer tokens carry `tokenType: "internal"` and `getUserFromToken` rejects any token without that exact discriminator.
- Customer auth remains opaque-cookie based and cannot be consumed by `requireAuth`.
- Login throttling applies separately to internal login and customer login/register.

- [ ] **Step 1: Write failing internal token-boundary tests**

Test an internal token without `tokenType: "internal"` and assert `getUserFromToken` rejects it. Test a correctly signed internal token remains valid. Also prove a customer cookie alone cannot access a representative protected internal API such as `/api/inventory`.

- [ ] **Step 2: Write failing account-enumeration test for internal login**

Missing internal account and wrong password must both become:

```json
{
  "success": false,
  "message": "Invalid email or password.",
  "error": { "code": "INVALID_CREDENTIALS" }
}
```

with HTTP 401.

- [ ] **Step 3: Write failing rate-limit integration tests**

Configure deterministic test limits through exported middleware factory options. The test should make the allowed number of attempts and assert the next request returns `429` plus `Retry-After`.

- [ ] **Step 4: Implement a small in-process auth limiter without affecting normal API traffic**

Create a factory:

```ts
export function createAuthRateLimit(options: {
  windowMs: number;
  maxAttempts: number;
  scope: string;
}): RequestHandler;
```

Key by `scope + request.ip`. Store only count/window timestamp; never store passwords or raw credentials. Apply stricter route-level policies instead of the existing global placeholder:

```text
Internal login: 10 attempts / 15 minutes / IP
Customer login: 10 attempts / 15 minutes / IP
Customer register: 5 attempts / 15 minutes / IP
```

Return `429 AUTH_RATE_LIMITED` and `Retry-After`.

- [ ] **Step 5: Add internal token discriminator and generic missing-account error**

Internal token payload becomes:

```ts
{
  tokenType: "internal",
  email: user.email,
  role: user.role
}
```

`getUserFromToken` must require `verified.tokenType === "internal"`. Change the missing-account login branch from `404 ACCOUNT_NOT_FOUND` to the same `401 INVALID_CREDENTIALS` used for wrong passwords.

- [ ] **Step 6: Fix trusted-device expiration while touching auth security**

Set a finite trusted-device expiry (30 days) on creation and reject an expired trusted device before session restoration. Existing rows with `expiresAt === null` should be treated as requiring re-authentication rather than permanent trust. Add test coverage for expired/null expiry.

- [ ] **Step 7: Verify GREEN**

```bash
npx tsx --test --test-concurrency=1 backend/test/auth-security.test.ts backend/test/customer-auth.test.ts backend/test/customer-order-account.test.ts
npm test --workspace @ysabellestore/backend
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/middleware/authRateLimit.ts backend/src/services/authService.ts backend/src/routes/auth.routes.ts backend/src/routes/customerAuth.routes.ts backend/src/security/security.constants.ts backend/test/auth-security.test.ts
git commit -m "security: harden Sprint 7 authentication"
```

## Task 9: Run full Sprint 7 verification, security review, and acceptance flow

**Files:**
- Review all Sprint 7 changed files against `docs/superpowers/specs/2026-08-22-customer-authentication-design.md`.
- Update documentation only if verification exposes a real behavior/contract change.

- [ ] **Step 1: Run database/code generation checks**

```bash
npm run prisma:generate
npm run prisma:validate
```

- [ ] **Step 2: Run backend and frontend automated tests**

```bash
npm test --workspace @ysabellestore/backend
npm test --workspace @ysabellestore/frontend
```

Expected: zero failures.

- [ ] **Step 3: Run repository lint/typecheck/build**

```bash
npm run lint
npm run typecheck
npm run build
```

Expected: exit 0 for all commands.

- [ ] **Step 4: Run repository security/guardrail checks**

```bash
npm run security:audit
npm run test:guardrails
npm run verify:code
```

Then run the project-required Tier 3 final verification command appropriate to the branch state, preferring:

```bash
npm run prepush:local
```

Do not weaken this final check merely to save time/tokens. If an external environment prerequisite blocks it, report the exact blocker and preserve the successful lower-level evidence.

- [ ] **Step 5: Manually/runtime verify the two required user journeys**

Authenticated:

```text
Register -> Login/session active -> Shop -> Cart -> Checkout -> Account-linked Order -> My Account -> Order History -> Logout -> Login -> same Order History
```

Guest:

```text
Shop -> Cart -> Checkout -> Guest Order -> Order Success
```

Also explicitly verify a customer cannot open internal OWNER/STAFF APIs using only the customer session cookie.

- [ ] **Step 6: Run a security diff review against Sprint 6**

Review `sprint/v0.6/sprint-6...sprint/v0.7/sprint-7` with the security-diff workflow. Resolve every Critical and Important finding attributable to Sprint 7 before completion. Re-run affected tests after every security fix.

- [ ] **Step 7: Request final code review**

Review the complete Sprint 7 diff against the approved design and this implementation plan. Fix all Critical/Important issues, re-run relevant verification, then re-run the full completion commands if code changed.

- [ ] **Step 8: Final acceptance checklist**

Confirm with fresh evidence:

```text
[ ] Guest checkout still works
[ ] Customer registration works
[ ] Customer login/logout/session restore work
[ ] No customer auth token is stored in browser storage
[ ] Customer sessions expire and revoke server-side
[ ] Invalid credentials do not enumerate accounts
[ ] Login/register throttling returns 429 after policy limit
[ ] Customer A cannot view Customer B orders
[ ] Customer credential cannot authorize OWNER/STAFF routes
[ ] Existing OWNER/STAFF login still works
[ ] Frontend responsive/focus/error/loading states verified
[ ] Backend tests pass
[ ] Frontend tests pass
[ ] lint/typecheck/build pass
[ ] Tier 3 repository verification passes or exact external blocker is documented
[ ] Security diff has no unresolved Critical/Important Sprint 7 finding
```

Only after every applicable item has fresh evidence may Sprint 7 customer authentication be described as complete.
