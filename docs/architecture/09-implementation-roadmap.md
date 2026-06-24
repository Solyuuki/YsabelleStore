# Implementation Roadmap

This roadmap defines the recommended implementation sequence before Sprint 1 begins.

## Roadmap Table

| Phase | Goal | Output |
| --- | --- | --- |
| Sprint 0: Repository Governance and Standards | Establish project rules, ownership, workflow, and documentation foundation | README, standards, member artifacts, GitHub workflow |
| Pre-Sprint 1: Architecture and Framework Documentation | Define official system blueprint and architecture boundaries | `docs/architecture/` package |
| Sprint 1: Application Scaffolding | Create initial React, Electron, Express, Prisma, and Python service foundations | Working project skeleton with development commands |
| Sprint 2: Database and Backend Foundation | Design schema, migrations, API structure, validation, and core services | MySQL/Prisma foundation and backend API base |
| Sprint 3: Product, Sales, and Inventory Modules | Build product, sales, inventory, batch, and import workflows | Operational data entry and inventory monitoring |
| Sprint 4: SARIMA Forecasting Engine | Implement Python forecasting service using historical sales data | Validated demand forecasts |
| Sprint 5: Recommendation Engine and Alerts | Convert forecasts and inventory state into recommendation outputs | Restock, low stock, overstock, near expiry, and expiry risk alerts |
| Sprint 6: UI Polish, Testing, Packaging, and Defense Preparation | Finalize dashboards, validation, tests, packaging, and thesis evidence | Evaluator-ready Windows desktop application |

## Implementation Sequence

```text
Governance
  -> Architecture
  -> Application Scaffold
  -> Database and API Foundation
  -> Operational Modules
  -> SARIMA Forecasting
  -> Recommendation Engine
  -> Testing and Packaging
```

## Phase Entry Criteria

| Phase | Entry Criteria |
| --- | --- |
| Sprint 1 | Architecture package approved and repository standards understood |
| Sprint 2 | Application scaffold runs locally |
| Sprint 3 | Database schema and backend base are validated |
| Sprint 4 | Sales data is available in a forecasting-ready structure |
| Sprint 5 | Forecast output contract is stable |
| Sprint 6 | Core workflows are functional and testable |

## Scope Control Rules

| Rule | Purpose |
| --- | --- |
| Prioritize thesis flow | Keep Sales Data -> SARIMA Forecast -> Inventory Recommendation central |
| Avoid procurement features | Supplier management, purchase orders, and procurement systems are out of scope |
| Avoid cloud requirements | System must remain local desktop deployable |
| Validate before expanding | New modules require architecture and ownership review |

## Roadmap Validation Checklist

- [ ] Sprint order supports the thesis flow
- [ ] Architecture is documented before scaffolding
- [ ] Database and backend are ready before forecasting integration
- [ ] Recommendation engine waits for validated forecasts
- [ ] Packaging occurs after core workflows are stable

