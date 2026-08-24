# M1 Abarado — Sprint 7

## Focus

Customer authentication and account readiness.

## Responsibilities

- Customer auth persistence and migrations.
- Registration/login/session service.
- Secure HttpOnly cookie HTTP boundary.
- Customer/internal privilege isolation tests.
- Customer auth frontend integration.
- Account-linked checkout and customer order history.
- Internal-auth hardening, trusted-device expiry, and auth throttling.
- Frontend internal-bearer isolation for storefront/customer routes.
- Sprint 7 Tier 3 verification and documentation.

## Current status

Implementation through Phase 4 is complete on the verified Sprint 7 implementation baseline. Customer backend auth, frontend auth/account UX, account-linked checkout/history, privilege isolation, stale-session handling, internal-auth hardening, trusted-device expiration, rate limiting, bearer scoping, and permanent regression coverage were completed and verified.

The permanent workflows were green on implementation cleanup head `0866eb7acfc9ffaa8ee8f1b3a8d7abbe06cc1842`, and dedicated Tier 3 verification was completed before removal of the temporary Phase 4 verification workflow.

Current work is the pre-integration completion gate: keep Sprint 7 documentation accurate, confirm the latest documentation-reconciled head is green, confirm no known Sprint 7 defect remains, then wait for explicit user authorization before integrating the accepted Sprint 6 baseline into Sprint 7. Fresh Tier 3/full regression verification and manual acceptance are required after that integration.

## Current Sprint Activity

| Date       | Branch                                  | Work Areas                                                                   | Completed / Updated Work                                                                                         | Evidence                                                                                                                                                                                                                                                               | Next QA                                     |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 2026-08-24 | m1/v0.7/fix/sprint6-sprint7-integration | Scripts / CI<br>Other<br>Backend<br>Database<br>Docs<br>Electron<br>Frontend | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | .github/workflows/sprint-7-artifact-refresh-temp.yml<br>.gitignore<br>.prettierignore<br>.prettierrc.json<br>backend/package.json<br>backend/src/config/env.ts<br>backend/src/controllers/productImageController.ts<br>backend/src/controllers/storefrontController.ts | Manual QA required for auth/device/UI flow. |
