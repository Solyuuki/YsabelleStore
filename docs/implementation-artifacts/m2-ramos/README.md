# m2 - Ramos Implementation Artifacts

Primary ownership: Express.js backend, Prisma schema, MySQL migrations, import APIs, and database-backed inventory rules.

## Ownership Summary

| Area            | Responsibility                                             |
| --------------- | ---------------------------------------------------------- |
| Backend API     | Routes, controllers, services, validators, and API tests   |
| Database        | Prisma models, migrations, relations, and constraints      |
| Imports         | CSV and Excel import validation and persistence            |
| Inventory Rules | Stock updates, batch integrity, and API response contracts |

## Artifact Index

| File                  | Purpose                                     |
| --------------------- | ------------------------------------------- |
| `SPRINT-PLANNING.md`  | Backend and database sprint goals           |
| `SPRINT-PROGRESS.md`  | API and Prisma progress tracking            |
| `TASKS.md`            | Detailed backend task register              |
| `BLOCKERS.md`         | Backend/database blocker log                |
| `DAILY-NOTES.md`      | Daily implementation notes                  |
| `TESTING-REPORTS.md`  | API, Prisma, and import validation evidence |
| `DEPLOYMENT-NOTES.md` | Database setup and backend release notes    |

## Member Checklist

- [ ] Use valid branch names beginning with `m2/`
- [ ] Validate all API inputs before service execution
- [ ] Coordinate schema changes before PR merge
- [ ] Record migration and seed behavior clearly
- [ ] Provide API test or validation evidence
