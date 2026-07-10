# Prisma Foundation

The Prisma folder contains the official schema entry point for the YsabelleStore MySQL database.

## Current Contents

| File             | Purpose                                                                                    | Status            |
| ---------------- | ------------------------------------------------------------------------------------------ | ----------------- |
| `schema.prisma`  | Declares Prisma Client generation, MySQL datasource, enums, models, relations, and indexes | Implemented       |
| Generated client | Produced by `npm run prisma:generate` into `node_modules/@prisma/client`                   | Generated locally |

## Implemented Model Groups

| Group           | Models or Enums                                                                     |
| --------------- | ----------------------------------------------------------------------------------- |
| Users           | `User`, `UserRole`, `UserStatus`                                                    |
| Catalog         | `Category`, `Product`, `ProductUnit`, `ProductStatus`                               |
| Inventory       | `Inventory`, `InventoryBatch`, `InventoryMovement`, movement and batch status enums |
| Sales           | `Sale`, `SaleItem`, `SaleStatus`                                                    |
| Forecasting     | `ForecastRecord`, `ForecastStatus`                                                  |
| Recommendations | `RecommendationRecord`, recommendation type, severity, and status enums             |

## Guardrails

- Keep credentials out of the schema.
- Use `env("DATABASE_URL")` for the datasource URL.
- Keep Prisma names TypeScript-friendly and map tables/columns to stable MySQL names.
- Do not add business logic, SARIMA execution, or recommendation formulas to the schema.
- Regenerate Prisma Client after schema changes before building backend code.
- Keep the inventory summary table separate from inventory movement history.

## Validation Commands

```bash
set DATABASE_URL=mysql://root:password@localhost:3306/ysabelle_store_validation
npm run prisma:validate
npm run prisma:generate
```
