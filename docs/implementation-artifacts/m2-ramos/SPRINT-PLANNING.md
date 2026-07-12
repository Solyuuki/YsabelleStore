# m2 Sprint Planning

## Sprint Scope

| Sprint   | Version | Goal                                                              | Status  |
| -------- | ------- | ----------------------------------------------------------------- | ------- |
| Sprint 0 | v0.1    | Review repository standards for backend and database ownership    | Done    |
| Sprint 1 | v0.2    | Scaffold Express backend and Prisma configuration                 | Done    |
| Sprint 2 | v0.3    | Implement product, inventory, batch, and import API foundations   | Planned |
| Sprint 3 | v0.3    | Build SARIMA forecasting foundation and reports consumption paths | Planned |

## Planned Tasks

| Task ID        | Sprint   | Description                                            | Status  |
| -------------- | -------- | ------------------------------------------------------ | ------- |
| YSB-M2-API-001 | Sprint 1 | Scaffold Express TypeScript backend                    | Done    |
| YSB-M2-DB-001  | Sprint 1 | Configure Prisma and MySQL connection                  | Done    |
| YSB-M2-INV-001 | Sprint 2 | Implement inventory and batch API services             | Planned |
| YSB-M2-IMP-001 | Sprint 2 | Implement CSV and Excel import validation flow         | Planned |
| YSB-M2-FOR-001 | Sprint 3 | Design SARIMA service structure and forecast contracts | Planned |
| YSB-M2-FOR-002 | Sprint 3 | Prepare forecast and reports data consumption paths    | Planned |

## Acceptance Criteria

| Criterion                           | Evidence                                                  |
| ----------------------------------- | --------------------------------------------------------- |
| Backend starts locally              | Startup command and result recorded                       |
| Prisma validates schema             | Prisma validation command passes                          |
| Forecasting has a clear foundation  | SARIMA service structure and data contract are documented |
| Reports can consume structured data | Forecast and sales summary shape is documented            |
