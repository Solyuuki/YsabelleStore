# Database Architecture

This document defines the core database design for YsabelleStore. The database must support inventory monitoring, historical sales storage, SARIMA forecasting input, and recommendation outputs.

## Core Tables

| Table             | Purpose                                                            | Key Fields                                                                                                                  |
| ----------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `users`           | Stores local system users and authentication records               | `id`, `name`, `email`, `password_hash`, `role`, `created_at`, `updated_at`                                                  |
| `products`        | Stores product master data                                         | `id`, `name`, `category`, `unit`, `price`, `minimum_stock`, `status`, `created_at`, `updated_at`                            |
| `sales`           | Stores historical product sales used for reports and forecasting   | `id`, `product_id`, `quantity_sold`, `sale_date`, `unit_price`, `total_amount`, `created_at`                                |
| `inventory`       | Stores current product-level stock summary                         | `id`, `product_id`, `current_stock`, `reserved_stock`, `last_updated_at`                                                    |
| `batch_inventory` | Stores batch-level stock and expiration data                       | `id`, `product_id`, `batch_code`, `batch_quantity`, `remaining_quantity`, `expiration_date`, `received_date`                |
| `forecasts`       | Stores generated demand forecast outputs                           | `id`, `product_id`, `forecast_period_start`, `forecast_period_end`, `forecasted_demand`, `confidence_notes`, `generated_at` |
| `recommendations` | Stores recommendation outputs derived from inventory and forecasts | `id`, `product_id`, `forecast_id`, `recommended_restock_quantity`, `alert_type`, `severity`, `reason`, `generated_at`       |
| `audit_logs`      | Stores important system actions for traceability                   | `id`, `user_id`, `action`, `entity_type`, `entity_id`, `details`, `created_at`                                              |

## Forecasting Data Requirements

| Data Type                            | Required Source   | Forecasting Use                                  |
| ------------------------------------ | ----------------- | ------------------------------------------------ |
| Product Data                         | `products`        | Identifies forecast target and stock threshold   |
| Historical Sales Data                | `sales`           | Primary input for SARIMA demand forecasting      |
| Inventory Data                       | `inventory`       | Compares forecasted demand against current stock |
| Batch Inventory with Expiration Date | `batch_inventory` | Supports near expiry and expiry risk analysis    |

## Relationship Overview

```text
products
  -> sales
  -> inventory
  -> batch_inventory
  -> forecasts
  -> recommendations

users
  -> audit_logs
```

## Scope Boundaries

| Out-of-Scope Area      | Database Rule                                    |
| ---------------------- | ------------------------------------------------ |
| Supplier management    | Do not create supplier tables                    |
| Purchase orders        | Do not create purchase order tables              |
| Procurement systems    | Do not model procurement workflows               |
| Restock history module | Do not create a separate restock history feature |
| GCash API              | Do not store payment integration credentials     |

## Expiry Risk Rule

Expiry risk is not forecasted directly by SARIMA. It must be calculated from:

| Input             | Role                                            |
| ----------------- | ----------------------------------------------- |
| Current stock     | Determines available quantity                   |
| Batch quantity    | Identifies quantity tied to expiration date     |
| Expiration date   | Determines time remaining before expiry         |
| Forecasted demand | Estimates likely product movement before expiry |

## Database Validation Checklist

- [ ] Product records support sales, inventory, forecasts, and recommendations
- [ ] Sales history is structured for time-series forecasting
- [ ] Batch inventory includes expiration dates
- [ ] Recommendation records can explain why an alert was generated
- [ ] Out-of-scope supplier and procurement tables are not introduced
