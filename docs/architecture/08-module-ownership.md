# Module Ownership

This document defines recommended team ownership for architecture and implementation planning.

## Primary Ownership

| Member       | Primary Ownership                                                               |
| ------------ | ------------------------------------------------------------------------------- |
| m1 - Abarado | Frontend UI, dashboard shell, Electron packaging support, documentation quality |
| m2 - Ramos   | Express backend, Prisma schema, MySQL migrations, API endpoints                 |
| m3 - Vito    | Python SARIMA engine, analytics, recommendation logic, forecast validation      |

## Module Ownership Matrix

| Module                       | Primary Owner | Review Support                             |
| ---------------------------- | ------------- | ------------------------------------------ |
| Frontend dashboard shell     | m1            | m2 for API contract, m3 for chart data     |
| Product and inventory UI     | m1            | m2 for backend behavior                    |
| Electron packaging           | m1            | m2 for backend startup assumptions         |
| Express API                  | m2            | m1 for UI needs, m3 for forecast endpoints |
| Prisma schema and migrations | m2            | m3 for forecasting data needs              |
| CSV and Excel imports        | m2            | m1 for import UI                           |
| SARIMA forecasting engine    | m3            | m2 for sales data source                   |
| Recommendation logic         | m3            | m1 for UI display, m2 for data contract    |
| Documentation standards      | m1            | All members for affected domain            |

## Shared Review Responsibilities

| Change Type                                 | Required Review      |
| ------------------------------------------- | -------------------- |
| API response shape changes                  | m1 and m2            |
| Forecast request or output contract changes | m2 and m3            |
| Recommendation display changes              | m1 and m3            |
| Database schema changes affecting forecasts | m2 and m3            |
| Electron startup behavior changes           | m1 and m2            |
| Architecture standard changes               | All affected members |

## Ownership Guardrails

| Rule                         | Enforcement                                                        |
| ---------------------------- | ------------------------------------------------------------------ |
| Respect assigned ownership   | PR must list affected files and owners                             |
| Avoid bundled work           | One PR should focus on one module or one coherent task             |
| Ask before cross-owner edits | Owner approval is required before changing another member's module |
| Document validation          | Each member records checks in implementation artifacts             |

## Validation Checklist

- [ ] Task owner is identified before work begins
- [ ] Shared modules have required reviewers
- [ ] Affected files are documented in PR and artifacts
- [ ] Cross-owner changes are approved
- [ ] No member ownership rule is bypassed
