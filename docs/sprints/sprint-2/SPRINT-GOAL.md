# Sprint 2 Goal

Sprint 2 completed the working authentication foundation for YsabelleStore. It replaced the static welcome/session screen with real login, local store account setup, session checking, logout, switch-user behavior, and owner/staff role-based access control.

## Goal Statement

Deliver a functional authentication and RBAC foundation that supports owner and staff accounts, backend authentication routes, password hashing, development seed users, frontend auth state, protected routes, and thesis-aligned role restrictions.

## Sprint 2 Closure Summary

| Area                  | Status    |
| --------------------- | --------- |
| Login UI              | Completed |
| Account setup         | Completed |
| Backend auth API      | Completed |
| Password security     | Completed |
| Session validation    | Completed |
| Owner and staff roles | Completed |
| Protected routes      | Completed |
| RBAC                  | Completed |
| Seed users            | Completed |

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

## Completed Outcome

| Area                        | Completed Outcome                                                                      |
| --------------------------- | -------------------------------------------------------------------------------------- |
| Authentication flow         | Owner and staff can log in, restore a session, switch user, and logout                 |
| Device recognition          | Remembered account quick access works safely without bypassing verification            |
| Owner-only account creation | Store account creation is handled from owner-only User Management                      |
| RBAC                        | Staff and owner access are separated consistently in the frontend and backend workflow |
| Validation                  | Sprint 2 validation and documentation evidence are recorded                            |

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

## Version Rule

Sprint completions follow the repository version ladder:

| Sprint                       | Version |
| ---------------------------- | ------- |
| Sprint 1 completed           | v0.1.0  |
| Sprint 2 completed           | v0.2.0  |
| Sprint 3 completed           | v0.3.0  |
| Sprint 4 completed           | v0.4.0  |
| Final MVP/demo-ready release | v1.0.0  |

Sprint 3 must not be bumped to `v0.3.0` during planning. The bump happens only after Sprint 3 work is complete and accepted.
