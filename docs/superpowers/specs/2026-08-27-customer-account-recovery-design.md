# Customer Account Recovery Design

## Goal

Add a production-grade customer password recovery flow to YsabelleStore that matches the current premium customer-auth experience and securely resets a forgotten password without exposing whether an account exists.

## Scope

This work applies only to the customer authentication surface on the Phase 4 account-security lineage. It must remain isolated from `sprint/v0.9/sprint-9` until separately approved.

Included:

- `Forgot password?` entry point on customer login.
- New premium `/account-recovery` customer route.
- Recovery request using the same identifier model as login: username, email, or Philippine mobile number.
- Email delivery through Resend to the registered customer email address.
- Single-use, expiring password-reset tokens stored only as SHA-256 hashes.
- Password reset completion that revokes all existing customer sessions.
- Enumeration resistance, rate limiting, no-cache behavior, token secrecy, concurrency protection, and regression coverage.
- Responsive/accessibility behavior aligned with current customer auth pages.

Not included:

- SMS OTP delivery.
- Phone-number ownership verification or phone-number editing.
- Social login / Quick Sign implementation.
- Automatic sign-in after a password reset.
- Any unrelated storefront, POS, inventory, forecasting, or Sprint 9 changes.

## UX and Visual Design

The recovery experience uses the same `CustomerAuthFrame` and current Ysabelle Store premium palette: blue -> purple -> pink gradients, soft shader lighting, glass-like auth surfaces, rounded controls, restrained iconography, and the same typography rhythm used by login/register.

### Login entry point

Add a visible `Forgot password?` action near the password field. It must look intentional and premium, not like a browser-default anchor or generic template addition.

### Recovery route

`/account-recovery` supports four UI states inside the same page shell:

1. **Identify account** — enter username, email, or mobile number.
2. **Check your email** — always show the same generic success message after a syntactically valid request.
3. **Set new password** — when a reset token is present in the URL, show new-password and confirm-password fields.
4. **Reset complete** — confirm the password was changed and direct the customer back to `/login`.

The page must preserve keyboard navigation, semantic labels, `aria-invalid`, status/error messaging, disabled/loading states, and mobile-safe layout behavior.

## Public API Contract

### `POST /api/customer-auth/recovery/request`

Request body:

```json
{
  "identifier": "username, email, or mobile"
}
```

Behavior:

- Normalize/classify the identifier exactly as customer login does.
- Do not disclose whether an account exists, is active, or has a registered email.
- For a syntactically valid request, return HTTP 200 with the same public message regardless of lookup outcome.
- If an active customer is found, create a reset token and attempt to send the recovery email.
- Do not return the raw reset token in the API response.
- Do not log the raw reset token.

Public response message:

`If an eligible account exists, recovery instructions have been sent to its registered email.`

### `POST /api/customer-auth/recovery/reset`

Request body:

```json
{
  "token": "raw-token-from-email-link",
  "newPassword": "new password"
}
```

Behavior:

- Validate token shape and password length.
- Hash the supplied token with SHA-256 before database lookup.
- Require an unused, unexpired token for an active customer.
- Atomically update the password hash, consume the token, invalidate other outstanding reset tokens for that customer, and revoke all active customer sessions.
- Do not create a replacement session. Customer signs in again with the new password.
- Invalid, expired, already-used, or concurrently consumed tokens return one generic public reset error.

Generic reset error:

`This recovery link is invalid or expired. Request a new one.`

## Data Model

Add a dedicated `CustomerPasswordResetToken` model related to `CustomerAccount`.

Required fields:

- `id` — cuid primary key.
- `customerAccountId` — relation to `CustomerAccount`, cascade delete.
- `tokenHash` — unique 64-character SHA-256 hex digest.
- `expiresAt` — absolute expiration time.
- `usedAt` — nullable timestamp marking successful consumption.
- `createdAt` — creation timestamp.

Indexes:

- customer account id.
- expiration time.
- used time if supported by the existing indexing style.

The raw reset token must never be persisted.

## Token Lifecycle

- Generate with `randomBytes(32).toString("base64url")`.
- Store only `sha256(rawToken)`.
- Lifetime: exactly 15 minutes from creation.
- One successful reset may consume a token.
- Creating a new recovery token for the same account invalidates any previously unused reset tokens for that customer.
- Two concurrent reset attempts with the same raw token must not both succeed.

## Email Delivery

Use Resend as the transactional email provider.

Runtime configuration:

- `RESEND_API_KEY` — secret; never committed.
- `CUSTOMER_RECOVERY_FROM_EMAIL` — configured sender address.
- `FRONTEND_URL` — existing application origin used to build the recovery link.

The backend owns provider interaction through a small dedicated recovery-email service so authentication logic does not directly depend on Resend internals.

Email content must include:

- Ysabelle Store identity.
- A clear password-reset action linking to `${FRONTEND_URL}/account-recovery?token=<raw-token>`.
- 15-minute expiration notice.
- A statement that the message can be ignored if the customer did not request a reset.

No password, session token, database identifier, or internal account metadata appears in the email.

## Delivery Failure Policy

The request endpoint keeps the same generic public 200 response for enumeration resistance. If email delivery fails for an existing account, the server must not expose that fact to the requester. Provider errors may be recorded server-side without including the raw reset token or sensitive customer data.

A reset token that could not be delivered must not create a usable orphan recovery path. The service must either persist only after successful delivery or invalidate/remove the newly created token when delivery fails.

## Rate Limiting

Add recovery-specific limits in the existing auth rate-limit system.

