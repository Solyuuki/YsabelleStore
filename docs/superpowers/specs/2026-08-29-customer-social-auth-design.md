# Customer Social Authentication Design

## Goal

Add production-grade Google and Facebook authentication for CUSTOMER accounts while preserving the existing username/email/Philippine-mobile plus password flow, email-OTP recovery, customer cookie sessions, and complete isolation from OWNER/STAFF bearer authentication.

## Scope

This is Sprint 9 Phase 6 and applies only to customer authentication on `m1/v0.9/feat/customer-social-auth`.

Included:

- Continue with Google.
- Continue with Facebook.
- Social sign-in and first-time social registration.
- Safe provider-identity persistence and account linking.
- Duplicate-customer prevention for an already registered email.
- Browser and packaged Electron flows.
- Cancellation, invalid callback, provider failure, inactive-account, missing-email, link-conflict, replay, and expiry handling.
- Automated security/regression coverage plus manual live-provider QA.

Not included:

- Phone OTP/passwordless phone authentication; that is Phase 7.
- Shipping-address or delivery-contact verification; that is Phase 8.
- Apple, Microsoft, or additional providers.
- Social authentication for OWNER or STAFF.
- Provider API access beyond identity authentication.

## Architecture

OAuth is backend-owned. React never exchanges authorization codes or stores provider tokens. Google/Facebook redirects return to backend customer-auth callbacks, the backend validates provider identity, resolves one `CustomerAccount`, and then creates the same finite `CustomerSession` already used by password login.

Web uses the existing HttpOnly customer session cookie. Electron opens the user's default system browser and returns through `ysabellestore://auth/callback` using a short-lived one-use handoff code bound to a verifier held by the Electron main process. The customer session token never appears in a deep-link URL and is never exposed to the renderer.

## Provider Protocols

### Google

- Authorization Code flow.
- Scopes: `openid email profile` only.
- PKCE S256.
- Cryptographic `state` and OpenID Connect `nonce`.
- Server-side token exchange.
- Validate ID-token signature against Google's JWKS plus issuer, audience, expiry, nonce, subject, email, and `email_verified`.
- An unverified or missing Google email cannot create or email-link a customer.

### Facebook

- Facebook Login Authorization Code flow.
- Scopes: `public_profile,email` only.
- Cryptographic `state` and PKCE S256 where supported by the configured login flow.
- Server-side code exchange.
- Validate returned access token against the configured Facebook App ID before fetching `id,name,email`.
- Provider access tokens are discarded after identity resolution.
- Missing email produces a controlled failure rather than an invented address.

## Secret and Environment Contract

Real secrets are local/host secrets only and must never be committed, returned, logged, exposed in `VITE_*`, or embedded in Electron.

Backend variables:

```env
CUSTOMER_OAUTH_PUBLIC_BACKEND_URL=http://localhost:3001
CUSTOMER_OAUTH_TRANSACTION_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
FACEBOOK_OAUTH_APP_ID=
FACEBOOK_OAUTH_APP_SECRET=
FACEBOOK_GRAPH_API_VERSION=v26.0
```

Electron variable:

```env
ELECTRON_API_BASE_URL=http://localhost:3001
```

Provider configuration may be absent during ordinary development/test startup. Attempting to start an unconfigured provider must fail closed with a sanitized provider-unavailable outcome.

`CUSTOMER_OAUTH_TRANSACTION_KEY` is server-only key material used to protect recoverable OAuth transaction secrets at rest.

## Data Model

Add enum `CustomerSocialProvider` with `GOOGLE` and `FACEBOOK`, plus transport enum `CustomerOAuthTransport` with `WEB` and `ELECTRON`.

Change `CustomerAccount.passwordHash` to nullable. Existing password accounts retain their hash. Social-only accounts use `null`. Password login for a null hash must return the exact same generic invalid-credentials response as a wrong password or missing account. Existing recovery may establish the first local password.

### CustomerSocialIdentity

Permanent provider-to-customer mapping:

- `id`
- `customerAccountId`
- `provider`
- `providerSubject`
- `providerEmail` nullable
- `providerEmailVerified`
- timestamps

Constraints:

- unique `(provider, providerSubject)`
- unique `(customerAccountId, provider)`
- cascade delete from customer

### CustomerOAuthTransaction

Short-lived authorization transaction:

- provider and transport
- hashed state
- hashed browser binding when web
- encrypted PKCE verifier
- hashed nonce binding for Google plus protected nonce value needed for validation
- Electron handoff challenge when applicable
- safe return target
- expiry and consumed timestamp

Lifetime: 10 minutes. State and browser-binding raw values are never persisted.

### CustomerSocialLinkIntent

Short-lived proof requirement for a provider identity whose email already belongs to a customer account. The raw intent token is never persisted. Completion requires an authenticated customer session matching the intended customer.

### CustomerOAuthHandoff

Electron-only one-use exchange:

- hashed handoff code
- customer account id
- verifier challenge
- expiry and consumed timestamp

Lifetime: 90 seconds. Redemption is conditional and single-use.

## Customer Resolution Rules

1. If `(provider, providerSubject)` already exists, sign into that linked active customer.
2. If no identity exists and the verified/usable provider email has no `CustomerAccount`, transactionally create one social-only `CustomerAccount` and one `CustomerSocialIdentity`.
3. If no identity exists but the email already belongs to a customer, do not create another customer and do not silently link. Produce `SOCIAL_AUTH_LINK_REQUIRED`.
4. Web link completion requires the customer to authenticate the exact target account using password/recovery or an already linked provider, then the backend attaches the pending identity.
5. For Electron, an authenticated social-auth start may link a new provider only to the already authenticated same customer; an unauthenticated email collision returns link-required and the customer must authenticate before retrying.
6. A provider identity already belonging to another customer returns a link conflict.
7. Inactive customers cannot obtain a new customer session.
8. Internal `User`/OWNER/STAFF records are never consulted for customer social account creation or linking.

