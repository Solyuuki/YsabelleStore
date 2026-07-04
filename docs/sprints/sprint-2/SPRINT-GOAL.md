# Sprint 2 Goal

Sprint 2 completes the working authentication foundation for YsabelleStore. It replaces the static welcome/session screen with real login, local store account setup, session checking, logout, switch-user behavior, and owner/staff role-based access control.

## Goal Statement

Deliver a functional authentication and RBAC foundation that supports owner and staff accounts, backend authentication routes, password hashing, development seed users, frontend auth state, protected routes, and thesis-aligned role restrictions.

## Sprint Overview

| Area          | Sprint 2 Focus                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Frontend      | Login UI, password visibility toggle, registration UI, auth state, protected route behavior, RBAC navigation |
| Backend       | Auth routes, controllers, services, validation, JWT/session response, password verification                  |
| Database      | Seed users, Prisma user lookup, role/status support, password hash storage                                   |
| Integration   | Frontend login/register/session checks connected to backend auth responses                                   |
| Documentation | Sprint 2 docs and thesis scope alignment for authentication and RBAC                                         |
| Validation    | Format, lint, typecheck, audit, Prisma validation, and build when safe                                       |

## In Scope

| Area                  | Scope                                                                       |
| --------------------- | --------------------------------------------------------------------------- |
| Login Page            | Real email/password form with clear loading and error states                |
| Account Setup         | Local owner/staff account registration for authorized store users           |
| Backend Auth API      | Login, register, logout, and current-user/session endpoints                 |
| Password Security     | Hashed passwords for seeded and registered users                            |
| Session Validation    | Current user loaded through backend token/session validation                |
| Owner and Staff Roles | Role recognition available in the frontend authenticated user object        |
| Protected Routes      | Unauthenticated users cannot open app modules                               |
| RBAC                  | Staff cannot open owner-only modules; owner can open administrative modules |
| Seed Users            | Development owner/staff accounts for local testing                          |

## Out of Scope

| Area                     | Reason                                            |
| ------------------------ | ------------------------------------------------- |
| Product CRUD             | Requires authenticated foundation first           |
| Inventory movement logic | Requires user/session tracking                    |
| POS stock deduction      | Requires authenticated cashier/staff flow         |
| SARIMA forecasting       | Requires stable sales and inventory data          |
| Recommendation engine    | Depends on inventory and forecasting              |
| Dashboard real KPIs      | Depends on backend modules and authenticated data |
| CSV/Excel import         | Comes after auth and validation foundation        |

## Deliverables

| Deliverable                                 | Owner        | Expected Outcome                                                                  |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| Login UI, auth state, registration UI, RBAC | M1 - Abarado | Functional login/register/session flow and frontend route restrictions            |
| Backend auth core                           | M2 - Solo    | Auth routes, controller/service logic, validation, token response, middleware     |
| Database seed/user foundation               | M3 - James   | Owner/staff seed users, password hashes, Prisma validation and seed documentation |
| Thesis scope alignment                      | M1 - Abarado | Architecture note tying Sprint 2 auth/RBAC to Chapter 1-2 scope                   |

## Expected Sprint Outcome

After Sprint 2, owner and staff users can authenticate, register local store accounts, restore a session, switch user, logout, and access only the routes permitted by their role. Remaining inventory, POS, SARIMA, recommendation, report, and dashboard business logic stays explicitly out of scope.
