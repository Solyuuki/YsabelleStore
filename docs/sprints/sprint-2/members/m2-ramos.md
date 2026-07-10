# M2 - Ramos

## Role

Backend Security Lead.

## Sprint Focus

Implement and harden the backend authentication and authorization controls used by the Sprint 2 frontend flow.

## Assigned Scope

| Area              | Scope                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Auth routes       | `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, and logout/session-related route                        |
| Register security | Protect account creation with authentication and owner-only authorization                                        |
| Controller logic  | Safe request handling for login, registration, current user, and logout                                          |
| Auth service      | Password verification, safe user response, token/session generation                                              |
| Middleware        | Token/session middleware and owner-only guard patterns for protected backend APIs                                |
| Error handling    | Clear standardized auth errors for invalid credentials, missing accounts, invalid sessions, and forbidden access |

## Assigned Tasks

| Task | Description                                                         |
| ---- | ------------------------------------------------------------------- |
| 1    | Protect the register endpoint with owner-only backend enforcement   |
| 2    | Reuse auth middleware for authenticated API access                  |
| 3    | Return safe error responses for unauthorized and forbidden requests |
| 4    | Validate active owner status before allowing account creation       |
| 5    | Keep password hashing secure for any created account                |
| 6    | Document backend auth and RBAC behavior for Sprint 2                |

## M2 Responsibility Table

| Priority | M2 Task                           | Description                                                                           | Expected Output                                       |
| -------- | --------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| P0       | Protect register endpoint         | Require authentication before account creation                                        | Public users cannot call `/api/auth/register`         |
| P0       | Add owner-only guard              | Only OWNER users can create accounts                                                  | Staff cannot create accounts through direct API calls |
| P0       | Reuse auth middleware             | Apply existing JWT/session validation pattern                                         | Backend auth stays consistent                         |
| P0       | Safe error responses              | Return clear `401` and `403` responses                                                | No sensitive backend details exposed                  |
| P1       | Validate active owner status      | Reject inactive users and non-owner roles                                             | Only active owners can create accounts                |
| P1       | Preserve password hashing         | Keep secure password hashing for created accounts                                     | No plaintext passwords                                |
| P1       | API test evidence                 | Document no-token, staff-token, invalid-token, inactive-user, and owner-token results | Security behavior is proven                           |
| P1       | Update backend auth documentation | Document owner-only register behavior                                                 | Sprint 2 docs match implementation                    |

## Backend Access Rules

| User Type     | Can Access `/api/auth/register`? | Expected Result          |
| ------------- | -------------------------------- | ------------------------ |
| No token      | No                               | `401 Unauthorized`       |
| Invalid token | No                               | `401 Unauthorized`       |
| Staff token   | No                               | `403 Forbidden`          |
| Inactive user | No                               | `403 Forbidden`          |
| Owner token   | Yes                              | Account creation allowed |

## M1 Blockers Assigned to M2

The following M1 blockers are backend/security-related and are assigned to M2:

| M1 Blocker                                                                   | Why It Belongs to M2                                   | M2 Expected Fix                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Owner-only User Management is currently protected mainly through frontend UI | Backend register endpoint can still be called directly | Protect `/api/auth/register` with authentication and owner-only authorization |
| Staff is blocked in UI but not guaranteed server-side                        | Frontend RBAC is not enough for API security           | Reject STAFF role with `403 Forbidden`                                        |
| No-token users may still access register API                                 | Account creation must not be public                    | Reject missing/invalid token with `401 Unauthorized`                          |
| Inactive users should not create accounts                                    | Account creation requires active owner status          | Reject inactive users with `403 Forbidden`                                    |
| M1 cannot fully close auth security without backend guard                    | This is backend middleware/API responsibility          | Add reusable backend guard and document API behavior                          |

## Validation Responsibility

| Validation Area | Responsibility                                           |
| --------------- | -------------------------------------------------------- |
| Backend         | Auth API, middleware, validation, and error smoke review |
| API contract    | Standardized response and error behavior review          |
| Security        | Confirm password hashes are never exposed                |

## Out of Scope

| Out of Scope               | Reason                       |
| -------------------------- | ---------------------------- |
| Frontend redesign          | Owned by M1                  |
| Device recognition UI      | Owned by M1                  |
| Toast UI                   | Owned by M1                  |
| UI bug fixing from QA      | M1 handles UI-specific fixes |
| Product/inventory/POS APIs | Future module work           |
| SARIMA forecasting         | Future module work           |
| Staff self-password change | Future auth/settings task    |

## Status

| Item       | Status                               |
| ---------- | ------------------------------------ | ---------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ---- | ------------------------ | -------- | ------- |
| Date       | Branch                               | Work Areas | Completed / Updated Work                                                          | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Next QA                       |
| ---        | ---                                  | ---        | ---                                                                               | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ---                           |
| 2026-07-09 | m2/v0.3/feat/sarima-forecast-reports | Docs       | Sprint documentation and validation evidence were updated for the current branch. | docs/implementation-artifacts/m2-ramos/BLOCKERS.md<br>docs/implementation-artifacts/m2-ramos/DAILY-NOTES.md<br>docs/implementation-artifacts/m2-ramos/DECISIONS.md<br>docs/implementation-artifacts/m2-ramos/DEPLOYMENT-NOTES.md<br>docs/implementation-artifacts/m2-ramos/README.md<br>docs/implementation-artifacts/m2-ramos/SPRINT-PLANNING.md<br>docs/implementation-artifacts/m2-ramos/SPRINT-PROGRESS.md<br>docs/implementation-artifacts/m2-ramos/TASKS.md | Review generated sprint docs. | reas | Completed / Updated Work | Evidence | Next QA |
| ---        | ---                                  | ---        | ---                                                                               | ---                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ---                           |

## Current Sprint Activity

| Date       | Branch                               | Work Areas                                                                                  | Completed / Updated Work                                                                                         | Evidence                                                                                                                                                                                                                                | Next QA                                     |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 2026-07-10 | m2/v0.3/feat/sarima-forecast-reports | Scripts / CI<br>Other<br>Backend<br>Docs<br>Database<br>Electron<br>Forecasting<br>Frontend | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | .github/PULL_REQUEST_TEMPLATE.md<br>.github/workflows/ci.yml<br>.github/workflows/pull-request-checks.yml<br>.github/workflows/repository-governance.yml<br>.gitignore<br>.prettierrc.json<br>backend/package.json<br>backend/README.md | Manual QA required for auth/device/UI flow. |
