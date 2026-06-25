# Backend Security Foundation

This folder contains lightweight security configuration for the YsabelleStore Express backend. It prepares safe defaults without implementing authentication, authorization, password hashing, JWT issuing, database access, or business rules.

## Files

| File                    | Purpose                                                                          | Current Scope      |
| ----------------------- | -------------------------------------------------------------------------------- | ------------------ |
| `security.constants.ts` | Central security values for headers, future limits, roles, and import extensions | Constants only     |
| `securityConfig.ts`     | Groups security settings for middleware and future modules                       | Configuration only |

## Foundation Boundaries

| Allowed                       | Not Implemented         |
| ----------------------------- | ----------------------- |
| Security headers              | Login                   |
| Future rate-limit settings    | JWT issuing             |
| Future role names             | Role enforcement        |
| Future import safety settings | Import parser           |
| Safe error response policy    | Database security logic |

## Local-First Rule

YsabelleStore is an offline-first desktop system. Security decisions should protect local business data while keeping daily store workflows simple for staff.
