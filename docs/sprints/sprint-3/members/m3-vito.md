# M3 - Vito

## Role

Products / Inventory Lead

## Sprint 3 Focus

Build the product data foundation, inventory data foundation, stock movement logic, and clean data support needed by
POS, Sales, and SARIMA forecasting.

## Assigned Modules

| Module        | Responsibility                                         |
| ------------- | ------------------------------------------------------ |
| Products      | Product data model and CRUD foundation                 |
| Inventory     | Stock tracking and stock movement records              |
| Product API   | Product read/write foundation for downstream modules   |
| Inventory API | Inventory read/write foundation for downstream modules |
| Seed data     | Sample product and inventory data for validation       |

## Task Table

| Task ID   | Task                                                   | Type         | Priority | Dependencies                      | Status         |
| --------- | ------------------------------------------------------ | ------------ | -------- | --------------------------------- | -------------- |
| S3-M3-001 | Implement product data model and API foundation        | Data / API   | P0       | Existing Prisma/backend structure | Implemented    |
| S3-M3-002 | Implement product CRUD foundation                      | Feature      | P0       | S3-M3-001                         | Implemented    |
| S3-M3-003 | Implement inventory data model and API foundation      | Data / API   | P0       | Existing Prisma/backend structure | Implemented    |
| S3-M3-004 | Implement stock movement records                       | Feature      | P0       | S3-M3-003                         | Implemented    |
| S3-M3-005 | Add sample products and inventory data                 | Data / QA    | P0       | S3-M3-001, S3-M3-003              | Implemented    |
| S3-M3-006 | Support POS stock lookup and stock deduction           | Integration  | P0       | S3-M3-002, S3-M3-004              | Implemented    |
| S3-M3-007 | Provide clean product and inventory data for M2 SARIMA | Data support | P0       | S3-M3-005                         | Implemented    |
| S3-M3-008 | Coordinate with M2 on sales aggregation requirements   | Coordination | P1       | M2 input format work              | Contract ready |

## Dependencies

| Dependency                          | Why It Matters                                                          |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Existing Prisma/backend structure   | Product and inventory work should fit the current repository foundation |
| POS contract from M1                | Stock lookup and deduction must match how POS selects items             |
| Forecast input requirements from M2 | Sales and product data should be shaped for SARIMA use                  |

## Deliverables

| Deliverable          | Expected Shape                                                       |
| -------------------- | -------------------------------------------------------------------- |
| Product foundation   | Product records can be created, read, and maintained                 |
| Inventory foundation | Stock and movement data are tracked in a usable structure            |
| Seed/sample data     | Clean data exists for testing and integration                        |
| POS support          | Inventory data can support stock lookup and deduction                |
| SARIMA support       | Product and inventory data are clean enough to feed forecasting work |

## Validation Checklist

| Check                  | Expected Result                                                                                                                                                                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product model review   | Product data shape is usable by M1 and M2                                                                                                                                                                                                                      |
| Inventory model review | Stock movement and stock level data are clearly represented                                                                                                                                                                                                    |
| Seed review            | Sample data is consistent and not fake completion noise                                                                                                                                                                                                        |
| Integration review     | POS and forecasting consumers can use the data foundation                                                                                                                                                                                                      |
| Repo validation        | `npm run lint`, `npm run build`, `npm run prisma:validate`, `npm run prisma:generate`, `npx prisma migrate reset --force --schema database/prisma/schema.prisma`, and `npx prisma migrate dev --schema database/prisma/schema.prisma` pass on a fresh database |

## Risks / Blockers

| Risk                                     | Impact                                    | Mitigation                                                  |
| ---------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Product and inventory shape changes late | POS and SARIMA may need rework            | Define the data model early and communicate it to M1 and M2 |
| Stock deduction logic is incomplete      | POS checkout may not be reliable          | Keep stock movement logic explicit and testable             |
| Seed data is inconsistent                | Validation becomes noisy                  | Use a clean, deterministic sample data set                  |
| Cross-team contract drift                | Integration may break                     | Document product/inventory changes immediately              |
| Local MySQL database is unavailable      | Seed and manual API validation cannot run | Report the exact blocker and keep code validation green     |
| Import contract drifts from samples      | Preview/import QA becomes noisy           | Keep the template, examples, and docs in sync               |

## Notes for PR

| Note               | Guidance                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| Scope honesty      | Label the work as foundation if the module is not yet fully CRUD-complete |
| Data reliability   | Explain how the data shape supports POS and SARIMA                        |
| Integration points | Mention any API or model changes M1 and M2 need to know about             |
| Validation         | Include sample data and stock movement notes in review evidence           |

## Review Evidence

- Product import sample files are checked into `docs/samples/product-import/`
- Seed data includes deterministic product, inventory, and movement fixtures
- Migration history is replayable from an empty MySQL database
