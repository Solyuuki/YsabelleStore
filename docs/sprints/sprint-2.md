# Sprint 2 Task Update - M1 Local MySQL Development Setup

## Task Assignment

| Field        | Details                                                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task Owner   | M1 / Abarado                                                                                                                                          |
| Task Title   | Implement Local MySQL Development Setup for Team Environment Consistency                                                                              |
| Task Type    | DevOps / Environment Setup                                                                                                                            |
| Priority     | High                                                                                                                                                  |
| Branch       | `m1/v0.2/feat/local-mysql-development-setup`                                                                                                          |
| Scope        | Local MySQL Community Server, `.env.example`, setup docs                                                                                              |
| Goal         | Ensure consistent local database setup for all members after pulling the repo                                                                         |
| Validation   | `npm run prisma:generate`, `npm run prisma:validate`, `npx prisma db push --schema database/prisma/schema.prisma`, `npm run db:seed`, `npm run build` |
| Restrictions | Do not modify frontend UI, backend logic, Electron runtime, Prisma schema, migrations, Husky, or GitHub Actions                                       |

## Local MySQL Scope

M1 owns the Sprint 2 local MySQL development setup. This work provides a repeatable local MySQL Community Server environment for team members and keeps the existing npm development workflow for the backend, frontend, and Electron app.

## Team Pull Workflow

```bash
git pull
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:validate
npx prisma db push --schema database/prisma/schema.prisma
npm run db:seed
npm run dev --workspace backend
npm run dev --workspace frontend
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

## Blockers Addressed

| Blocker                                         | Impact                                                 | Resolution                                  |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------- |
| No local MySQL setup exists yet                 | Members may have inconsistent local MySQL environments | Document MySQL Community Server setup       |
| Environment file documentation may be confusing | Members may create `.env` in the wrong location        | Align documentation and root `.env.example` |
| Local MySQL does not replace npm workflow yet   | Members still need npm commands for app runtime        | Document local MySQL as database-only setup |

## Completion Notes

The local MySQL setup is limited to development database consistency. It must not change frontend UI, backend runtime logic, Electron runtime behavior, Prisma schema, migrations, Husky hooks, or GitHub Actions.
