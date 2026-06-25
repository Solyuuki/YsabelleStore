# Member Assignments

Sprint 1 assigns infrastructure ownership by layer. Cross-layer edits require coordination with the owning member before pull request approval.

## Team Roles

| Member       | Role                                                    | Sprint Responsibility                                                                                                      |
| ------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| m1 - Abarado | Fullstack, Sprint Lead, Frontend Lead, Integration Lead | Frontend shell, Electron readiness, API client, integration support, sprint supervision                                    |
| m2 - Ramos   | Backend Developer                                       | Express backend core, controllers, services, route registry, validation, error handling, Prisma integration boundary       |
| m3 - Vito    | Backend Developer, Database Developer                   | Prisma schema, relationships, migrations, seed strategy, constraints, indexes, database validation, database documentation |

## m1 - Abarado

| Responsibility        | Output                                                        |
| --------------------- | ------------------------------------------------------------- |
| React Router          | Route shell prepared for future pages                         |
| App Shell             | Stable top-level renderer structure                           |
| Sidebar               | Navigation pattern ready for module links                     |
| Header                | Shared application header pattern                             |
| Layout                | Reusable authenticated layout foundation                      |
| Shared UI Components  | Common UI primitives for later screens                        |
| Dashboard placeholder | Non-business placeholder landing surface                      |
| API client            | Frontend request boundary ready for services                  |
| Backend integration   | Coordinate frontend/backend contract assumptions              |
| Integration support   | Resolve sprint branch conflicts and review integration issues |
| Sprint supervision    | Maintain sprint progress and review readiness                 |

## m2 - Ramos

| Responsibility       | Output                                      |
| -------------------- | ------------------------------------------- |
| Express structure    | Modular backend folders and imports         |
| Controllers          | Controller boundary pattern                 |
| Services             | Service boundary pattern                    |
| Route registry       | Discoverable route registration pattern     |
| Validation           | Request validation approach                 |
| Error handling       | Consistent API error responses              |
| Prisma integration   | Backend access boundary for database client |
| Backend architecture | Documented structure for future APIs        |

## m3 - Vito

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

## Ownership Rule

Each member owns their assigned branch and task scope. Shared files such as root scripts, CI workflows, route contracts, Prisma schema, and application shell files require explicit review from affected owners before merge.
