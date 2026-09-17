# Backend Security Controls

> **Current baseline:** `sprint/v0.10/sprint-10`

This directory contains central security configuration used by the YsabelleStore Express backend. Earlier foundation wording described authentication and authorization as future work; that is no longer accurate. Current executable source implements internal and customer authentication, role enforcement, password hashing, session/trusted-device controls, origin checks, rate limiting, security headers, safe error handling, request tracing, and related persistence.

## Directory Scope

| File                    | Purpose                                                                                       | Current Scope        |
| ----------------------- | --------------------------------------------------------------------------------------------- | -------------------- |
| `security.constants.ts` | Central security headers, auth rate-limit policies, import/image limits and related constants | Active configuration |
| `securityConfig.ts`     | Exposes grouped security settings to middleware/application code                              | Active configuration |

Security behavior also spans `backend/src/middleware/`, `backend/src/services/`, `backend/src/utils/`, route modules, and the Prisma schema. This directory alone is not the entire security implementation.

## Implemented Security Boundaries

| Area                         | Current Implementation                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Internal authentication      | Bearer JWT authentication for OWNER/STAFF users                                                                      |
| Internal authorization       | `requireAuth` plus route-level `requireRole(...)` enforcement                                                        |
| Password storage             | Node `crypto.scrypt` with random salts and supported work-factor profiles                                            |
| Trusted devices              | Random trusted-device tokens stored server-side as SHA-256 hashes with expiry/revocation state                       |
| Customer authentication      | Server-side customer sessions with HTTP-only cookie transport                                                        |
| Customer sensitive mutations | Allowed-origin validation plus authentication and targeted rate limits                                               |
| OTP / recovery               | Hashed verification challenges/tokens with expiry, consumption and failed-attempt state                              |
| Social authentication        | Google/Facebook OAuth transaction and handoff boundaries with persisted state                                        |
| CORS                         | Explicit configured origin allow-list with credential support                                                        |
| Sensitive response caching   | `Cache-Control: no-store` and `Pragma: no-cache` on sensitive customer auth/account routes                           |
| Security headers             | `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Resource-Policy` |
| Error safety                 | Unexpected failures return generic server-error envelopes; raw exception details are not exposed                     |
| Request traceability         | Server-generated UUID exposed through `x-request-id`                                                                 |
| Request audit logging        | Method, path, status, duration and request ID are logged without normal request-body/token dumping                   |
| Upload controls              | Separate import and product-image size/type constraints                                                              |

## Rate-Limit Model

Authentication-related routes use in-process windowed rate limiting with dedicated limits for internal login, customer login/registration, email authentication, recovery, account-sensitive operations and username claims. Identity-specific keys are HMAC-derived before being stored in the in-memory limiter map.

This implementation is appropriate for the current local/single-process architecture but is **not a distributed rate-limit store**. If the backend is later scaled to multiple processes or hosts, release engineering must replace or coordinate this state.

## Known Hardening / Documentation Items

| Item                                  | Current State                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Generic import upload limit           | Runtime middleware currently allows 100 MiB                                              |
| Legacy/planning import limit constant | A separate 10 MB planning constant still exists and must not be treated as runtime truth |
| Generic upload-size error detail      | Error-handler text currently reports `5MB`, which does not match all upload routes       |
| Branch protection                     | Sprint branch protection is not established by current branch metadata                   |
| Distributed rate limiting             | Not implemented; current limiter is process-local                                        |

These are tracked as release-hardening items rather than hidden by documentation.

## Security Source of Truth

Use the following evidence order when security documents disagree:

1. Current executable middleware/services/routes.
2. Current Prisma schema and migrations.
3. Current environment/runtime configuration.
4. Security regression tests and CI.
5. Security documentation/planning notes.

For the consolidated current register, see [`../../../docs/security/SECURITY-CONTROLS-REGISTER.md`](../../../docs/security/SECURITY-CONTROLS-REGISTER.md).
