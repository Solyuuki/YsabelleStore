# m3 Sprint Planning

## Sprint Scope

| Sprint   | Version | Goal                                 | Status  |
| -------- | ------- | ------------------------------------ | ------- |
| Sprint 1 | v0.1    | Implement database foundation        | Done    |
| Future   | Later   | Implement SARIMA and recommendations | Planned |

## Sprint 1 Tasks

| Task ID    | Description                                      | Status |
| ---------- | ------------------------------------------------ | ------ |
| YSB-S1-009 | Draft and implement initial Prisma schema models | Done   |
| YSB-S1-010 | Define relationships, constraints, and indexes   | Done   |
| YSB-S1-011 | Create migration readiness and seed strategy     | Done   |
| YSB-S1-012 | Align database documentation with schema work    | Done   |

## Acceptance Criteria

| Criterion                         | Evidence                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Core entities are modeled         | User, category, product, batch, movement, sales, forecast, and recommendation models |
| Relationships are explicit        | Prisma relations use restrict, cascade, or set-null behavior                         |
| Query-readiness is represented    | Barcode, product, inventory, sales, forecast, and recommendation indexes             |
| Migration path is reviewable      | Initial SQL artifact in `database/migrations/`                                       |
| Seed strategy is controlled       | Strategy documented without executable fake data                                     |
| SARIMA remains later-sprint scope | Forecast table stores outputs only; no model execution                               |
