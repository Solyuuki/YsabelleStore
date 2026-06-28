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

## Structure Overview

```text
database/
|-- prisma/
|   |-- schema.prisma
|   `-- README.md
|-- migrations/
|   |-- 20260628120000_sprint_1_database_foundation/
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

The existing Sprint 1 migration folder keeps its timestamp name because it is already shared in branch history:

```text
database/migrations/20260628120000_sprint_1_database_foundation/
```

Do not rename this folder directly. Future migrations must use the repository sequential standard defined in `database/docs/MIGRATION-GUIDE.md`:

```text
<sequence>-<member>-<task>
```

Examples:

```text
0001-m3-product-schema
0002-m2-auth-module
0003-m1-dashboard-layout
```

Before creating a new migration, determine the highest existing four-digit sequence under `database/migrations/`, increment it, and never reuse a number.

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
