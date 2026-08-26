# Customer Auth Security & Privacy Foundation Design

## Scope

This phase hardens the existing customer email/password authentication before any username/mobile identifier expansion, social login, phone OTP, shipping verification, or Staff/Owner re-theme work. The customer and internal OWNER/STAFF realms remain separate.

## Security Invariants

1. Authentication failures must not reveal whether a customer account exists, is inactive, or has a wrong password.
2. Password verification work for a missing/inactive account must follow an equivalent expensive path to reduce timing-based account enumeration.
3. Password hashes must use a memory-hard configuration that is stronger than the current legacy scrypt profile, while existing hashes remain verifiable and can be upgraded after a successful login.
4. Customer login and registration endpoints must have explicit anti-automation controls.
5. Rate-limit storage must not persist raw email addresses, phone numbers, passwords, OTPs, session tokens, or other customer secrets.
6. Authentication/session responses must be non-cacheable.
7. Customer session cookies remain HttpOnly, SameSite=Lax, scoped to `/api`, Secure in production, revocable server-side, and stored only as hashes in the database.
8. State-changing customer auth requests must reject unapproved browser origins instead of relying on CORS response headers alone.
9. Request logging must remain metadata-only and must not log credentials or authentication tokens.
10. Internal OWNER/STAFF authentication behavior must remain unchanged by this phase.

## Threat Model

### Primary attacker capabilities

- Automated password guessing and credential stuffing from one or many IP addresses.
- Automated customer-account creation to pollute data or prepare abuse.
- Account-enumeration attempts using response text, status codes, and timing differences.
- Cross-site requests attempting login/logout/session manipulation.
- Replay or theft attempts against customer session tokens.
- Resource-exhaustion attempts that abuse memory-hard password hashing.

### Trust boundaries

- Browser/customer storefront -> Express customer-auth routes.
- Express auth routes -> authentication/rate-limit controls.
- Authentication service -> password hashing and Prisma customer records.
- Session cookie -> server-side hashed CustomerSession record.
- Public customer realm -> separate internal OWNER/STAFF realm.

## Phase 1 Controls

### 1. Password hash versioning and opportunistic upgrade

Keep scrypt, but define explicit supported profiles instead of one hard-coded cost. New passwords use a stronger profile. Legacy hashes remain verifiable. After a successful customer login with a legacy profile, the password is rehashed with the current profile and persisted before the session is returned.

The current hash format already contains algorithm and parameters (`scrypt$N$r$p$salt$hash`), so the upgrade can be detected without a schema change.

### 2. Constant-work invalid customer login path

Create one precomputed dummy password hash at module initialization using the current profile. When customer lookup fails or the account is inactive, verify the submitted password against the dummy hash before returning the same generic 401 response used for a wrong password. Do not expose which condition failed.

### 3. Layered customer auth rate limiting

Preserve the existing per-IP limiter and add a second limiter for a normalized credential identifier. Identifier keys are derived with HMAC-SHA-256 and an in-process secret; raw identifiers are never used as Map keys. This initial implementation remains in-memory because the current app is single-process/local-first, but the API is designed so Redis/shared storage can replace it before horizontally scaled deployment.

Baseline limits:

- Customer login IP: existing 10 attempts per 15 minutes.
- Customer login identifier: 5 attempts per 15 minutes.
- Customer registration IP: existing 5 attempts per 15 minutes.
- Customer registration identity: 3 attempts per 15 minutes for normalized email in the current email/password phase.

A 429 response includes `Retry-After`. Account lockout is not used because an attacker must not be able to permanently lock another customer out.

### 4. Low-friction registration bot guard

Add a server-issued registration-intent token endpoint. The token is HMAC-authenticated, contains issued-at/expiry metadata plus random entropy, and is returned in a short-lived HttpOnly SameSite=Lax cookie. Registration requires a valid intent cookie that is neither too new nor expired. This blocks the simplest direct-POST signup bots without presenting CAPTCHA to every customer.

This is a baseline anti-automation control, not a claim of bot-proofing. A production deployment may add Cloudflare Turnstile or an equivalent adaptive challenge after repeated/suspicious registration attempts. No fake CAPTCHA/Turnstile UI is added in this phase.

### 5. Browser origin enforcement for state-changing customer auth

For customer registration, login, logout, and registration-intent issuance, reject a present browser `Origin` header unless it matches the configured CORS origin allowlist. Requests without Origin remain allowed for local tests/non-browser clients. This supplements SameSite cookies and fixes the gap where CORS can hide a response without necessarily preventing the server-side action.

### 6. Non-cacheable auth/session responses

Set `Cache-Control: no-store` and `Pragma: no-cache` on customer auth/account responses that contain authentication or customer-account state.

### 7. Privacy-safe API behavior

- Generic login error copy: `Invalid credentials.`
- Registration conflict response must not distinguish an existing customer email from a generic inability to create the account.
- No password hashes, raw session tokens, rate-limit identifier values, or auth cookies are returned in JSON.
- Existing metadata-only request logging is preserved and guarded with tests.

## Deployment Limits

The in-memory rate limiter and registration-intent implementation are appropriate for the current single-process/local-first deployment. Before multiple backend instances or public high-volume deployment, rate-limit counters and anti-automation state must move to shared infrastructure such as Redis and proxy trust must be configured explicitly for the actual reverse proxy/CDN topology.

Do not set Express `trust proxy` blindly in this phase because an incorrect value can make forwarded client IPs attacker-controlled or collapse all users behind one address. Deployment-specific proxy configuration is a separate production-hardening gate.

## Explicit Non-Goals

- Username/email/phone multi-identifier login.
- Google or Facebook OAuth.
- Phone OTP.
- Password-reset/recovery flow.
- Government-ID/KYC.
- Shipping-address verification.
- Staff/Owner auth redesign or behavior changes.
- Redis migration in the current local-first branch.
- Always-on CAPTCHA.

## Acceptance Criteria

- Existing customer email/password registration/login/session behavior continues to work.
- Missing, inactive, and wrong-password logins return the same status/code/message and all perform memory-hard password verification work.
- New passwords use the current stronger scrypt profile; a successful login upgrades a legacy scrypt hash.
- Customer login is limited by both client IP and HMAC-derived identifier key.
- Customer registration is limited by both client IP and HMAC-derived normalized email key.
- Registration requires a valid short-lived server-issued intent cookie.
- Unapproved browser origins cannot execute customer register/login/logout/intention endpoints.
- Customer auth/account responses are marked `no-store`.
- Logs remain credential/token free.
- Customer session cookie protections and server-side token hashing remain intact.
- Customer and internal auth realms remain isolated.
- Security tests cover all controls above before Phase 2 begins.
