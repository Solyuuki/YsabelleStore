# m2 Sprint Planning

## Sprint Scope

| Sprint   | Version | Goal                                                            | Status  |
| -------- | ------- | --------------------------------------------------------------- | ------- |
| Sprint 0 | v0.1    | Review repository standards for backend and database ownership  | Done    |
| Sprint 1 | v0.2    | Scaffold Express backend and Prisma configuration               | Planned |
| Sprint 2 | v0.3    | Implement product, inventory, batch, and import API foundations | Planned |

## Planned Tasks

| Task ID        | Sprint   | Description                                    | Status  |
| -------------- | -------- | ---------------------------------------------- | ------- |
| YSB-M2-API-001 | Sprint 1 | Scaffold Express TypeScript backend            | Planned |
| YSB-M2-DB-001  | Sprint 1 | Configure Prisma and MySQL connection          | Planned |
| YSB-M2-INV-001 | Sprint 2 | Implement inventory and batch API services     | Planned |
| YSB-M2-IMP-001 | Sprint 2 | Implement CSV and Excel import validation flow | Planned |

## Acceptance Criteria

| Criterion                      | Evidence                                           |
| ------------------------------ | -------------------------------------------------- |
| Backend starts locally         | Startup command and result recorded                |
| Prisma validates schema        | Prisma validation command passes                   |
| API rejects invalid input      | Validator tests or manual request evidence         |
| Imports protect data integrity | Invalid rows are reported without corrupting stock |
