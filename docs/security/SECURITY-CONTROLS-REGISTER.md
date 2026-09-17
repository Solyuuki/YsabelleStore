# YsabelleStore Security Controls Register

> **Baseline:** `sprint/v0.10/sprint-10`
>
> This register describes security controls evidenced by current executable source, schema, environment configuration and tests. It deliberately distinguishes **implemented controls**, **development/release assumptions**, and **known hardening gaps**. Older foundation documents that say authentication or role enforcement is “not implemented” are superseded by current source.

## 1. Security Architecture Summary

| Area | Current Control |
| --- | --- |
| Internal identity | OWNER/STAFF `User` accounts |
| Internal authentication | Bearer JWT issued after password/trusted-device verification |
| Internal authorization | Route-level `requireAuth` + `requireRole(...)` |
| Customer identity | Separate `CustomerAccount` domain |
| Customer authentication | Server-side session record + HTTP-only customer session cookie |
| Password storage | Node `crypto.scrypt` password hashing with per-password random salt |
| Trusted devices | Random bearer material stored server-side only as SHA-256 hash, with expiry/revocation |
| Customer session persistence | Raw cookie token is not stored directly; database stores unique token hash |
| OAuth | Google/Facebook provider boundary; server-side OAuth transaction/handoff persistence |
| OTP/recovery | Email/mobile challenge and password-reset persistence uses hash/expiry/consumption state |
| Rate limiting | Authentication-specific in-process windowed rate limits |
| CORS | Explicit origin allow-list with credentials enabled |
| Sensitive auth caching | `Cache-Control: no-store` + `Pragma: no-cache` on customer-auth/account routers |
| Security headers | nosniff, DENY framing, no-referrer, restricted camera/microphone/geolocation, same-origin resource policy |
| Request traceability | Server-generated UUID in `x-request-id` |
| Error safety | Unexpected exceptions become generic 500 envelopes; raw exception details are not returned |
| Logging | Method/path/status/duration/requestId only in standard completion logger; error logger records safe metadata |
| Database | Prisma/MySQL access stays behind backend boundary |
| Secrets | `.env.example` contains placeholders; real credentials are expected in local/host secrets, not committed config |

## 2. Internal Authentication Controls

### JWT session

| Control | Current Value / Behavior |
| --- | --- |
| Token type | JWT via `jsonwebtoken` |
| Authentication header | `Authorization: Bearer <token>` |
| JWT subject | Internal user id |
| JWT claims | `tokenType: internal`, email, role |
| Token lifetime | **8 hours** |
| Secret source | `JWT_SECRET` environment variable |
| Verification | Signature/expiry verification followed by live user lookup |
| Inactive account handling | Token is rejected if user no longer exists or is inactive |

The backend does not trust role/email claims alone after JWT verification; it reloads the user by `sub` and checks active status before creating the safe authenticated user object.

### Password hashing

| Parameter | Current Profile |
| --- | --- |
| Algorithm | `scrypt` |
| Current N | `65536` |
| r | `8` |
| p | `1` |
| Derived key length | `64` bytes |
| Salt | `16` random bytes encoded as Base64 |
| Verification comparison | `timingSafeEqual` |
| Legacy accepted profile | `N=16384, r=8, p=1` |

Password hashes encode the supported scrypt profile and salt. Unsupported/malformed hashes are rejected. The current service exposes a `passwordHashNeedsUpgrade` helper for profile migration decisions.

### Trusted-device sessions

| Control | Current Behavior |
| --- | --- |
| Token generation | `randomBytes(32)` → Base64URL |
| Persistent representation | SHA-256 hash only |
| Lifetime | **30 days** |
| Revocation | `revokedAt` persisted |
| Expiry | Explicit `expiresAt` check |
| Account status | Restore is rejected for unavailable/inactive user |
| Audit metadata | device label, truncated user agent, last-used timestamp |

## 3. Customer Session and Account Controls

### Customer session cookie

| Cookie property | Current Value |
| --- | --- |
| Name | `ysabelle_customer_session` |
| `httpOnly` | `true` |
| `sameSite` | `lax` |
| `secure` | `true` only when `NODE_ENV === production` |
| Path | `/api` |
| Max age | **7 days** |

Customer session lookup uses a server-side `CustomerSession` record whose stored token representation is hashed. Invalid optional sessions are cleared when the optional-auth middleware receives `CUSTOMER_SESSION_INVALID`.

### Sensitive customer mutations

The customer-account router applies origin checks, authenticated-customer checks and rate limits to high-risk mutations such as username claim, password change and revoking other sessions. Customer authentication/account routers also disable sensitive response caching.

