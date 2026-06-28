# Migration Guide

This guide defines how YsabelleStore manages database migrations. Sprint 1 uses the repository numbered naming standard for the initial reviewable migration artifact.

## Migration Philosophy

| Principle                       | Rule                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- |
| History is permanent            | Never edit or rename old migrations after they are shared              |
| Changes are explicit            | Every schema change must create a new migration artifact               |
| Review before execution         | Migrations must be inspected before merge and before local application |
| Small changes are safer         | Prefer focused migrations over bundled schema changes                  |
| Validation is mandatory         | Schema and migration checks must pass before reporting completion      |
| Repository names are sequential | Migration folders must use the repository sequence standard            |

## Current Migration Inventory

| Folder                                        | Status  | Reason                                                                                                                                               |
| --------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_sprint_1_database_foundation`           | Current | Sprint 1 migration artifact renamed after `prisma migrate status` showed no applied Prisma migration history tied to the previous repository folder. |
| `20260628120000_sprint_1_database_foundation` | Retired | Timestamp naming is no longer the repository convention and must not be used for future migration folders.                                           |

## Sequential Naming Standard

Repository migration folders must follow this format:

```text
<sequence>_<task>
```

| Segment    | Rule                                                                                              | Example                                                  |
| ---------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `sequence` | Four digits, zero-padded, automatically incremented from the highest existing repository sequence | `0001`                                                   |
| `task`     | Lowercase snake_case task name                                                                    | `sprint_1_database_foundation`, `add_product_categories` |

Valid examples:

```text
0001_sprint_1_database_foundation
0002_add_product_categories
0003_create_inventory_tables
0004_add_sales_indexes
```

## Sequence Selection Rule

Before creating a new migration folder:

1. List existing migration folders under `database/migrations/`.
2. Find folders that begin with a four-digit sequence such as `0001_`.
3. Determine the highest existing sequence number.
4. Add one.
5. Create the new folder using `<next-sequence>_<task>`.
6. Never reuse a sequence number.
7. Never create a timestamp-based folder.

Because `0001_sprint_1_database_foundation` is now the highest migration sequence, the next migration must start at:

```text
0002_<task>
```

## Prisma Tooling Mapping Strategy

If Prisma tooling creates timestamp-based folders locally during development, do not commit them as-is. Use one of these safe approaches:

| Scenario                                                    | Required Action                                                                                                                        |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma can generate SQL without creating a timestamp folder | Place the reviewed SQL under the numbered repository folder.                                                                           |
| Prisma creates a local timestamp folder before commit       | Rename before sharing, then validate and document the rename in the task artifacts.                                                    |
| Prisma has already applied a timestamp folder               | Do not rename it after application; preserve integrity and create a new corrective or follow-up migration if needed.                   |
| A timestamp folder must remain for technical reasons        | Add a mapping note in this guide and in the member testing report that connects the Prisma folder to the repository sequence standard. |

## Migration Workflow

```text
Confirm approved schema change
  -> determine next sequential migration number
  -> update database/prisma/schema.prisma
  -> run Prisma validation
  -> create focused migration SQL/artifact
  -> inspect generated SQL
  -> apply only to approved local development database when required
  -> run application validation
  -> update implementation artifacts
  -> commit schema, migration, and documentation together
```

## Development Rules

| Rule                                    | Requirement                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| Schema-first changes                    | Update `database/prisma/schema.prisma` from an approved ERD or task decision |
| One purpose per migration               | Keep each migration focused and reviewable                                   |
| Sequential folder names                 | Use `<sequence>_<task>` for migrations                                       |
| No duplicate numbers                    | Determine the highest existing sequence before creating a folder             |
| No timestamp names                      | Never use timestamp-based repository migration folder names                  |
| No manual drift                         | Do not change a database outside the migration workflow                      |
| No secret values                        | Migrations must never contain passwords or environment-specific URLs         |
| No destructive changes without approval | Dropping or renaming data structures requires explicit review                |
| Documentation is required               | Update member artifacts and migration docs before marking the task complete  |

## Rollback Philosophy

| Scenario                          | Preferred Response                                                 |
| --------------------------------- | ------------------------------------------------------------------ |
| Local unshared migration is wrong | Regenerate or rename only before it is committed or applied/shared |
| Shared migration has an issue     | Create a new corrective migration                                  |
| Data-loss risk exists             | Stop and request schema review before proceeding                   |
| Production rollback is needed     | Use a reviewed forward fix unless a formal rollback plan exists    |

## Validation Steps

| Step                     | Command or Review                                                       | Expected Result                                |
| ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------- |
| Sequence check           | Manual folder review under `database/migrations/`                       | New sequence is unique and incremented         |
| Prisma schema syntax     | `npm run prisma:validate`                                               | Schema validates successfully                  |
| Prisma Client generation | `npm run prisma:generate` when client-dependent code changes            | Client generation succeeds                     |
| Generated SQL review     | Manual review                                                           | SQL matches the approved schema change         |
| Migration status         | Prisma migration status against approved local database when applicable | Local database matches migration history       |
| Application build        | `npm run build`                                                         | Build passes after schema integration          |
| Security check           | `npm audit --audit-level=high`                                          | No unresolved high or critical vulnerabilities |

## Current Foundation Artifact

| Item                     | Status                                                                                                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Existing migration SQL   | `database/migrations/0001_sprint_1_database_foundation/migration.sql`                                                  |
| Migration source         | Generated from `database/prisma/schema.prisma` using Prisma diff                                                       |
| Rename status            | Renamed from timestamp folder after safety check confirmed no applied Prisma migration history tied to the folder name |
| Future naming status     | Numbered naming required for all future migrations                                                                     |
| MySQL application status | Not verified in repository evidence                                                                                    |

## Migration Readiness Checklist

- [x] Initial migration artifact exists for review.
- [x] Sprint 1 migration artifact uses the numbered folder convention.
- [x] New changes require new migrations.
- [x] Future migration naming rules are sequential.
- [x] Validation gates are documented.
- [x] Documentation updates are required before completion.
