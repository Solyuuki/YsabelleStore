# m1 Testing Reports

## Validation Log

| Test ID    | Date       | Area                              | Command or Method                                      | Result           | Evidence / Notes                                                                              |
| ---------- | ---------- | --------------------------------- | ------------------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------------- |
| TST-M1-001 | 2026-06-24 | Repository structure              | Required file and standards review                     | Passed           | Repository foundation files were created and are present in history.                          |
| TST-M1-002 | 2026-06-24 | Documentation quality             | Search for unfinished markers                          | Passed           | Existing historical report states no unfinished markers were found.                           |
| TST-M1-003 | 2026-06-27 | Frontend shell                    | `npm run build --workspace frontend`                   | Passed           | Existing historical report records TypeScript and Vite production build success.              |
| TST-M1-004 | 2026-06-27 | Root validation                   | Required validation sequence with temporary Prisma URL | Passed           | Existing historical report records full validation passed after `DATABASE_URL` was supplied.  |
| TST-M1-005 | 2026-06-27 | Welcome screen polish             | `npm run build --workspace frontend`                   | Passed           | Existing historical report records focused frontend build success.                            |
| TST-M1-006 | 2026-06-27 | Welcome screen polish             | Format, lint, build, audit                             | Passed           | Existing historical report records all checks passed.                                         |
| TST-M1-007 | 2026-06-27 | Welcome footer                    | `npm run build --workspace frontend`                   | Passed           | Existing historical report records focused frontend build success.                            |
| TST-M1-008 | 2026-06-27 | Welcome footer                    | Format, lint, build, audit                             | Passed           | Existing historical report records all checks passed.                                         |
| TST-M1-009 | 2026-06-27 | App shell cohesion                | Format, lint, frontend typecheck, root build, audit    | Passed           | Existing historical report records all checks passed with temporary Prisma URL.               |
| TST-M1-010 | 2026-06-27 | Theme polish                      | Format, lint, frontend typecheck, root build, audit    | Passed           | Existing historical report records all checks passed with temporary Prisma URL.               |
| TST-M1-011 | 2026-06-27 | Final shell polish                | Format, lint, frontend typecheck, root build, audit    | Passed           | Existing historical report records all checks passed with temporary Prisma URL.               |
| TST-M1-012 | 2026-06-29 | Current frontend source           | `npm run build --workspace frontend`                   | Passed           | Verified during artifact reconstruction before file edits.                                    |
| TST-M1-013 | 2026-06-29 | Current backend source            | `npm run build --workspace backend`                    | Passed           | Verified during artifact reconstruction before file edits.                                    |
| TST-M1-014 | 2026-06-29 | Prisma schema                     | `npm run prisma:validate`                              | Passed           | Verified during artifact reconstruction before file edits.                                    |
| TST-M1-015 | 2026-06-29 | Documentation-only reconstruction | Final validation command set                           | Passed           | `format:check`, lint, workspace typecheck, build, Prisma validation, and audit passed.        |
| TST-M1-016 | 2026-07-05 | Auth Fullstack Flow Foundation    | Source review                                          | Verified         | Frontend auth context/API client and backend auth routes/controller/service/middleware exist. |
| TST-M1-017 | 2026-07-05 | Login Page Flow Update            | Source review                                          | Verified         | Login form, remembered-account flow, password visibility, and loading states exist.           |
| TST-M1-018 | 2026-07-05 | Protected Access / Access Denied  | Source review                                          | Verified         | Route role metadata, sidebar filtering, and access denied page/toast exist.                   |
| TST-M1-019 | 2026-07-05 | User Management Direction/Page    | Source review                                          | Verified         | OWNER-only `/users` route and owner-side account creation page exist.                         |
| TST-M1-020 | 2026-07-05 | Docker Development Setup          | Docker CLI, Compose, config, startup, and PS checks    | Passed           | Docker MySQL service `ysabelle-mysql` was running and healthy on port `3306`.                 |
| TST-M1-021 | 2026-07-05 | Project Healthcheck Script        | `npm run healthcheck`                                  | Partial / Exit 1 | Sequence and report worked; build failed due to Prisma EPERM lock.                            |
| TST-M1-022 | 2026-07-05 | Future Artifact Automation        | `npm run artifacts:check`                              | Passed           | Artifact check runs and accepts this change set because M1 artifact updates are present.      |

## Sprint 2 Setup Validation Summary

