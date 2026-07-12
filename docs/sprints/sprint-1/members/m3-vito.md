# m3 - Vito

## Role

Backend Developer, Database Developer.

## Sprint Focus

Prisma schema, relationships, migrations, seed strategy, constraints, indexes, database validation, and database documentation.

## Assigned Scope

| Responsibility         | Output                                                   |
| ---------------------- | -------------------------------------------------------- |
| Prisma schema          | Initial approved domain models                           |
| Relationships          | Safe model associations                                  |
| Migrations             | First migration workflow and validation path             |
| Seed strategy          | Controlled development data plan                         |
| Constraints            | Data integrity rules                                     |
| Indexes                | Query-readiness for inventory, sales, and forecast flows |
| Database validation    | Prisma validation and schema review evidence             |
| Database documentation | Docs aligned with implemented schema decisions           |

## Assigned Tasks

| Task Area     | Task                                                                    |
| ------------- | ----------------------------------------------------------------------- |
| Prisma schema | Model users, products, inventory, sales, forecasts, and recommendations |
| Relations     | Define safe relationships, constraints, and indexes                     |
| Migration     | Create reviewable migration strategy and initial SQL artifact           |
| Seed strategy | Document deterministic development seed rules                           |
| Docs          | Align database documentation with implemented schema decisions          |

## Expected Output

| Output                   | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| Prisma schema foundation | Core models, enums, relations, constraints, and indexes     |
| Migration artifact       | Reviewable SQL foundation migration                         |
| Seed strategy            | Development-only seed policy and future seed entry criteria |
| Database docs            | Naming, migration, ERD, and foundation documentation        |

## Dependencies

| Dependency          | Reason                                                           |
| ------------------- | ---------------------------------------------------------------- |
| Architecture docs   | Database models depend on approved system architecture           |
| Backend integration | Prisma boundary depends on backend service expectations          |
| Migration review    | Future schema changes depend on stable migration naming strategy |

## Validation Responsibility

| Validation Area | Responsibility                                      |
| --------------- | --------------------------------------------------- |
| Prisma          | Prisma validation and schema review                 |
| Migration       | Migration artifact review and naming standard check |
| Documentation   | Database docs aligned with schema decisions         |

## Risks / Notes

| Risk or Note                         | Mitigation                                           |
| ------------------------------------ | ---------------------------------------------------- |
| Migration changes conflict           | Coordinate with m2 before changing Prisma migrations |
| Schema overclaims business workflows | Keep Sprint 1 database work persistence-only         |
| Seed data treated as production data | Keep seed strategy development-only                  |

## Status

| Item          | Status                                              |
| ------------- | --------------------------------------------------- |
| Sprint 1 role | Complete for database foundation                    |
| Carry-over    | Runtime migration evidence and executable seed work |
