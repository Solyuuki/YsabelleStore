# Database Foundation

This document defines the database foundation for YsabelleStore before schema implementation. It prepares the project for a future MySQL and Prisma database without creating business tables, fields, migrations, seed data, or runtime connections.

## Purpose

| Purpose              | Description                                                                           |
| -------------------- | ------------------------------------------------------------------------------------- |
| System persistence   | Prepare the future storage layer for inventory, sales, forecasts, and recommendations |
| Architecture control | Define where database decisions are recorded before implementation                    |
| Team alignment       | Give contributors consistent rules for Prisma, MySQL, migrations, and seeds           |
| Thesis readiness     | Keep database work explainable, auditable, and evaluator-friendly                     |

## Architecture Overview

```text
Application Layers
|-- Electron desktop shell
|-- React renderer
|-- Express backend
|-- Future Prisma Client
|-- MySQL database
`-- Forecasting service data exchange
```

## Database Foundation Diagram

```text
database/
|-- prisma/schema.prisma
|   |-- generator
|   |-- datasource
|   `-- future model sections
|-- migrations/.gitkeep
|-- seed/.gitkeep
`-- docs/
    |-- architecture rules
    |-- ERD plan
    |-- naming conventions
    `-- migration guide
```

## Tool Responsibility Matrix

| Tool or Layer | Role                              | Foundation Phase Behavior                              |
| ------------- | --------------------------------- | ------------------------------------------------------ |
| Prisma schema | Future schema source of truth     | Holds generator, datasource, and section comments only |
| Prisma Client | Future typed database access      | Not generated in this phase                            |
| MySQL         | Future relational database engine | Not connected in this phase                            |
| Migrations    | Future schema change history      | Folder reserved with `.gitkeep`                        |
| Seed scripts  | Future development data setup     | Folder reserved with documentation only                |

## Prisma Role

| Responsibility   | Standard                                                             |
| ---------------- | -------------------------------------------------------------------- |
| Model definition | Added only after schema implementation approval                      |
| Field naming     | Use camelCase in Prisma and map to database naming when required     |
| Table mapping    | Use stable snake_case table names in MySQL                           |
| Validation       | Use `npm run prisma:validate` for syntax checks                      |
| Generation       | Generate Prisma Client only during the approved implementation phase |

## MySQL Role

| Responsibility         | Standard                                                  |
| ---------------------- | --------------------------------------------------------- |
| Durable storage        | Store future operational and analytical records           |
| Relational integrity   | Enforce future relationships after schema approval        |
| Reporting support      | Preserve sales and inventory history for reporting        |
| Forecasting support    | Provide clean historical sales input for SARIMA workflows |
| Recommendation support | Store explainable future recommendation outputs           |

## Decision Matrix

| Decision Area   | Foundation Decision        | Reason                                                        |
| --------------- | -------------------------- | ------------------------------------------------------------- |
| ORM             | Prisma                     | Provides typed schema validation and backend integration path |
| Database engine | MySQL                      | Matches the relational needs of inventory and sales records   |
| Migrations      | Prisma-managed             | Keeps schema changes reviewable and repeatable                |
| Seeds           | Controlled project scripts | Prevents inconsistent development data                        |
| Credentials     | Environment variables      | Avoids hardcoded database secrets                             |

## Migration Philosophy

| Rule                                           | Explanation                                                 |
| ---------------------------------------------- | ----------------------------------------------------------- |
| Create migrations from approved schema changes | Keeps history tied to reviewed model changes                |
| Never edit old migrations                      | Preserves reproducibility and team trust                    |
| Keep migrations focused                        | Makes review and rollback reasoning simpler                 |
| Validate before commit                         | Prevents broken schema history from entering the repository |

## Seed Philosophy

| Rule                               | Explanation                                         |
| ---------------------------------- | --------------------------------------------------- |
| Seed only after models exist       | Prevents data from driving unapproved schema design |
| Use deterministic records          | Keeps local verification repeatable                 |
| Keep seed data small               | Supports fast setup and clear debugging             |
| Separate fake data from production | Protects thesis and production integrity            |

## Development Workflow

```text
Foundation docs
  -> ERD review
  -> Prisma model implementation
  -> Prisma validation
  -> Migration creation
  -> Seed design
  -> Backend integration
```

| Stage      | Required Action                          | Exit Gate                     |
| ---------- | ---------------------------------------- | ----------------------------- |
| Foundation | Maintain structure and documentation     | No models or migrations exist |
| Design     | Review future entities and relationships | ERD plan accepted             |
| Schema     | Add Prisma models and mappings           | `prisma validate` passes      |
| Migration  | Create focused migration files           | Migration review passes       |
| Seed       | Add deterministic development data       | Seed workflow is repeatable   |

## Validation Workflow

| Check                     | Command or Review                      | Expected Result                                              |
| ------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| Folder structure          | Manual review                          | Required folders and files exist                             |
| Prisma syntax             | `npm run prisma:validate`              | Schema is valid                                              |
| Documentation consistency | Manual review                          | Terms and naming match across docs                           |
| Scope guardrail           | Manual review                          | No models, migrations, seed scripts, or business logic exist |
| Formatting                | `npm run format:check` when applicable | Markdown and schema formatting are stable                    |

## Foundation Completion Checklist

- [x] Database folder is structured for Prisma, migrations, seeds, and documentation
- [x] Prisma schema has generator and datasource only
- [x] Future domain sections are documented as comments only
- [x] Migration folder is reserved without migration files
- [x] Seed folder is reserved without seed scripts or data
- [x] Database documentation defines workflows and guardrails
