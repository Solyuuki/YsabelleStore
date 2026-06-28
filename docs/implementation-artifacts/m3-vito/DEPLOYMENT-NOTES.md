# m3 Deployment Notes

## Database Runtime Readiness

| Area                | Owner | Standard                                                   |
| ------------------- | ----- | ---------------------------------------------------------- |
| MySQL runtime       | m3    | Use MySQL Community Server with environment-driven URL     |
| Prisma Client       | m3    | Generate from `database/prisma/schema.prisma` before build |
| Migration artifact  | m3    | Review SQL before applying to a local database             |
| Seed data           | m3    | Add deterministic development-only seed data later         |
| Forecasting runtime | m3    | Later-sprint scope; not part of Sprint 1 deployment        |

## Deployment Log

| Version | Date       | Database Target            | Status    | Notes                                                     |
| ------- | ---------- | -------------------------- | --------- | --------------------------------------------------------- |
| v0.1    | 2026-06-28 | Sprint 1 Prisma foundation | Completed | Schema, migration artifact, and backend boundary prepared |

## Release Checklist

- [x] `DATABASE_URL` remains environment-driven
- [x] Prisma schema validates with a safe local validation URL
- [x] Prisma Client generation is part of the root build script
- [x] Initial SQL migration artifact is reviewable
- [x] No real credentials or production data are committed
- [ ] Apply migration to a local MySQL database after PR review
