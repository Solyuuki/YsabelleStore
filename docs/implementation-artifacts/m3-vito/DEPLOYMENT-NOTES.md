# m3 Deployment Notes

## Database Runtime Readiness

| Area                             | Status               | Evidence                                                                 |
| -------------------------------- | -------------------- | ------------------------------------------------------------------------ |
| Prisma schema                    | Ready for foundation | `database/prisma/schema.prisma` validates                                |
| Prisma Client generation         | Historically passed  | Existing M3 report records `npm.cmd run prisma:generate` passed          |
| Migration SQL artifact           | Ready for review     | `database/migrations/0001_sprint_1_database_foundation/migration.sql`    |
| Migration application            | Not verified         | No local MySQL application/status output exists                          |
| Seed data                        | Strategy only        | `database/seed/README.md`; no executable seed script                     |
| Backend database health boundary | Ready for foundation | `backend/src/database/prismaClient.ts`, health controller database check |

## Deployment Log

| Version / Branch             | Date       | Database Target                    | Status                           | Notes                                                                 |
| ---------------------------- | ---------- | ---------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| Foundation history           | 2026-06-25 | Database folder and docs           | Completed                        | Initial database foundation structure created.                        |
| M3 branch                    | 2026-06-28 | Sprint 1 Prisma foundation         | Completed                        | Schema, migration artifact, seed strategy, and database docs aligned. |
| Sprint branch                | 2026-06-29 | Database integration into Sprint 1 | Completed for source integration | Current branch includes M3 database/backend database-boundary work.   |
| Documentation reconstruction | 2026-06-29 | Migration naming and artifacts     | In review                        | Numbered migration rule documented and Sprint 1 folder renamed.       |

## Release Checklist

| Check                                     | Status                   | Evidence / Required Action                                                        |
| ----------------------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `DATABASE_URL` remains environment-driven | Passed                   | `database/prisma/schema.prisma` and backend env config use environment variables. |
| Prisma schema validates                   | Passed                   | Verified 2026-06-29.                                                              |
| Backend build compiles Prisma boundary    | Passed                   | Verified 2026-06-29.                                                              |
| Migration SQL is reviewable               | Passed                   | SQL artifact exists.                                                              |
| No committed production data              | Passed                   | Seed strategy only; no executable data seed committed.                            |
| Migration applied to local MySQL          | Not verified             | Required before claiming runtime database deployment readiness.                   |
| Sequential migration standard documented  | Passed after this update | Migration guide and standards updated.                                            |

## Known Deployment Limits

| Limit                        | Impact                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Migration folder naming      | Sprint 1 migration now uses `0001_sprint_1_database_foundation`; future migrations must increment by one and never use timestamps. |
| Migration not proven applied | Database runtime deployment remains pending.                                                                                       |
| No seed script               | Development demo data cannot be generated yet.                                                                                     |
| No forecasting execution     | Database stores future outputs only.                                                                                               |
