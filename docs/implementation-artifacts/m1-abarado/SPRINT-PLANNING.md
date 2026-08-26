# m1 Sprint Planning

## Sprint Scope

| Sprint   | Version | Goal                                                                                             | Status  |
| -------- | ------- | ------------------------------------------------------------------------------------------------ | ------- |
| Sprint 0 | v0.1    | Establish repository foundation and documentation governance                                     | Done    |
| Sprint 1 | v0.2    | Prepare frontend and Electron application shell                                                  | Done    |
| Sprint 2 | v0.3    | Build auth, trusted-device, and RBAC foundation                                                  | Done    |
| Sprint 3 | v0.3    | Build the first functional business workflow for Products, Inventory, Sales, SARIMA, and Reports | Planned |

## Planned Tasks

| Task ID         | Sprint   | Description                                            | Status  |
| --------------- | -------- | ------------------------------------------------------ | ------- |
| YSB-M1-DOC-001  | Sprint 0 | Create repository standards and workflow documentation | Done    |
| YSB-M1-GOV-001  | Sprint 0 | Add PR template and branch validation workflow         | Done    |
| YSB-M1-UI-001   | Sprint 1 | Scaffold React TypeScript frontend structure           | Done    |
| YSB-M1-ELC-001  | Sprint 1 | Scaffold Electron main and preload structure           | Done    |
| YSB-M1-AUTH-001 | Sprint 2 | Build auth UI, remembered accounts, and RBAC shell     | Done    |
| YSB-M1-AUTH-002 | Sprint 2 | Preserve trusted-device and logout behavior            | Done    |
| YSB-M1-BIZ-001  | Sprint 3 | Clean up dashboard and module shell spacing/alignment  | Planned |
| YSB-M1-BIZ-002  | Sprint 3 | Wire POS and Sales integration foundations             | Planned |
| YSB-M1-BIZ-003  | Sprint 3 | Handle merge conflicts and integration validation      | Planned |

## Sprint Acceptance Criteria

| Criterion                                   | Evidence                                             |
| ------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------- | --------------------------- | -------- | --------------- | -------- |
| UI remains production-grade                 | Dashboard and module shells are visually balanced    |
| POS and Sales become functional foundations | Product selection and transaction flow are connected |
| Integration work stays mergeable            | Conflicts are resolved continuously                  |
| Sprint 2 behavior is preserved              | Auth, trusted-device, and role handling remain       | Date                                                                | Next Recommended Task       | QA Focus | Affected Module | Priority |
| ---                                         | ---                                                  | ---                                                                 | ---                         | ---      |
| 2026-07-08                                  | Review Sprint 3 planning docs and shared contracts.  | Data contract clarity across modules.                               | Docs<br>Frontend<br>Backend | High     |
| 2026-07-08                                  | Review generated artifact updates before commit.     | Documentation and validation review.                                | Docs                        | Normal   |
| 2026-07-09                                  | Run push-ready validation and resolve any failures.  | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Frontend         | High     | ocs             | Normal   |

## Planning Updates

| Date       | Next Recommended Task                                 | QA Focus                                                            | Affected Module                                                                 | Priority |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| 2026-07-09 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Electron<br>Frontend<br>Scripts / CI             | High     |
| 2026-07-09 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Frontend                                                 | High     |
| 2026-07-09 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend                                         | High     |
| 2026-07-09 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Frontend                                                                        | High     |
| 2026-07-09 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Docs<br>Frontend                                                                | High     |
| 2026-07-10 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Frontend                                                                        | High     |
| 2026-07-10 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Docs<br>Frontend                                                                | High     |
| 2026-07-10 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Docs<br>Frontend<br>Scripts / CI                                                | High     |
| 2026-07-10 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend<br>Scripts / CI                         | High     |
| 2026-07-11 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Frontend<br>Scripts / CI                                                        | High     |
| 2026-07-11 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Docs<br>Frontend<br>Scripts / CI                                                | High     |
| 2026-07-11 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Frontend                                                                        | High     |
| 2026-07-11 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Docs<br>Frontend                                                                | High     |
| 2026-07-11 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Frontend<br>Scripts / CI                                             | High     |
| 2026-07-11 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Docs<br>Frontend<br>Scripts / CI                                     | High     |
| 2026-07-11 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Frontend                                                             | High     |
| 2026-07-11 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Docs<br>Frontend                                                     | High     |
| 2026-07-11 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend<br>Scripts / CI                         | High     |
| 2026-07-11 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Electron<br>Frontend<br>Scripts / CI             | High     |
| 2026-07-12 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Electron<br>Frontend                                                 | High     |
| 2026-07-12 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Docs<br>Electron<br>Frontend                                         | High     |
| 2026-07-12 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Frontend                                                             | High     |
| 2026-07-12 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Docs<br>Frontend                                                     | High     |
| 2026-07-12 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Other<br>Backend<br>Docs<br>Electron<br>Forecasting<br>Frontend<br>Scripts / CI | High     |
| 2026-07-15 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Frontend                                                                        | High     |
| 2026-07-15 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Docs<br>Frontend                                                                | High     |
| 2026-07-15 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend                                         | High     |
| 2026-07-15 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend<br>Scripts / CI                         | High     |
| 2026-07-16 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend<br>Scripts / CI                         | High     |
| 2026-08-09 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Frontend                                                                        | High     |
| 2026-08-10 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Other<br>Backend<br>Docs<br>Database<br>Electron<br>Frontend<br>Scripts / CI    | High     |
| 2026-08-10 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend<br>Scripts / CI<br>Other                | High     |
| 2026-08-11 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Electron<br>Frontend<br>Scripts / CI                                            | High     |
| 2026-08-11 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Docs<br>Frontend                                                                | High     |
| 2026-08-14 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Docs<br>Frontend<br>Scripts / CI<br>Other                | High     |
| 2026-08-18 | Run push-ready validation and resolve any failures.   | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Database<br>Frontend<br>Scripts / CI                                 | High     |
| 2026-08-18 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Scripts / CI<br>Backend<br>Other<br>Docs<br>Database<br>Frontend                | High     |
| 2026-08-23 | Review generated artifact updates before commit.      | Backend/database validation and migration application.              | Other<br>Backend<br>Docs<br>Electron<br>Frontend<br>Scripts / CI                | High     |
| 2026-08-24 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Backend<br>Other<br>Frontend<br>Scripts / CI                                    | High     |
| 2026-08-24 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Other<br>Docs<br>Electron<br>Frontend<br>Scripts / CI                           | High     |
| 2026-08-24 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Scripts / CI<br>Other<br>Backend<br>Database<br>Docs<br>Electron<br>Frontend    | High     |
| 2026-08-26 | Review generated artifact updates before commit.      | Documentation and validation review.                                | Scripts / CI                                                                    | Normal   |
| 2026-08-27 | Review generated artifact updates before commit.      | Documentation and validation review.                                | Other                                                                           | Normal   |
| 2026-08-27 | Perform manual QA on the changed auth/device/UI flow. | Auth/device continuation, logout, route access, and toast behavior. | Scripts / CI<br>Backend<br>Docs<br>Frontend                                     | High     |
