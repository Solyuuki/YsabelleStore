# m3 Sprint Planning

## Sprint Scope

| Sprint   | Version | Goal                                                                | Status  |
| -------- | ------- | ------------------------------------------------------------------- | ------- |
| Sprint 1 | v0.1    | Implement database foundation                                       | Done    |
| Sprint 2 | v0.2    | Keep backend Prisma and health checks stable                        | Done    |
| Sprint 3 | v0.3    | Build product and inventory foundations that support POS and SARIMA | Planned |
| Future   | Later   | Implement SARIMA and recommendations                                | Planned |

## Sprint 1 Tasks

| Task ID    | Description                                      | Status |
| ---------- | ------------------------------------------------ | ------ |
| YSB-S1-009 | Draft and implement initial Prisma schema models | Done   |
| YSB-S1-010 | Define relationships, constraints, and indexes   | Done   |
| YSB-S1-011 | Create migration readiness and seed strategy     | Done   |
| YSB-S1-012 | Align database documentation with schema work    | Done   |

## Sprint 3 Tasks

| Task ID        | Description                                     | Status  |
| -------------- | ----------------------------------------------- | ------- |
| YSB-M3-BIZ-001 | Implement product data foundation               | Planned |
| YSB-M3-BIZ-002 | Implement inventory data foundation             | Planned |
| YSB-M3-BIZ-003 | Add stock movement support                      | Planned |
| YSB-M3-BIZ-004 | Provide clean sample product and inventory data | Planned |

## Acceptance Criteria

| Criterion                         | Evidence                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| Core entities are modeled         | Product, inventory, movement, sales, forecast, and recommendation data remain query-ready |
| Relationships are explicit        | Prisma relations remain clear and stable                                                  |
| Query-readiness is represented    | Product, inventory, sales, and forecast access patterns are usable by downstream modules  |
| Seed strategy is controlled       | Sample product and inventory data remains deterministic                                   |
| SARIMA remains later-sprint scope | Forecasting execution remains foundation-only until explicitly implemented                |
