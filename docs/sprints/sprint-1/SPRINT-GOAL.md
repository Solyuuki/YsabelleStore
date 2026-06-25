# Sprint 1 Goal

Sprint 1 focuses on core implementation infrastructure for YsabelleStore. The team will prepare the application layers for feature delivery while avoiding business logic and business module implementation.

## Goal Statement

Deliver a stable implementation base that allows the team to start feature work with clear frontend, backend, database, Electron, validation, and branch governance boundaries.

## Primary Deliverables

| Deliverable                    | Owner        | Expected Outcome                                                                                                                      |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| React application shell        | m1 - Abarado | App shell, layout, sidebar, header, shared UI foundation, and dashboard placeholder are ready for later modules                       |
| Backend core                   | m2 - Ramos   | Express structure, route registry, controllers, services, validators, error handling, and Prisma integration boundary are ready       |
| Database implementation start  | m3 - Vito    | Prisma schema, relationships, constraints, indexes, migration strategy, seed strategy, and validation path begin from approved design |
| Electron integration readiness | m1 - Abarado | Renderer and desktop integration assumptions are documented and prepared without unsafe IPC expansion                                 |
| Branch workflow                | m1 - Abarado | Sprint branch, member branches, staging flow, and PR rules are clear                                                                  |
| Team workflow                  | m1, m2, m3   | Daily workflow, review flow, and completion standards are aligned                                                                     |

## In Scope

| Area       | Scope                                                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Frontend   | Application shell, navigation structure, shared UI foundation, dashboard placeholder, API client readiness                    |
| Backend    | Core Express architecture, validation pattern, route registry, service boundaries, error handling, Prisma connection boundary |
| Database   | Initial approved Prisma schema work, migration plan, seed strategy, indexes, constraints, validation                          |
| Electron   | Integration readiness and secure desktop shell alignment                                                                      |
| Governance | Branch naming, sprint branch integration, staging flow, definition of done, daily workflow                                    |

## Out of Scope

| Area                          | Reason                                                    |
| ----------------------------- | --------------------------------------------------------- |
| Product management features   | Business module work begins after Sprint 1 infrastructure |
| Inventory and batch workflows | Requires approved database and backend foundation first   |
| Sales recording               | Requires schema and service structure first               |
| SARIMA execution              | Forecast engine implementation belongs to a later sprint  |
| Recommendation engine         | Requires inventory, sales, and forecast outputs first     |
| Reports and analytics         | Requires completed data flow first                        |

## Sprint Exit Target

Sprint 1 exits successfully when the team can create feature branches, open pull requests into `sprint/v0.1/sprint-1`, validate the repository locally and in GitHub Actions, and start business module implementation on top of a stable core foundation.