## 4. OAuth and Social Authentication Controls

Supported provider identities in the current schema/configuration are `GOOGLE` and `FACEBOOK`; OAuth transport distinguishes `WEB` and `ELECTRON`.

| Persisted security element | Treatment |
| --- | --- |
| OAuth state | Stored as `stateHash` |
| Browser binding | Stored as optional hash |
| PKCE verifier | Persisted as ciphertext field |
| Nonce | Ciphertext/hash fields are available |
| Electron challenge | Explicit challenge field |
| Transaction expiry/consumption | `expiresAt` + `consumedAt` |
| Electron handoff code | Stored as `codeHash` |
| Handoff verifier | `verifierChallenge` |
| Handoff lifecycle | expiry + one-time `usedAt` state |

OAuth client secrets and provider credentials are environment-backed. Real Google/Meta credentials must not be committed.

## 5. Authentication Rate Limits

All listed windows are currently **15 minutes**. The limiter is implemented in application memory and keys sensitive identity values through an HMAC using a random process-local secret before using them as map keys.

| Scope | Max Attempts / Window |
| --- | ---: |
| Internal login | 10 |
| Customer login (IP/default key) | 10 |
| Customer login identifier | 5 |
| Customer registration | 5 |
| Customer registration identity target | 3 |
| Registration email request (general) | 30 |
| Registration email target | 5 |
| Registration email verify (general) | 50 |
| Registration email verify target | 10 |
| Email-auth request (general) | 30 |
| Email-auth email target | 5 |
| Email-auth verify (general) | 50 |
| Email-auth verify email target | 10 |
| Mobile-auth request (configured foundation) | 30 |
| Mobile-auth phone target | 5 |
| Mobile-auth verify (configured foundation) | 50 |
| Mobile-auth verify phone target | 10 |
| Password recovery request | 10 |
| Password recovery identifier | 3 |
| Password recovery verify | 10 |
| Password recovery reset | 10 |
| Sensitive account mutation by IP | 20 |
| Sensitive account mutation by account | 5 |
| Username claim target | 3 |

When exceeded, the limiter returns `429` and sets `Retry-After`.

### Rate-limit deployment limitation

The current limiter uses per-process in-memory `Map` storage. Therefore:

- counters reset when the backend process restarts;
- counters are not shared between multiple backend processes/hosts;
- it is appropriate to document this as the current local/single-process control, not as a distributed production rate-limit service.

If deployment expands beyond the local/single-backend model, move rate-limit state to an approved shared store or edge control.

## 6. CORS and Origin Controls

The Express application enables credentialed CORS and allows a request when the browser origin is undefined or is present in `corsOrigins`.

The committed development example allows:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `null` for the packaged Electron `file://` renderer origin

Customer authentication mutations add an explicit origin gate through `requireAllowedCustomerAuthOrigin`.

**Release rule:** production/LAN deployments must explicitly review `CORS_ORIGINS`; development origins must not be carried into a release blindly.

## 7. HTTP Security Headers

The custom security middleware currently sets:

