# Database Foundation

This document records the implemented Sprint 1 database foundation for YsabelleStore. The database layer is prepared for future inventory, sales, SARIMA forecasting, and recommendation modules without implementing those business workflows.

## Architecture Overview

```text
Electron desktop shell
  -> React renderer
  -> Express backend
  -> Prisma Client boundary
  -> MySQL database
  -> Future Python SARIMA service data exchange
```

## Implemented Tables

| Table                    | Purpose                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------ |
| `users`                  | Owner/staff identity boundary for future authentication                              |
| `categories`             | Product grouping for grocery/convenience-store catalog organization                  |
| `products`               | Barcode-ready product master data with cost and selling prices                       |
| `inventory_batches`      | Batch quantity, cost, received date, and expiry tracking                             |
| `inventory_movements`    | Stock-in, stock-out, sale, adjustment, return, expired, and damaged movement history |
| `sales`                  | Sale headers for future POS and historical demand records                            |
| `sale_items`             | Product-level sale lines for future reporting and forecasting input                  |
| `forecast_records`       | Future SARIMA forecast output storage                                                |
| `recommendation_records` | Future restock, stock risk, and expiry-risk recommendation storage                   |

## Data Integrity Decisions

| Decision                    | Implementation                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| Product identifiers         | `sku` is required and unique; `barcode` is optional, unique, and indexed                      |
| Money fields                | Cost, price, and totals use Prisma `Decimal` mapped to MySQL `DECIMAL`                        |
| Quantity fields             | Stock and sale quantities use unsigned integers                                               |
| Product deletion            | Product-dependent records use restrictive relations to preserve history                       |
| Sale deletion               | Sale items cascade with their sale header                                                     |
| Optional user attribution   | Cashier, movement performer, forecast generator, and recommendation generator use `SET NULL`  |
| Expiry support              | Inventory batches include nullable `expires_at` and expiry-focused indexes                    |
| Forecast traceability       | Forecasts are unique per product, period, and model name                                      |
| Recommendation traceability | Recommendations can link to forecast records while remaining valid if the forecast is removed |

## Index Strategy

| Query Need           | Indexes                                                                  |
| -------------------- | ------------------------------------------------------------------------ |
| Product lookup       | Product `sku`, `barcode`, `name`, and category/active indexes            |
| Inventory review     | Batch product/status, product/expiry, and expiry indexes                 |
| Movement history     | Movement product/date, type/date, batch, and performed-by indexes        |
| Sales reporting      | Sale number, sale date, status/date, cashier, sale item product indexes  |
| Forecast review      | Forecast product/generated, status/generated, generated-by indexes       |
| Recommendation queue | Recommendation product/severity, type/status, forecast, and date indexes |

## Migration Strategy

The first migration artifact is stored at:

```text
database/migrations/0001_sprint_1_database_foundation/migration.sql
```

This SQL is generated from the current Prisma schema for review. It should be applied only against an approved local MySQL database after the team confirms the schema and environment.

## Seed Strategy

Sprint 1 documents the seed strategy but does not add executable seed data. Future seed work should create deterministic development records only after the first database migration is accepted.

## Validation Workflow

| Check                     | Command or Review                                          | Expected Result               |
| ------------------------- | ---------------------------------------------------------- | ----------------------------- |
| Prisma syntax             | `npm run prisma:validate` with a safe local `DATABASE_URL` | Schema validates successfully |
| Prisma Client generation  | `npm run prisma:generate` with a safe local `DATABASE_URL` | Client generation succeeds    |
| Application build         | `npm run build` with a safe local `DATABASE_URL`           | All workspaces compile        |
| Documentation consistency | Manual review                                              | Docs match implemented schema |
| Formatting                | `npm run format:check`                                     | Repository is formatted       |

## Foundation Completion Checklist

- [x] Core Prisma models are implemented
- [x] Relationships and delete/update behavior are explicit
- [x] Unique fields and indexes support common inventory, sales, forecast, and recommendation queries
- [x] Migration artifact is available for review
- [x] Seed strategy is documented
- [x] Backend has a Prisma client access boundary
- [x] SARIMA execution and recommendation formulas remain later-sprint scope
