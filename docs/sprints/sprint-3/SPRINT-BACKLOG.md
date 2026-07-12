# Sprint 3 Backlog

Sprint 3 backlog items are grouped around product data, inventory data, POS, sales, forecasting, reports, integration
QA, and documentation. The sprint goal is to establish a usable business workflow foundation rather than a final
feature-complete system.

## Sprint Ownership Summary

| Member       | Role                                | Updated Scope                                                                                        | Status Target              |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------- |
| M1 / Abarado | Fullstack / Integration Lead        | UI cleanup, POS, Sales, app shell consistency, integration QA, merge conflict handling               | Integration and validation |
| M2 / Ramos   | SARIMA / Forecasting / Reports Lead | Forecasting foundation, SARIMA service structure, forecast contract, reports foundation              | Forecast foundation        |
| M3 / Vito    | Products / Inventory Lead           | Product data foundation, inventory data foundation, stock movement logic, clean data for forecasting | Data foundation            |

## M1 - UI Cleanup, POS, Sales, and Integration

| ID        | Owner        | Module                                                                         | Task                                                          | Type                  | Priority | Dependencies                   | Status  |
| --------- | ------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | --------------------- | -------- | ------------------------------ | ------- |
| S3-M1-001 | M1 / Abarado | Dashboard, POS, Products, Inventory, Sales, Forecast, Reports, Users, Settings | UI cleanup audit across visible pages                         | UI / QA               | P0       | Existing shell pages           | Planned |
| S3-M1-002 | M1 / Abarado | Dashboard and module shells                                                    | Fix cramped spacing and alignment issues                      | UI / QA               | P0       | S3-M1-001                      | Planned |
| S3-M1-003 | M1 / Abarado | POS                                                                            | Implement product search and scan interaction                 | Feature / Integration | P0       | Product API foundation from M3 | Planned |
| S3-M1-004 | M1 / Abarado | POS                                                                            | Connect POS to product and inventory backend endpoints        | Integration           | P0       | S3-M1-003, M3 API work         | Planned |
| S3-M1-005 | M1 / Abarado | Sales                                                                          | Implement checkout and sale transaction foundation            | Feature / Integration | P0       | POS flow and sales contract    | Planned |
| S3-M1-006 | M1 / Abarado | Sales                                                                          | Connect Sales page to sale transaction data                   | Integration           | P0       | S3-M1-005, M2 reports contract | Planned |
| S3-M1-007 | M1 / Abarado | Cross-module                                                                   | Integration QA for M2 and M3 branches                         | QA                    | P0       | M2 and M3 feature branches     | Planned |
| S3-M1-008 | M1 / Abarado | Cross-module                                                                   | Resolve merge conflicts and ensure final Sprint 3 integration | Integration / QA      | P0       | S3-M1-007                      | Planned |

## M2 - SARIMA, Forecasting, and Reports

| ID        | Owner      | Module              | Task                                                           | Type             | Priority | Dependencies                                           | Status  |
| --------- | ---------- | ------------------- | -------------------------------------------------------------- | ---------------- | -------- | ------------------------------------------------------ | ------- |
| S3-M2-001 | M2 / Ramos | Forecasting service | Design SARIMA service structure                                | Architecture     | P0       | M3 clean sales/product data contract                   | Planned |
| S3-M2-002 | M2 / Ramos | Forecasting service | Define historical sales input format for SARIMA                | Data contract    | P0       | M1 sales transaction shape, M3 product inventory shape | Planned |
| S3-M2-003 | M2 / Ramos | Forecasting service | Implement forecasting service foundation                       | Feature          | P0       | S3-M2-001, S3-M2-002                                   | Planned |
| S3-M2-004 | M2 / Ramos | Forecast API        | Add forecast API and data contract                             | Integration      | P0       | S3-M2-003                                              | Planned |
| S3-M2-005 | M2 / Ramos | Forecast output     | Add sample forecast output for supported products              | Feature / QA     | P1       | Forecast data contract                                 | Planned |
| S3-M2-006 | M2 / Ramos | Forecast page       | Prepare Forecast page to display forecast results              | UI / Integration | P1       | S3-M2-004, S3-M2-005                                   | Planned |
| S3-M2-007 | M2 / Ramos | Reports page        | Prepare Reports page for sales and forecast summaries          | UI / Integration | P1       | Sales data, forecast contract                          | Planned |
| S3-M2-008 | M2 / Ramos | Documentation       | Document SARIMA parameters, preprocessing, and evaluation plan | Documentation    | P1       | S3-M2-001, S3-M2-002                                   | Planned |

## M3 - Products, Inventory, and Data Quality

