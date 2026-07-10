# m3 Task Register

## Completed

| Task ID        | Date       | Scope                                                | Affected Files/Modules                                                                           | Evidence                                 | Validation                                                           |
| -------------- | ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| YSB-M3-DB-001  | 2026-06-25 | Initial database foundation structure                | `database/**`                                                                                    | Commit `bbbfdc7` in shared history       | Later Prisma validation confirms schema path validity.               |
| YSB-S1-009     | 2026-06-28 | Initial Prisma schema foundation                     | `database/prisma/schema.prisma`                                                                  | Commit `1a732c3`, sprint merge `dd53be7` | Prisma validation recorded by M3 and re-run on 2026-06-29.           |
| YSB-S1-010     | 2026-06-28 | Relationships, constraints, and indexes              | `database/prisma/schema.prisma`                                                                  | Commit `1a732c3`                         | Schema review and Prisma validation.                                 |
| YSB-S1-011     | 2026-06-28 | Migration readiness and seed strategy                | `database/migrations/0001_sprint_1_database_foundation/migration.sql`, `database/seed/README.md` | Commit `1a732c3`, sprint merge `dd53be7` | Migration SQL review recorded; local MySQL application not recorded. |
| YSB-S1-012     | 2026-06-28 | Database documentation alignment                     | `database/README.md`, `database/docs/**`, `database/prisma/README.md`                            | Commit `1a732c3`, sprint merge `dd53be7` | Documentation review; final format check pending this update.        |
| YSB-M3-BE-001  | 2026-06-29 | Backend Prisma boundary support                      | `backend/src/database/prismaClient.ts`, `backend/src/controllers/healthController.ts`            | Sprint branch `dd53be7`                  | Backend build and Prisma validation passed on 2026-06-29.            |
| YSB-M3-DOC-001 | 2026-06-29 | M3 artifact reconstruction and migration naming rule | `docs/implementation-artifacts/m3-vito/**`, `database/docs/**`                                   | Current documentation-only work          | Final validation pending after docs update.                          |

## In Progress

| Task ID              | Scope                                                          | Status             | Evidence                                                                               | Next Action                                           |
| -------------------- | -------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| YSB-M3-MIG-STD-001   | Numbered migration naming standard                             | Done               | Sprint 1 migration folder renamed to `0001_sprint_1_database_foundation`; docs updated | Validate Prisma and backend commands.                 |
| YSB-M3-VITO-20260710 | Preserve artifact markdown templates during automation updates | Manual QA Required | sprint/v0.3/sprint-3                                                                   | Perform manual QA on the changed auth/device/UI flow. |

## Pending

| Task ID              | Scope                                            | Reason Pending                                                       | Required Evidence Before Completion                                              |
| -------------------- | ------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| YSB-M3-MIG-APPLY-001 | Apply migration to approved local MySQL database | Current migration is a reviewable SQL artifact only.                 | Prisma migration/status output or documented local database application result.  |
| YSB-M3-SEED-001      | Executable deterministic seed script             | Sprint 1 only documents seed strategy.                               | Approved seed data policy, script, and validation result.                        |
| YSB-M3-FOR-001       | SARIMA forecasting execution                     | Later sprint scope; requires approved sales history flow.            | Forecasting service implementation, validation dataset, and explainable results. |
| YSB-M3-REC-001       | Recommendation calculation rules                 | Later sprint scope; depends on forecast and inventory workflows.     | Formula documentation, tests, and database/API integration.                      |
| YSB-M3-BIZ-001       | Product data foundation for Sprint 3             | Sprint 3 planning now shifts product ownership into functional work. | Product model/API foundation and sample product data.                            |
| YSB-M3-BIZ-002       | Inventory data foundation for Sprint 3           | Inventory must support POS and SARIMA consumers.                     | Inventory model/API foundation and stock movement notes.                         |

## Cancelled

| Task ID       | Scope                         | Reason                                                                     | Evidence                                                                                        |
| ------------- | ----------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| YSB-M3-FE-001 | M3 frontend replacement files | Frontend shell/pages/components are M1-owned and out of M3 database scope. | M3 branch diff shows frontend replacements; current sprint branch preserves M1 frontend source. |

## Completion Rule

M3 database tasks require schema, migration, documentation, validation, and implementation artifacts before they can be marked complete.
