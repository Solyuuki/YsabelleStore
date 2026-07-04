# Sprint 2 Planning Index

Sprint 2 moves YsabelleStore from a static authentication mockup into a working authentication, remembered-account quick access, owner-only user management, and role-based access control foundation. The sprint supports the thesis requirement that owner and staff users have different access levels before inventory, sales, reports, and SARIMA forecasting features are implemented.

## Sprint Metadata

| Field         | Details                                                                                                                                       |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint        | Sprint 2                                                                                                                                      |
| Version       | `v0.2`                                                                                                                                        |
| Sprint branch | `sprint/v0.2/sprint-2`                                                                                                                        |
| Sprint status | Implementation in progress                                                                                                                    |
| Primary focus | Authentication, remembered local accounts, owner-only user management, session handling, frontend RBAC, backend auth API, database seed users |
| Excluded work | Product CRUD, final POS, inventory movement logic, SARIMA forecasting, recommendation engine, reports, dashboard analytics                    |

## Planning Documents

| Document                                       | Purpose                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| [SPRINT-GOAL.md](SPRINT-GOAL.md)               | Defines the Sprint 2 goal, scope, and expected outcome                    |
| [SPRINT-BACKLOG.md](SPRINT-BACKLOG.md)         | Groups Sprint 2 tasks by module with owner, priority, output, and status  |
| [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) | Defines completion requirements for Sprint 2 work                         |
| [MEMBER-ASSIGNMENTS.md](MEMBER-ASSIGNMENTS.md) | Indexes the per-member Sprint 2 assignment files                          |
| [members/m1-abarado.md](members/m1-abarado.md) | Defines M1 auth, remembered-account quick access, session, and RBAC scope |
| [members/m2-ramos.md](members/m2-ramos.md)     | Defines M2 backend auth core scope                                        |
| [members/m3-vito.md](members/m3-vito.md)       | Defines M3 database seed and user foundation scope                        |

## Sprint Rule

Sprint 2 is authentication, remembered-account quick access, owner-only user management, and RBAC foundation only. Public registration is removed from the login page. Product, inventory, POS, forecasting, recommendation, reports, dashboard analytics, and import modules remain out of scope until authorized user access is stable.

Owner-only User Management handles store account creation and staff administration. Staff self password change remains future work.