### Recovery request IP limit

- Window: 15 minutes.
- Maximum: 10 requests.
- Scope: `customer-recovery-request`.

### Recovery identifier limit

- Window: 15 minutes.
- Maximum: 3 requests per normalized identity.
- Scope: `customer-recovery-identifier`.
- Use the existing private HMAC-derived rate-limit key pattern so normalized identifiers are not stored in limiter keys.

### Reset attempt IP limit

- Window: 15 minutes.
- Maximum: 10 requests.
- Scope: `customer-recovery-reset`.

The existing sensitive-response no-cache and allowed-origin protections apply to both recovery endpoints.

## Account Enumeration Resistance

The recovery-request endpoint must not reveal whether:

- the identifier exists;
- the account is inactive;
- the account has an email;
- email delivery succeeded.

Equivalent valid requests should use the same HTTP status and public message. The implementation should avoid obvious fast-path differences where practical by preserving the current authentication service's security style.

## Password Reset Transaction

A successful reset occurs in one database transaction:

1. Find the reset token by token hash and verify it is unused and unexpired.
2. Confirm the related customer is active.
3. Hash the new password using the existing password hash service.
4. Atomically mark the selected reset token used using a conditional update that can succeed only once.
5. Update the customer password hash.
6. Mark any other unused reset tokens for that customer as used/invalidated.
7. Revoke all active `CustomerSession` rows for that customer.

If the conditional token consumption does not affect exactly one row, fail with the generic invalid/expired recovery-link error. This is the concurrency guard.

## Frontend Service Contract

Add focused customer-auth service functions:

```ts
requestCustomerPasswordRecovery(identifier: string): Promise<void>
resetCustomerPassword(input: { token: string; newPassword: string }): Promise<void>
```

The frontend never receives account existence information or a recovery token from the request endpoint.

## Routing

Add `account-recovery` to the customer auth route classification. The route is public whether the customer is authenticated or unauthenticated, but authenticated customers may still be redirected to `/account` from login/register only. The recovery route itself must remain reachable from an emailed reset link even if an unrelated customer session exists in the browser.

## Error Handling

- Invalid request body: HTTP 400 with the repository's standard validation envelope.
- Rate limited: existing HTTP 429 auth rate-limit behavior and `Retry-After` header.
- Recovery request lookup/delivery outcome: generic HTTP 200 for syntactically valid requests.
- Invalid/expired/used reset token: generic recovery-link error.
- Provider errors: server-side only; never expose provider names, API details, or account existence.

## Security Constraints

- Never commit `RESEND_API_KEY` or any provider secret.
- Never return or log raw reset tokens.
- Never store raw reset tokens.
- Never expose account existence through recovery request responses.
- Reset tokens expire after exactly 15 minutes.
- Successful reset revokes every existing customer session.
- Successful reset does not auto-login the customer.
- Concurrent consumption of one reset token allows at most one success.
- Password policy remains the current customer password policy unless separately changed.

## Testing Strategy

### Backend service tests

Cover:

- request by username, email, and mobile reaches the same account;
- missing/inactive accounts receive the same public request outcome;
- persisted token is hashed and differs from raw token;
- token expires at 15 minutes;
- new recovery request invalidates prior unused token;
- reset changes the password and old password no longer authenticates;
- all prior sessions are revoked after reset;
- reset token is single-use;
- expired/used/unknown tokens produce the same public error;
- two concurrent resets with one token produce exactly one success;
- delivery failure invalidates/removes the newly issued token;
- no raw reset token appears in persisted fields.

### HTTP tests

Cover:

- allowed-origin enforcement;
- request/reset rate limits;
- generic request response for existing and missing identifiers;
- validation errors;
- successful reset response;
- invalid reset response does not disclose token state.

### Frontend contract tests

Cover:

- login exposes `Forgot password?`;
- `/account-recovery` route resolves;
- recovery page uses existing auth shell/palette classes;
- identifier request state transitions to generic check-email state;
- token route shows password/confirmation inputs;
- mismatched passwords do not submit;
- successful reset shows completion state and login action;
- responsive/accessibility contract markers remain present.

### Final verification

Because this is authentication/security work, run Tier 3 verification before promotion: focused recovery tests, existing Phase 3 auth regressions, existing Phase 4 account-security and concurrency regressions, workspace tests, typecheck, lint, format check, builds, guardrails, production dependency audit, version/status checks, and CI/governance checks on the exact final head.

## Deployment / Configuration

Add non-secret placeholders to `.env.example`:

```env
RESEND_API_KEY=
CUSTOMER_RECOVERY_FROM_EMAIL=
```

The implementation must fail closed for real email delivery when provider configuration is missing. Development/test code may inject a test mailer at the service boundary; production code must not silently expose reset tokens as a fallback.

## Acceptance Criteria

The feature is complete only when:

1. Login visibly offers a premium `Forgot password?` path.
2. `/account-recovery` visually matches the established customer-auth system.
3. Username, email, or mobile can initiate recovery without account enumeration.
4. Registered customers receive a real Resend recovery email when provider configuration is present.
5. Reset links are single-use, hashed-at-rest, and expire after 15 minutes.
6. Successful reset changes the password, revokes all existing sessions, and requires a fresh login.
7. Concurrent use of the same reset token cannot produce two successful password changes.
8. Secrets and raw tokens are never committed, persisted, returned, or logged.
9. Required tests and Tier 3 verification are green on the exact feature head.
10. No unrelated Sprint 9, storefront, POS, inventory, or forecasting behavior changes are introduced.
