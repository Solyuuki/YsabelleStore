# System Framework

This document defines the primary technology stack and framework boundaries for YsabelleStore. Scope classification belongs in [`../PROJECT-SCOPE.md`](../PROJECT-SCOPE.md); this file should not be used as an absolute product-feature exclusion list.

## Core Stack

| Layer | Framework/Tool | Responsibility |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | Customer/internal UI and client interaction. |
| Styling/UI | Tailwind CSS and repository-approved component patterns | Consistent accessible application UI. |
| Desktop | Electron | Local desktop lifecycle and Windows packaging. |
| Backend | Node.js + Express.js | HTTP/API boundary and domain-service orchestration. |
| Validation | Zod + domain validators | Validate external and cross-layer inputs. |
| ORM | Prisma | Type-safe application persistence boundary. |
| Database | MySQL Community Server | Relational products, sales, inventory, users, forecasts, orders, and related operational data. |
| Forecasting | Python + statsmodels SARIMA/SARIMAX | Seasonal demand forecasting and evaluation. |
| Charts | Recharts with approved fallback where needed | Forecast/report/dashboard visualization. |
| Quality | ESLint, Prettier, Husky, GitHub Actions | Repository consistency and validation. |
| Packaging | electron-builder | Windows desktop packaging. |

## Architecture Principles

- React does not connect directly to Prisma/MySQL.
- Express routes delegate business/domain work through the current service architecture.
- Prisma/schema/migrations define persisted application structure.
- SARIMA logic stays in the forecasting boundary and forecasts demand rather than expiration dates.
- Electron does not expose unrestricted Node access to the renderer.
- Product extensions should reuse these boundaries instead of introducing parallel persistence or business-logic stacks.

## Thesis Alignment

The core research flow remains:

```text
Historical sales
    ↓
SARIMA demand forecast
    ↓
Inventory/batch context
    ↓
Recommendation and risk guidance
```

Customer storefront functionality or later owner-approved supplier integrations may extend the retail workflow without changing the thesis forecasting method. Their scope status must be taken from `docs/PROJECT-SCOPE.md` and their implementation status from current source/tests.

## Technology Change Rule

A new framework should be introduced only when it solves a documented requirement that the current stack cannot reasonably satisfy. Avoid replacing established technology merely for novelty or speculative scale.
