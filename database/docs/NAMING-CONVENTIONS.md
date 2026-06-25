# Database Naming Conventions

This document defines naming standards for future YsabelleStore database implementation. It aligns Prisma readability with MySQL consistency while keeping the current foundation free from implemented models.

## Naming Decision Matrix

| Layer         | Standard                           | Example                          |
| ------------- | ---------------------------------- | -------------------------------- |
| Prisma models | PascalCase singular                | `Product`, `BatchInventory`      |
| Prisma fields | camelCase                          | `createdAt`, `expirationDate`    |
| MySQL tables  | snake_case plural                  | `products`, `batch_inventory`    |
| MySQL columns | snake_case                         | `created_at`, `expiration_date`  |
| Foreign keys  | snake_case with referenced entity  | `product_id`, `forecast_id`      |
| Indexes       | descriptive snake_case with prefix | `idx_sales_product_id`           |
| Migrations    | timestamp plus snake_case purpose  | `20260701090000_create_products` |

## Table Naming

| Rule              | Standard                                  | Examples            |
| ----------------- | ----------------------------------------- | ------------------- |
| Use snake_case    | Lowercase words separated by underscores  | `historical_sales`  |
| Use plural nouns  | Tables store collections                  | `users`, `products` |
| Avoid vague names | Name the business concept directly        | `batch_inventory`   |
| Keep names stable | Renames require explicit migration review | `recommendations`   |

## Approved Future Table Name Examples

| Future Area               | Table Name Example | Notes                                            |
| ------------------------- | ------------------ | ------------------------------------------------ |
| Users                     | `users`            | Future local users and accountability            |
| Products                  | `products`         | Future product master data                       |
| Sales history             | `sales`            | Future operational sales history                 |
| Imported historical sales | `historical_sales` | Use only if a separate import source is approved |
| Inventory summary         | `inventory`        | Future stock summary                             |
| Batch inventory           | `batch_inventory`  | Future expiration-aware stock batches            |
| Forecasts                 | `forecasts`        | Future demand forecast outputs                   |
| Recommendations           | `recommendations`  | Future inventory guidance outputs                |

## Prisma Field Naming

| Rule                               | Standard                                                 | Example                                |
| ---------------------------------- | -------------------------------------------------------- | -------------------------------------- |
| Use camelCase in Prisma            | Keeps TypeScript access idiomatic                        | `minimumStock`                         |
| Map database columns when needed   | Use future Prisma mapping to preserve snake_case columns | `minimumStock` maps to `minimum_stock` |
| Keep field names business-readable | Avoid abbreviations unless widely understood             | `expirationDate`                       |
| Use consistent timestamps          | Prefer clear lifecycle names                             | `createdAt`, `updatedAt`               |

## Database Column Naming

| Column Type | Standard                           | Example                               |
| ----------- | ---------------------------------- | ------------------------------------- |
| Primary key | `id`                               | `id`                                  |
| Foreign key | `{referenced_table_singular}_id`   | `product_id`                          |
| Timestamp   | snake_case event name              | `created_at`, `updated_at`            |
| Boolean     | clear state phrase                 | `is_active`                           |
| Quantity    | noun plus unit context when needed | `quantity_sold`, `remaining_quantity` |

## Foreign Key Naming

| Relationship Intent          | Foreign Key Example | Reason                     |
| ---------------------------- | ------------------- | -------------------------- |
| Sales belongs to product     | `product_id`        | Identifies the sold item   |
| Forecast belongs to product  | `product_id`        | Identifies forecast target |
| Recommendation uses forecast | `forecast_id`       | Preserves traceability     |
| Audit event belongs to user  | `user_id`           | Supports accountability    |

## Index Naming

| Index Type               | Pattern                             | Example                          |
| ------------------------ | ----------------------------------- | -------------------------------- |
| Standard index           | `idx_{table}_{column}`              | `idx_sales_product_id`           |
| Composite index          | `idx_{table}_{column_a}_{column_b}` | `idx_sales_product_id_sale_date` |
| Unique index             | `uq_{table}_{column}`               | `uq_users_email`                 |
| Foreign key helper index | `idx_{table}_{foreign_key}`         | `idx_forecasts_product_id`       |

## Migration Naming

| Rule                           | Pattern                       | Example                           |
| ------------------------------ | ----------------------------- | --------------------------------- |
| Use generated timestamp prefix | `YYYYMMDDHHMMSS_description`  | `20260701090000_create_products`  |
| Use snake_case description     | Lowercase and specific        | `add_sales_history_indexes`       |
| Describe one focused change    | Avoid bundled migration names | `create_inventory_tables`         |
| Avoid vague wording            | No generic labels             | `update_schema` is not acceptable |

## Consistency Checklist

- [x] Prisma names remain TypeScript-friendly
- [x] MySQL names remain snake_case and stable
- [x] Foreign keys reveal the referenced entity
- [x] Index names reveal table and column purpose
- [x] Migration names describe focused schema changes
- [x] Naming rules do not require implementing models during the foundation phase