| Header | Current Value |
| --- | --- |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Cross-Origin-Resource-Policy` | `same-origin` |

### Header hardening scope

The current custom middleware does **not** set a Content Security Policy or HSTS header. That is not silently represented as implemented. Whether those controls are required depends on the final served/packaged topology; any web/LAN production exposure should explicitly evaluate them.

## 8. Request Body, Upload and Import Controls

| Control | Current Source Value |
| --- | --- |
| JSON body limit | `1mb` |
| Product image upload size | **8 MiB** |
| Product image configured MIME allow-list | `image/jpeg`, `image/png`, `image/webp` |
| Product image configured decoded-pixel ceiling | `24,000,000` |
| Product image configured dimension ceiling | `8,000` pixels |
| Product/import upload middleware size | **100 MiB**, one file, memory storage |
| Allowed import-extension policy constant | `.csv`, `.xlsx` |

### Current documentation/code discrepancy

There are stale constants/messages that must not be treated as the actual upload limit:

- `SECURITY_LIMITS.plannedImportFileSizeMb` is `10`, but the executable `productImportUpload` middleware allows **100 MiB**.
- the generic Multer size-error payload currently reports `limit: "5MB"`, which does not match the actual 100 MiB import limit or 8 MiB image limit.

This is a release-hardening issue: error details should be derived from the actual upload policy instead of a hard-coded `5MB` string.

## 9. Error Handling and Information Disclosure

Unexpected errors are converted into:

- HTTP `500`;
- public message `An unexpected error occurred.`;
- public error code `INTERNAL_SERVER_ERROR`;
- optional request ID for support correlation.

Safe application `HttpError` instances may expose their intended status/message/details. File-size errors are converted to a controlled `413` response. Server-side error logging records event type, request ID, status, error type and error code rather than serializing request bodies, authorization headers or tokens.

## 10. Request Traceability and Logging

Every request receives a server-generated `randomUUID()` request ID, returned as `x-request-id`. Completion logging currently records:

- event name;
- request ID;
- HTTP method;
- request path;
- response status;
- duration in milliseconds.

This supports operational correlation without the standard logger dumping body/header/token content.

## 11. Database / Sensitive Persistence Controls

| Sensitive material | Current Persistence Pattern |
| --- | --- |
| Internal passwords | scrypt hash |
| Trusted-device token | SHA-256 hash |
| Customer password | password hash field; password service is shared/used by auth flows where implemented |
| Customer session token | token hash |
| Customer password reset token | token hash |
| Customer OTP | OTP hash |
| Remembered browser auth | browser-token hash |
| Social-link intent | token hash |
| OAuth state | state hash |
| OAuth PKCE verifier | ciphertext field |
| OAuth handoff code | code hash |

No documentation should imply that MySQL itself provides transparent application-level encryption-at-rest; that is a deployment/storage control and must be established separately if required.

## 12. Secrets and External Provider Credentials

Environment-backed secrets/configuration include at least:

- `DATABASE_URL` / DB credentials;
- `JWT_SECRET`;
- `CUSTOMER_OAUTH_TRANSACTION_KEY`;
- `RESEND_API_KEY`;
- Gmail SMTP user/App Password for development QA;
- Google OAuth client id/secret;
- Facebook/Meta app id/secret.

The committed `.env.example` contains placeholders and explicitly instructs operators to keep real credentials in local/host secrets.

## 13. Health Endpoint Security Boundary

`/api/health`, `/api/health/live` and `/api/health/ready` are intentionally unauthenticated operational endpoints. Current health data exposes safe service/configuration booleans and sanitized DB status/message rather than the raw connection string. Readiness returns `503` when the DB is unavailable or required JWT configuration is missing.

## 14. Security Verification Evidence

The backend test manifest contains focused regression coverage including:

- `auth-security.test.ts`
- `customer-auth.test.ts`
- `customer-auth-http.test.ts`
- `customer-account-security.test.ts`
- `customer-account-password-concurrency.test.ts`
- `customer-recovery-otp-crypto.test.ts`
- `customer-password-recovery*.test.ts`
- `customer-social-auth.test.ts`
- `customer-oauth-transaction.test.ts`
- `customer-email-registration.test.ts`
- `customer-email-auth.test.ts`
- `customer-remembered-auth.test.ts`
- `cors.test.ts`
- `health-readiness.test.ts`
- `error-handler-security.test.ts`
- `request-traceability.test.ts`

CI also runs a production dependency reachability/security audit through `npm run security:audit:production`.

## 15. Current Hardening / Release Review Items

| Priority | Item | Current State / Required Action |
| --- | --- | --- |
| High | Upload-limit error accuracy | Replace hard-coded `5MB` error detail with route/policy-accurate limit reporting. |
| Medium | Import size policy consistency | Reconcile stale planned 10 MB constant vs executable 100 MiB import middleware and document intended approved limit. |
| Medium | Distributed rate limiting | Current limiter is process-local; redesign only if deployment becomes multi-process/multi-host or internet-facing. |
| Medium | CSP/HSTS decision | Not currently set by custom security middleware; explicitly assess for final LAN/web exposure. |
| Medium | Release CORS allow-list | Ensure production values are least-privilege and do not blindly copy local development origins. |
| Medium | Python/dependency SBOM | Freeze exact release versions and re-run license/security review before distributable release. |
| Ongoing | Secret hygiene | Keep real OAuth/email/DB/JWT secrets outside Git and rotate if exposure occurs. |
| Ongoing | Session/recovery regression | Preserve current security/concurrency/rate-limit tests as auth flows evolve. |

## 16. Security Documentation Precedence

For current behavior, use this precedence:

1. Executable middleware/services/routes/configuration.
2. Prisma schema and migrations for persisted security state.
3. Security/auth regression tests.
4. This register.
5. Older foundation/planning documentation.

`backend/src/security/README.md` originated as a foundation document and still describes authentication/JWT/role enforcement as unimplemented. That statement is stale relative to current Sprint 10 source and must not be used as the current security-status authority.

This document is an engineering security register, not a penetration-test report or a claim of formal security certification.