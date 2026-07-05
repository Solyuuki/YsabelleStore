# Database Foundation

This folder is the controlled database foundation for YsabelleStore. Sprint 1 now includes the approved Prisma schema foundation for future authentication, product, inventory, sales, forecasting, and recommendation modules.

## Responsibility Matrix

| Area          | Responsibility                                                             | Current Phase Rule                           |
| ------------- | -------------------------------------------------------------------------- | -------------------------------------------- |
| Prisma schema | Owns approved foundation models, relationships, constraints, and indexes   | Keep persistence-only; no feature logic      |
| Migrations    | Stores reviewable SQL migration artifacts generated from the schema        | Apply only against an approved local MySQL   |
| Seed          | Documents deterministic seed strategy for future implementation            | Strategy only; no production-like fake data  |
| Database docs | Records schema decisions, naming, migration workflow, and validation rules | Keep aligned with `schema.prisma`            |
| Environment   | Documents the `DATABASE_URL` contract                                      | Never hardcode credentials in committed code |

## Local Docker MySQL

Sprint 2 adds a database-only Docker Compose setup so every member can use the same local MySQL version and credentials without manually creating a database first.

The root `.env` file is the main development environment file. Create it from `.env.example`, then start MySQL:

```bash
npm ci
cp .env.example .env
docker compose up -d
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

The Docker MySQL settings are:

| Variable              | Development Value                                                       |
| --------------------- | ----------------------------------------------------------------------- |
| `MYSQL_DATABASE`      | `ysabelle_store`                                                        |
| `MYSQL_USER`          | `ysabelle_user`                                                         |
| `MYSQL_PASSWORD`      | `ysabelle_password`                                                     |
| `MYSQL_ROOT_PASSWORD` | `ysabelle_root_password`                                                |
| `DATABASE_URL`        | `mysql://ysabelle_user:ysabelle_password@localhost:3306/ysabelle_store` |

Stop MySQL:

```bash
docker compose down
```

Reset MySQL data:

Warning: this deletes the local Docker database volume and all local database data.

```bash
docker compose down -v
docker compose up -d
```

Validate the Prisma schema after MySQL is running:

```bash
npm run prisma:validate
```

## Structure Overview

```text
database/
|-- prisma/
|   |-- schema.prisma
|   `-- README.md
|-- migrations/
|   |-- 0001_sprint_1_database_foundation/
|   |   `-- migration.sql
|   `-- .gitkeep
|-- seed/
|   |-- README.md
|   `-- .gitkeep
|-- docs/
|   |-- DATABASE-FOUNDATION.md
|   |-- ERD-PLAN.md
|   |-- NAMING-CONVENTIONS.md
|   `-- MIGRATION-GUIDE.md
|-- .env.example
`-- README.md
```

## Migration Naming Standard

The Sprint 1 migration folder uses the numbered repository convention:

```text
database/migrations/0001_sprint_1_database_foundation/
```

Future migrations must use the same sequential standard defined in `database/docs/MIGRATION-GUIDE.md`:

```text
<sequence>_<task>
```

Examples:

```text
0001_sprint_1_database_foundation
0002_add_products
0003_add_batches
0004_add_forecast_tables
```

Before creating a new migration, determine the highest existing four-digit sequence under `database/migrations/`, increment it by one, never reuse a number, and never use timestamp-based migration folder names.

## Implemented Foundation

| Area             | Implemented Contract                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| Authentication   | `User`, `UserRole`, and `UserStatus` support owner/staff boundaries             |
| Product catalog  | `Category` and `Product` support 300+ grocery/convenience-store products        |
| Barcode lookup   | Product `barcode` is unique and indexed while remaining optional                |
| Inventory        | `InventoryBatch` tracks received quantity, remaining quantity, cost, and expiry |
| Stock movement   | `InventoryMovement` records stock-in, stock-out, sale, adjustment, and loss     |
| Sales history    | `Sale` and `SaleItem` preserve future sales records for reporting and SARIMA    |
| Forecast storage | `ForecastRecord` stores future SARIMA output metadata and demand values         |
| Recommendations  | `RecommendationRecord` stores future restock and risk outputs                   |

## Foundation Boundaries

| Allowed Now                                  | Reserved for Later                                 |
| -------------------------------------------- | -------------------------------------------------- |
| Prisma models and enums                      | Product, inventory, and sales CRUD routes          |
| Relations, unique constraints, and indexes   | POS workflow and inventory transaction automation  |
| Reviewable initial migration SQL             | Applying migrations to shared or production data   |
| Seed strategy documentation                  | Seed execution scripts and realistic sample volume |
| Backend Prisma client access boundary        | Business services that query Prisma models         |
| Forecast and recommendation storage contract | SARIMA execution and recommendation calculations   |

## Validation Checklist

- [x] Database folder has a clear ownership boundary
- [x] Prisma schema includes approved Sprint 1 foundation models
- [x] Relationships, unique fields, decimal money fields, and lookup indexes are defined
- [x] Initial migration artifact is present for review
- [x] Seed strategy is documented without adding production-like data
- [x] Documentation reflects implemented schema decisions
- [x] Future migration naming standard is documented