| Command                  |           Result | Notes                                                             |
| ------------------------ | ---------------: | ----------------------------------------------------------------- |
| `docker --version`       |           Passed | Docker CLI available                                              |
| `docker compose version` |           Passed | Compose available                                                 |
| `docker compose config`  |           Passed | Config valid                                                      |
| `docker compose up -d`   |           Passed | MySQL container started                                           |
| `docker compose ps`      |           Passed | MySQL container healthy                                           |
| `npm run healthcheck`    | Partial / Exit 1 | Sequence and report worked; build failed due to Prisma EPERM lock |

## Historical Validation Detail

| Date       | Command                                  | Result | Notes                                                                                     |
| ---------- | ---------------------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| 2026-06-27 | `npm run build --workspace frontend`     | Passed | Used repeatedly for frontend shell and welcome-screen changes.                            |
| 2026-06-27 | `npm run format`                         | Passed | Historical report says changed frontend and M1 artifact files were formatted.             |
| 2026-06-27 | `npm run format:check`                   | Passed | Historical report says matched files used Prettier style.                                 |
| 2026-06-27 | `npm run lint`                           | Passed | Historical report notes an existing root ESLint module-type warning, with no lint errors. |
| 2026-06-27 | `npm run build` without `DATABASE_URL`   | Failed | Failure was limited to missing Prisma validation environment variable.                    |
| 2026-06-27 | Root build with temporary `DATABASE_URL` | Passed | Historical report records frontend, backend, Electron, and Prisma validation passed.      |
| 2026-06-27 | `npm audit --audit-level=high`           | Passed | Historical report records 0 vulnerabilities.                                              |

## Manual Review Evidence

| Date       | Area                                          | Result                                                    | Notes                                                                                                                       |
| ---------- | --------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-27 | Welcome screen and footer                     | Passed by visual review evidence in committed screenshots | Screenshot artifacts were restored from Git history during 2026-06-29 reconstruction.                                       |
| 2026-06-27 | Dashboard shell collapsed and expanded states | Passed by visual review evidence in committed screenshots | Screenshot artifacts are historical review aids, not runtime dependencies.                                                  |
| 2026-06-29 | Sidebar route comparison                      | Passed analysis                                           | M1 route/page files are present in current `frontend/src/**`; M3 branch frontend replacement is documented as a merge risk. |

## Validation Limits

| Area                          | Status                                     | Reason                                                                             |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Electron packaged installer   | Not run historically in available evidence | Electron foundation exists, but no packaged `.exe` validation artifact is present. |
| Browser/Electron console logs | Not available in repository                | No saved console transcript was found.                                             |
| Automated UI tests            | Not present                                | No Playwright/Cypress test suite exists in repository dependencies.                |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script -->

## Validation Entry — 2026-07-05 20:42:36 Asia/Manila

| Check             |  Result | Notes                                                                               |
| ----------------- | ------: | ----------------------------------------------------------------------------------- |
| Validation status | Pending | Run `npm run healthcheck` and attach command output before marking checks as passed |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json|AGENTS.md|scripts/:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script|Unclassified Repository Update|Unclassified Repository Update -->

## Validation Entry — 2026-07-05 20:43:15 Asia/Manila

| Check             |  Result | Notes                                                                               |
| ----------------- | ------: | ----------------------------------------------------------------------------------- |
| Validation status | Pending | Run `npm run healthcheck` and attach command output before marking checks as passed |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json|AGENTS.md|scripts/check-artifacts.mjs|scripts/healthcheck.mjs|scripts/sprint-ready.mjs|scripts/update-artifacts.mjs:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script|Unclassified Repository Update|Project Healthcheck Script -->

## Validation Entry — 2026-07-05 20:43:42 Asia/Manila

| Check             |  Result | Notes                                                                               |
| ----------------- | ------: | ----------------------------------------------------------------------------------- |
| Validation status | Pending | Run `npm run healthcheck` and attach command output before marking checks as passed |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json|AGENTS.md|scripts/check-artifacts.mjs|scripts/healthcheck.mjs|scripts/sprint-ready.mjs|scripts/update-artifacts.mjs:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script|Unclassified Repository Update|Automatic Artifact Log Generator -->

## Validation Entry — 2026-07-05 20:44:40 Asia/Manila

| Check             |  Result | Notes                                                                               |
| ----------------- | ------: | ----------------------------------------------------------------------------------- |
| Validation status | Pending | Run `npm run healthcheck` and attach command output before marking checks as passed |

<!-- artifact-signature:m1:staged changes:2026-07-05:docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md:Implementation Artifact Update|Sprint Documentation Update -->

## Validation Entry — 2026-07-05 20:50:23 Asia/Manila

| Check             |  Result | Notes                                                                               |
| ----------------- | ------: | ----------------------------------------------------------------------------------- |
| Validation status | Pending | Run `npm run healthcheck` and attach command output before marking checks as passed |
