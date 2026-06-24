# System Architecture

This document defines the official baseline architecture for YsabelleStore.

## Architecture Diagram

```text
Electron Desktop App
|
v
React + TypeScript + Tailwind + shadcn/ui
|
v
Express.js Backend
|
v
Prisma ORM
|
v
MySQL Community Server
|
v
Python SARIMA Engine
|
v
Recommendation Engine
```

## Layer Responsibilities

| Layer | Responsibility | Primary Owner |
| --- | --- | --- |
| Electron Desktop App | Hosts the local desktop application and packaging workflow | m1 |
| React + TypeScript + Tailwind + shadcn/ui | Provides dashboards, forms, tables, alerts, charts, and user workflows | m1 |
| Express.js Backend | Handles API routes, validation, business logic, and forecasting service communication | m2 |
| Prisma ORM | Provides type-safe database access and migration management | m2 |
| MySQL Community Server | Stores users, products, sales, inventory, batches, forecasts, recommendations, and audit logs | m2 |
| Python SARIMA Engine | Produces demand forecasts from historical sales data | m3 |
| Recommendation Engine | Converts forecasts and inventory state into actionable inventory outputs | m3 |

## Core Thesis Flow

```text
Historical Sales Data
  -> SARIMA Forecast
  -> Forecasted Demand
  -> Inventory and Batch Analysis
  -> Recommendation Engine
  -> Restock and Risk Alerts
```

## Recommendation Outputs

| Output | Source Data | Purpose |
| --- | --- | --- |
| Recommended Restock Quantity | Forecasted demand, current stock, thresholds | Suggests replenishment quantity |
| Low Stock Alert | Current inventory and minimum stock level | Flags stock below operating threshold |
| Overstock Alert | Current inventory and forecasted demand | Flags inventory above expected movement |
| Near Expiry Alert | Batch expiration date and current date | Flags batches approaching expiration |
| Expiry Risk Alert | Current stock, batch quantity, expiration date, forecasted demand | Flags stock likely to expire before demand consumes it |

## Architecture Rules

| Rule | Requirement |
| --- | --- |
| UI boundary | React components must not directly access the database |
| API boundary | Express routes must delegate business logic to services |
| Database boundary | Prisma is the approved database access layer |
| Forecasting boundary | SARIMA logic stays in the Python forecasting engine |
| Recommendation boundary | Expiry risk must be calculated from stock, expiration date, batch quantity, and forecasted demand |

## Good vs Bad Architecture

| Good | Bad |
| --- | --- |
| React calls Express service endpoints | React connects directly to MySQL |
| Express calls a forecasting service wrapper | API route contains raw SARIMA model code |
| Prisma migrations describe schema changes | Manual database edits are undocumented |
| Recommendation output includes reason and source values | Recommendation output returns unexplained numbers |

