# m1 Testing Reports

## Validation Log

| Test ID    | Date       | Area                  | Command or Method                    | Result | Notes                                                                               |
| ---------- | ---------- | --------------------- | ------------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| TST-M1-001 | 2026-06-24 | Repository structure  | Required file validation             | Passed | Standards, README, and member artifacts exist and are non-empty                     |
| TST-M1-002 | 2026-06-24 | Documentation quality | Search for unfinished markers        | Passed | No unfinished markers found                                                         |
| TST-M1-003 | 2026-06-27 | Frontend shell        | `npm run build --workspace frontend` | Passed | TypeScript and Vite production build completed for the frontend workspace           |
| TST-M1-004 | 2026-06-27 | Full validation       | Required validation sequence         | Passed | Full required validation passed after using a temporary local Prisma validation URL |
| TST-M1-005 | 2026-06-27 | Welcome polish        | `npm run build --workspace frontend` | Passed | Adaptive Welcome screen polish compiled successfully before full validation         |
| TST-M1-006 | 2026-06-27 | Welcome polish        | Required validation sequence         | Passed | Format, lint, build with temporary Prisma URL, and audit passed                     |
| TST-M1-007 | 2026-06-27 | Welcome footer        | `npm run build --workspace frontend` | Passed | Restored Welcome footer compiled successfully before full validation                |
| TST-M1-008 | 2026-06-27 | Welcome footer        | Required validation sequence         | Passed | Format, lint, build with temporary Prisma URL, and audit passed                     |

## Sprint 1 Welcome Footer Validation

| Command                                                                                            | Result | Notes                                                                          |
| -------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `npm run build --workspace frontend`                                                               | Passed | Focused frontend build passed after footer restoration                         |
| `npm run format`                                                                                   | Passed | Prettier formatted changed frontend and m1 artifact files                      |
| `npm run format:check`                                                                             | Passed | All matched files use Prettier style                                           |
| `npm run lint`                                                                                     | Passed | Existing root ESLint module-type warning emitted, no lint errors               |
| `npm run build`                                                                                    | Failed | First run failed only because `DATABASE_URL` was not set for Prisma validation |
| `$env:DATABASE_URL='mysql://root:password@localhost:3306/ysabellestore_validation'; npm run build` | Passed | Frontend, backend, Electron, and Prisma validation passed                      |
| `npm audit --audit-level=high`                                                                     | Passed | Found 0 vulnerabilities                                                        |

## Sprint 1 Welcome Polish Validation

| Command                                                                                            | Result | Notes                                                                          |
| -------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `npm run build --workspace frontend`                                                               | Passed | Focused frontend build passed after Welcome screen polish                      |
| `npm run format`                                                                                   | Passed | Prettier formatted changed frontend and m1 artifact files                      |
| `npm run format:check`                                                                             | Passed | All matched files use Prettier style                                           |
| `npm run lint`                                                                                     | Passed | Existing root ESLint module-type warning emitted, no lint errors               |
| `npm run build`                                                                                    | Failed | First run failed only because `DATABASE_URL` was not set for Prisma validation |
| `$env:DATABASE_URL='mysql://root:password@localhost:3306/ysabellestore_validation'; npm run build` | Passed | Frontend, backend, Electron, and Prisma validation passed                      |
| `npm audit --audit-level=high`                                                                     | Passed | Found 0 vulnerabilities                                                        |

## Required Evidence

| Area          | Evidence                                            |
| ------------- | --------------------------------------------------- |
| Documentation | Required files exist and are non-empty              |
| Workflow      | YAML file exists and branch regex is documented     |
| Frontend      | Build, lint, and UI smoke test once scaffold exists |
| Electron      | Package or startup smoke test once app exists       |

## Sprint 1 Frontend Shell Validation

| Command                                                                                            | Result | Notes                                                                          |
| -------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| `npm run build --workspace frontend`                                                               | Passed | Initial focused check before full repo validation                              |
| `npm run format`                                                                                   | Passed | Prettier formatted changed frontend and m1 artifact files                      |
| `npm run format:check`                                                                             | Passed | All matched files use Prettier style                                           |
| `npm run lint`                                                                                     | Passed | Existing root ESLint module-type warning emitted, no lint errors               |
| `npm run build`                                                                                    | Failed | First run failed only because `DATABASE_URL` was not set for Prisma validation |
| `$env:DATABASE_URL='mysql://root:password@localhost:3306/ysabellestore_validation'; npm run build` | Passed | Frontend, backend, Electron, and Prisma validation passed                      |
| `npm audit --audit-level=high`                                                                     | Passed | Found 0 vulnerabilities                                                        |
