# m2 Task Register

| Task ID | Sprint | Assigned Member | Scope | Affected Files | Status | Test Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| YSB-M2-API-001 | Sprint 1 | m2 - Ramos | Express backend scaffold | `app/backend/` | Planned | Not run until scaffold exists | Must use TypeScript |
| YSB-M2-DB-001 | Sprint 1 | m2 - Ramos | Prisma and MySQL setup | `prisma/`, `.env.example` | Planned | Not run until schema exists | Requires `DATABASE_URL` documentation |
| YSB-M2-INV-001 | Sprint 2 | m2 - Ramos | Inventory and batch service | `app/backend/`, `prisma/` | Planned | Pending service tests | Coordinate response contract with m1 |
| YSB-M2-IMP-001 | Sprint 2 | m2 - Ramos | CSV and Excel import API | `app/backend/` | Planned | Pending import validation tests | Must report invalid rows |

## Task Quality Checklist

- [ ] Branch name starts with `m2/`
- [ ] Prisma schema changes are reviewed
- [ ] API inputs are validated
- [ ] Database writes preserve inventory integrity
- [ ] Tests or manual API validation are recorded

