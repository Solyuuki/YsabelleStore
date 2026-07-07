# Sprint 2 Planning Index

Sprint 2 moves YsabelleStore from static auth mockups into a working authentication, remembered-account quick access, owner-only user management, and role-based access control foundation. The sprint now uses a clearer ownership split:

## Sprint 2 Member Ownership

| Member       | Role                 | Updated Scope                                                                                                                             | Status Target          |
| ------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| M1 / Abarado | Full Stack / Auth UI | Login UI, auth state, device recognition, quick access, toast notifications, RBAC UI, owner-only Users page                               | Feature implementation |
| M2 / Ramos   | Backend Security     | Protect register endpoint, owner-only backend guard, backend auth/RBAC hardening, safe API responses, backend/security blocker resolution | Security hardening     |
| M3 / Vito    | Testing / QA         | Seed verification, auth testing, RBAC testing, device recognition testing, backend guard testing, validation evidence                     | QA validation          |

## Sprint Metadata

| Field         | Details                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Sprint        | Sprint 2                                                                                                                   |
| Version       | `v0.2`                                                                                                                     |
| Sprint branch | `sprint/v0.2/sprint-2`                                                                                                     |
| Sprint status | Implementation in progress                                                                                                 |
| Primary focus | Authentication, remembered local accounts, owner-only user management, backend auth security, frontend RBAC, QA validation |
| Excluded work | Product CRUD, final POS, inventory movement logic, SARIMA forecasting, recommendation engine, reports, dashboard analytics |

## Sprint 2 Priority Order

| Order | Member | Task                                                       |
| ----- | ------ | ---------------------------------------------------------- |
| 1     | M2     | Protect `/api/auth/register` with owner-only backend guard |
| 2     | M3     | Test M1 auth flows and M2 backend guard                    |
| 3     | M1     | Fix UI bugs found by M3                                    |
| 4     | All    | Prepare PR to `sprint/v0.2/sprint-2`                       |

## Planning Documents

| Document                                       | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| [SPRINT-GOAL.md](SPRINT-GOAL.md)               | Defines the Sprint 2 goal, scope, and expected outcome                       |
| [SPRINT-BACKLOG.md](SPRINT-BACKLOG.md)         | Groups Sprint 2 tasks by member, priority, blocker ownership, and validation |
| [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) | Defines completion requirements for Sprint 2 work                            |
| [MEMBER-ASSIGNMENTS.md](MEMBER-ASSIGNMENTS.md) | Indexes the per-member Sprint 2 assignment files                             |
| [members/m1-abarado.md](members/m1-abarado.md) | M1 auth UI, remembered accounts, RBAC UI, and owner-only Users scope         |
| [members/m2-ramos.md](members/m2-ramos.md)     | M2 backend auth security hardening scope                                     |
| [members/m3-vito.md](members/m3-vito.md)       | M3 testing and QA scope                                                      |

## Sprint Rule

Sprint 2 is authentication, remembered-account quick access, owner-only user management, backend auth security, and RBAC foundation only. Public registration is removed from the login page. Product, inventory, POS, forecasting, recommendation, reports, dashboard analytics, and import modules remain out of scope until authorized user access is stable.

Owner-only User Management handles store account creation and staff administration. Staff self password change remains future work.

## Sprint 2 Blockers and Ownership

| Blocker                                        | Owner             | Status                  |
| ---------------------------------------------- | ----------------- | ----------------------- |
| Backend `/api/auth/register` is still public   | M2 / Ramos        | Pending                 |
| No-token register request must be blocked      | M2 / Ramos        | Pending                 |
| Invalid-token register request must be blocked | M2 / Ramos        | Pending                 |
| Staff-token register request must be blocked   | M2 / Ramos        | Pending                 |
| Inactive-user register request must be blocked | M2 / Ramos        | Pending                 |
| Owner-token register request must still work   | M2 / Ramos        | Pending                 |
| M1 UI needs backend confirmation               | M2 then M3        | Pending                 |
| Prisma DLL lock during build                   | All / Environment | Known environment issue |

M1 already moved account creation to the owner-only User Management UI, but complete security requires M2 backend enforcement. M1 should not be responsible for fixing backend register protection unless explicitly reassigned. M2 owns backend auth hardening, and M3 validates the final behavior through API and UI tests.

## Latest Sprint Activity

| Date       | Member     | Branch                           | Latest Activity                                                                   | Validation Status |
| ---------- | ---------- | -------------------------------- | --------------------------------------------------------------------------------- | ----------------- |
| 2026-07-07 | M1 Abarado | m1/v0.2/feat/auth-fullstack-flow | Sprint documentation and validation evidence were updated for the current branch. | Passed            |