Database unique constraints are authoritative for concurrency races. Prisma uniqueness conflicts must be converted to deterministic social-auth outcomes, not raw 500 responses.

## Web Flow

1. Customer selects Google or Facebook.
2. Browser navigates to `GET /api/customer-auth/social/:provider/start`.
3. Backend creates a 10-minute OAuth transaction and an HttpOnly browser-binding cookie, then redirects to provider.
4. Provider redirects to `GET /api/customer-auth/social/:provider/callback`.
5. Backend validates state, binding, expiry, PKCE/code exchange, and provider identity.
6. Backend resolves the customer using the rules above.
7. On success, backend creates existing `CustomerSession`, sets existing customer session cookie, consumes transaction, clears OAuth binding, and redirects to a fixed allowed customer destination.
8. On cancellation/failure/link-required, backend redirects to login/register with only a sanitized status code; raw provider payloads, provider codes, emails, and tokens never appear in redirect URLs.

Allowed return targets are an explicit customer-auth allow-list; arbitrary redirect URLs are rejected.

## Link Completion

When web OAuth encounters an existing customer email, backend creates a short-lived link intent and sets an HttpOnly link-intent cookie. The UI asks the customer to sign into the existing Ysabelle account. `POST /api/customer-auth/social/link/complete` requires both the authenticated customer session and the pending link intent, and verifies the customer id matches before attaching the provider identity. Link intent is consumed exactly once.

## Electron Flow

Packaged Electron keeps `contextIsolation`, `nodeIntegration: false`, `sandbox`, and `webSecurity` unchanged.

1. Renderer invokes a narrow social-auth preload method.
2. Electron main creates a private random verifier and sends only its S256 challenge to `POST /api/customer-auth/social/electron/start` along with provider. If a customer cookie already exists, main includes it so backend can bind an authenticated link attempt.
3. Backend returns an opaque provider authorization URL; main opens it using the OS default browser.
4. Provider callback resolves at backend.
5. Success redirects system browser to `ysabellestore://auth/callback?code=<one-use-code>`.
6. Electron main receives the custom protocol, redeems code plus private verifier at `POST /api/customer-auth/social/electron/redeem`, and receives the customer session token over the direct HTTPS response.
7. Main writes the token to Electron's cookie store as HttpOnly. Production packaged cross-site `file://` renderer access uses a secure cookie configuration compatible with credentialed API requests.
8. Renderer receives only a sanitized success/failure event and refreshes `/api/customer-auth/me`.

The custom protocol is registered in Electron Builder and handled with single-instance/deep-link lifecycle logic. Provider login is never embedded in an application-controlled browser window.

## Public Error States

Sanitized outcomes:

- `SOCIAL_AUTH_CANCELLED`
- `SOCIAL_AUTH_INVALID_CALLBACK`
- `SOCIAL_AUTH_PROVIDER_ERROR`
- `SOCIAL_AUTH_PROVIDER_UNAVAILABLE`
- `SOCIAL_AUTH_EMAIL_REQUIRED`
- `SOCIAL_AUTH_LINK_REQUIRED`
- `SOCIAL_AUTH_LINK_CONFLICT`
- `SOCIAL_AUTH_ACCOUNT_UNAVAILABLE`
- `SOCIAL_AUTH_HANDOFF_INVALID`

No error response exposes provider access tokens, authorization codes, client secrets, session tokens, database ids, or raw provider error payloads.

## UI

Replace the current Quick Sign coming-soon surface with two real actions:

- Continue with Google
- Continue with Facebook

Show them on customer login and register. Preserve the existing password form, Forgot password, username/email/mobile support, account creation form, current premium blue-purple-pink palette, accessibility labels, keyboard behavior, mobile layout, and loading/disabled states.

## Rate Limiting and Response Security

Add dedicated limits for social start, link completion, Electron start, and Electron redeem. Existing no-store/no-cache protection remains active. Private identity keys use the existing HMAC-derived limiter-key pattern where an identity-derived key is needed.

## Required Tests

Automated coverage must prove:

- nullable password does not disclose social-only account existence;
- social-only recovery can establish a local password;
- new and returning Google/Facebook identities converge on the correct customer;
- existing email requires ownership proof and creates no duplicate;
- wrong authenticated customer cannot complete a link;
- inactive accounts are denied;
- provider subject uniqueness and simultaneous first-login races cannot duplicate identities/customers;
- invalid/expired/replayed state, nonce, transaction and handoff fail closed;
- unverified Google email and missing provider email are rejected safely;
- provider token validation checks audience/app identity;
- web success sets the existing customer cookie without exposing its raw token in JSON;
- customer cookie and internal bearer boundaries remain unchanged;
- Electron verifier mismatch, replay, and >90-second handoff fail;
- frontend contains real Google/Facebook actions on login/register and no coming-soon Quick Sign state;
- Electron bridge exposes only narrow social-auth methods and custom protocol registration exists;
- logs and redirect URLs contain no provider/session secrets.

Live manual acceptance must test one real Google account and one real Facebook account after provider-console credentials and redirect URIs are configured. Automated tests use injected/fake provider clients and must not depend on real provider secrets or external network access.

## Acceptance Criteria

Phase 6 is complete only when Google and Facebook work for customer sign-in/registration, account collisions cannot create silent duplicates/takeovers, password/recovery auth still passes, OWNER/STAFF separation still passes, browser and packaged Electron flows are covered, secrets remain outside source control, automated high-risk verification is green on the exact feature head, and real-provider manual QA is ready to run using environment credentials.