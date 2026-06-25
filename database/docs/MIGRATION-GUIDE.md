# Migration Guide

This guide defines how YsabelleStore will manage future database migrations. The current foundation phase creates no migrations.

## Migration Philosophy

| Principle               | Rule                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| History is permanent    | Never edit old migrations after they are shared                   |
| Changes are explicit    | Every schema change must create a new migration                   |
| Review before execution | Migrations must be inspected before merge                         |
| Small changes are safer | Prefer focused migrations over bundled schema changes             |
| Validation is mandatory | Schema and migration checks must pass before reporting completion |

## Future Migration Workflow

```text
Update approved Prisma schema
  -> run Prisma validation
  -> create focused migration
  -> inspect generated SQL
  -> apply in local development
  -> run application validation
  -> commit schema and migration together
```

## Development Rules

| Rule                                    | Requirement                                                          |
| --------------------------------------- | -------------------------------------------------------------------- |
| Schema-first changes                    | Update `database/prisma/schema.prisma` from an approved ERD decision |
| One purpose per migration               | Keep each migration focused and reviewable                           |
| No manual drift                         | Do not change the database outside the migration workflow            |
| No secret values                        | Migrations must never contain passwords or environment-specific URLs |
| No destructive changes without approval | Dropping or renaming data structures requires explicit review        |

## Rollback Philosophy

| Scenario                          | Preferred Response                                              |
| --------------------------------- | --------------------------------------------------------------- |
| Local unshared migration is wrong | Regenerate only before it is committed or shared                |
| Shared migration has an issue     | Create a new corrective migration                               |
| Data-loss risk exists             | Stop and request schema review before proceeding                |
| Production rollback is needed     | Use a reviewed forward fix unless a formal rollback plan exists |

## Naming Standards

| Item             | Standard                                     | Example                                   |
| ---------------- | -------------------------------------------- | ----------------------------------------- |
| Migration folder | Prisma timestamp plus snake_case description | `20260701090000_create_products`          |
| Description      | Verb plus target concept                     | `create_inventory_tables`                 |
| Scope            | One focused schema concern                   | `add_sales_forecast_links`                |
| Review label     | Conventional Commit format                   | `feat(database): add inventory migration` |

## Validation Steps

| Step                 | Command or Review                      | Expected Result                                |
| -------------------- | -------------------------------------- | ---------------------------------------------- |
| Prisma schema syntax | `npm run prisma:validate`              | Schema validates successfully                  |
| Generated SQL review | Manual review                          | SQL matches the approved schema change         |
| Migration status     | Future Prisma migration status command | Local database matches migration history       |
| Application build    | `npm run build`                        | Build passes after schema integration          |
| Security check       | `npm audit`                            | No unresolved high or critical vulnerabilities |

## Current Foundation Rule

| Item                     | Status                     |
| ------------------------ | -------------------------- |
| Migration files          | Not created in this phase  |
| Migration commands       | Not executed in this phase |
| MySQL connection         | Not required in this phase |
| Prisma Client generation | Not executed in this phase |

## Migration Readiness Checklist

- [x] Migration folder exists for future use
- [x] Old migrations are protected by policy
- [x] New changes require new migrations
- [x] Naming rules are defined before implementation
- [x] Validation gates are documented