| ID        | Owner     | Module                  | Task                                                   | Type         | Priority | Dependencies                      | Status  |
| --------- | --------- | ----------------------- | ------------------------------------------------------ | ------------ | -------- | --------------------------------- | ------- |
| S3-M3-001 | M3 / Vito | Product API             | Implement product data model and API foundation        | Data / API   | P0       | Existing Prisma/backend structure | Planned |
| S3-M3-002 | M3 / Vito | Products                | Implement product CRUD foundation                      | Feature      | P0       | S3-M3-001                         | Planned |
| S3-M3-003 | M3 / Vito | Inventory API           | Implement inventory data model and API foundation      | Data / API   | P0       | Existing Prisma/backend structure | Planned |
| S3-M3-004 | M3 / Vito | Inventory               | Implement stock movement records                       | Feature      | P0       | S3-M3-003                         | Planned |
| S3-M3-005 | M3 / Vito | Seed data               | Add sample products and inventory data                 | Data / QA    | P0       | S3-M3-001, S3-M3-003              | Planned |
| S3-M3-006 | M3 / Vito | POS support             | Support POS stock lookup and stock deduction           | Integration  | P0       | S3-M3-002, S3-M3-004              | Planned |
| S3-M3-007 | M3 / Vito | Forecast support        | Provide clean product and inventory data for M2 SARIMA | Data support | P0       | S3-M3-005                         | Planned |
| S3-M3-008 | M3 / Vito | Cross-team coordination | Coordinate with M2 on sales aggregation requirements   | Coordination | P1       | M2 input format work              | Planned |

## Sprint Integration Dependencies

| Shared Dependency         | Owner      | Why It Matters                                              | Status  |
| ------------------------- | ---------- | ----------------------------------------------------------- | ------- |
| Product master data shape | M3         | POS, sales, and forecasting all need stable product records | Planned |
| Inventory movement model  | M3         | Stock deduction and forecasting both depend on it           | Planned |
| Sale transaction shape    | M1 with M2 | Sales data must be aggregatable for reports and SARIMA      | Planned |
| Forecast output contract  | M2         | Reports and dashboard usage depend on it                    | Planned |
| Merge/conflict review     | M1         | Keeps all branches mergeable and avoids integration drift   | Planned |

## Sprint Activity Log

| Date       | Member     | Work Item                                                                                                        | Status  | Evidence                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | ---------- | ---------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-08 | M1 Abarado | Sprint 3 planning docs created from current repository state                                                     | Planned | `docs/sprints/sprint-3/**`                                                                                                                                                                                                                                                                                                                                    |
| 2026-07-09 | M1 Abarado | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed  | `scripts/sprint-update.mjs`<br>`scripts/sprint-check.mjs`                                                                                                                                                                                                                                                                                                     |
| 2026-07-09 | M1 Abarado | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior.                    | Passed  | `docs/sprints/sprint-3/DEFINITION-OF-DONE.md`                                                                                                                                                                                                                                                                                                                 |
| 2026-07-10 | M1 Abarado | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior.                    | Passed  | `docs/sprints/sprint-3/DEFINITION-OF-DONE.md`                                                                                                                                                                                                                                                                                                                 |
| 2026-07-10 | M1 Abarado | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed  | backend/package.json<br>backend/README.md<br>backend/src/controllers/inventoryController.ts<br>backend/src/controllers/productController.ts<br>backend/src/controllers/productImportController.ts<br>backend/src/middleware/errorHandler.ts<br>backend/src/middleware/roleMiddleware.ts<br>backend/src/middleware/uploadMiddleware.ts                         |
| 2026-07-10 | M3 Vito    | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed  | backend/package.json<br>backend/README.md<br>backend/src/controllers/inventoryController.ts<br>backend/src/controllers/productController.ts<br>backend/src/controllers/productImportController.ts<br>backend/src/middleware/errorHandler.ts<br>backend/src/middleware/roleMiddleware.ts<br>backend/src/middleware/uploadMiddleware.ts                         |
| 2026-07-11 | M1 Abarado | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior.                    | Passed  | backend/src/services/catalogSerializers.ts<br>backend/src/services/inventoryService.ts                                                                                                                                                                                                                                                                        |
| 2026-07-11 | M1 Abarado | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed  | backend/src/controllers/productController.ts<br>backend/src/services/productService.ts<br>backend/src/validators/product.validators.ts<br>backend/test/data-flow.test.ts<br>database/seed/development.mjs                                                                                                                                                     |
| 2026-07-12 | M1 Abarado | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior.                    | Passed  | backend/src/controllers/inventoryImportController.ts<br>backend/src/routes/index.ts<br>backend/src/routes/inventory.routes.ts<br>backend/src/services/inventoryImportService.ts<br>backend/src/services/inventoryService.ts<br>backend/src/services/stockDomainService.ts<br>backend/src/validators/inventory.validators.ts<br>backend/test/data-flow.test.ts |
| 2026-07-12 | M1 Abarado | Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections. | Passed  | .gitignore<br>backend/package.json<br>backend/src/config/env.ts<br>backend/src/modules/forecasting/forecast-window.ts<br>backend/src/modules/forecasting/forecast.auth.ts<br>backend/src/modules/forecasting/forecast.controller.ts<br>backend/src/modules/forecasting/forecast.routes.ts<br>backend/src/modules/forecasting/forecast.schemas.ts              |
