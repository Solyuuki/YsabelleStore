# m1 Testing Reports

## Validation Log

| Test ID    | Date       | Area                              | Command or Method                                      | Result | Evidence / Notes                                                                             |
| ---------- | ---------- | --------------------------------- | ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------- |
| TST-M1-001 | 2026-06-24 | Repository structure              | Required file and standards review                     | Passed | Repository foundation files were created and are present in history.                         |
| TST-M1-002 | 2026-06-24 | Documentation quality             | Search for unfinished markers                          | Passed | Existing historical report states no unfinished markers were found.                          |
| TST-M1-003 | 2026-06-27 | Frontend shell                    | `npm run build --workspace frontend`                   | Passed | Existing historical report records TypeScript and Vite production build success.             |
| TST-M1-004 | 2026-06-27 | Root validation                   | Required validation sequence with temporary Prisma URL | Passed | Existing historical report records full validation passed after `DATABASE_URL` was supplied. |
| TST-M1-005 | 2026-06-27 | Welcome screen polish             | `npm run build --workspace frontend`                   | Passed | Existing historical report records focused frontend build success.                           |
| TST-M1-006 | 2026-06-27 | Welcome screen polish             | Format, lint, build, audit                             | Passed | Existing historical report records all checks passed.                                        |
| TST-M1-007 | 2026-06-27 | Welcome footer                    | `npm run build --workspace frontend`                   | Passed | Existing historical report records focused frontend build success.                           |
| TST-M1-008 | 2026-06-27 | Welcome footer                    | Format, lint, build, audit                             | Passed | Existing historical report records all checks passed.                                        |
| TST-M1-009 | 2026-06-27 | App shell cohesion                | Format, lint, frontend typecheck, root build, audit    | Passed | Existing historical report records all checks passed with temporary Prisma URL.              |
| TST-M1-010 | 2026-06-27 | Theme polish                      | Format, lint, frontend typecheck, root build, audit    | Passed | Existing historical report records all checks passed with temporary Prisma URL.              |
| TST-M1-011 | 2026-06-27 | Final shell polish                | Format, lint, frontend typecheck, root build, audit    | Passed | Existing historical report records all checks passed with temporary Prisma URL.              |
| TST-M1-012 | 2026-06-29 | Current frontend source           | `npm run build --workspace frontend`                   | Passed | Verified during artifact reconstruction before file edits.                                   |
| TST-M1-013 | 2026-06-29 | Current backend source            | `npm run build --workspace backend`                    | Passed | Verified during artifact reconstruction before file edits.                                   |
| TST-M1-014 | 2026-06-29 | Prisma schema                     | `npm run prisma:validate`                              | Passed | Verified during artifact reconstruction before file edits.                                   |
| TST-M1-015 | 2026-06-29 | Documentation-only reconstruction | Final validation command set                           | Passed | `format:check`, lint, workspace typecheck, build, Prisma validation, and audit passed.       |

## Early Historical Validation Detail

| --- | --- | --- | --- |
| 2026-06-27 | `npm run build --workspace frontend` | Passed | Used repeatedly for frontend shell and welcome-screen changes. |
| 2026-06-27 | `npm run format` | Passed | Historical report says changed frontend and M1 artifact files were formatted. |
| 2026-06-27 | `npm run format:check` | Passed | Historical report says matched files used Prettier style. |
| 2026-06-27 | `npm run lint` | Passed | Historical report notes an existing root ESLint module-type warning, with no lint errors. |
| 2026-06-27 | `npm run build` without `DATABASE_URL` | Failed | Failure was limited to missing Prisma validation environment variable. |
| 2026-06-27 | Root build with temporary `DATABASE_URL` | Passed | Historical report records frontend, backend, Electron, and Prisma validation passed. |
| 2026-06-27 | `npm audit --audit-level=high` | Passed | Historical report records 0 vulnerabilities. |
| 2026-07-07 | `npm run format` | Passed | Completed successfully. |
| 2026-07-07 | `npm run format:check` | Passed | Completed successfully. |
| 2026-07-07 | `npm run lint` | Passed | Passed with existing Node module-type warning only. |
| 2026-07-07 | `npm run typecheck --workspace frontend` | Passed | Completed successfully. |
| 2026-07-07 | `npm run typecheck --workspace backend` | Passed | Completed successfully. |
| 2026-07-07 | `npm run typecheck --workspace electron` | Passed | Completed successfully. |
| 2026-07-07 | `npm run build` | Passed | Build completed successfully. |
| 2026-07-07 | `npm audit --audit-level=high` | Passed | Completed successfully. |
| 2026-07-08 | `npm run format` | Passed | Completed successfully. |
| 2026-07-08 | `npm run format:check` | Passed | Completed successfully. |
| 2026-07-08 | `npm run lint` | Passed | Passed with existing Node module-type warning only. |
| 2026-07-08 | `npm run typecheck --workspace frontend` | Passed | Completed successfully. |
| 2026-07-08 | `npm run typecheck --workspace backend` | Passed | Completed successfully. |
| 2026-07-08 | `npm run typecheck --workspace electron` | Passed | Completed successfully. |
| 2026-07-08 | `npm run build` | Passed | Build completed successfully. |
| 2026-07-08 | `npm audit --audit-level=high` | Passed | Completed successfully. |
| 2026-07-09 | `npm run format` | Pending | Run validation before push and record the result. |

## Early Manual Review Evidence

| --- | --- | --- | --- |
| 2026-06-27 | Welcome screen and footer | Passed by visual review evidence in committed screenshots | Screenshot artifacts were restored from Git history during 2026-06-29 reconstruction. |
| 2026-06-27 | Dashboard shell collapsed and expanded states | Passed by visual review evidence in committed screenshots | Screenshot artifacts are historical review aids, not runtime dependencies. |
| 2026-06-29 | Sidebar route comparison | Passed analysis | M1 route/page files are present in current `frontend/src/**`; M3 branch frontend replacement is documented as a merge risk. |
| 2026-07-07 | Changed files | Not required by changed files | No changed user-facing flow was detected by the artifact update. |
| 2026-07-08 | Changed files | Not required by changed files | No changed user-facing flow was detected by the artifact update. |
| 2026-07-09 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |

## Validation Limits

| Area                          | Status                                     | Reason                                                                             |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| Electron packaged installer   | Not run historically in available evidence | Electron foundation exists, but no packaged `.exe` validation artifact is present. |
| Browser/Electron console logs | Not available in repository                | No saved console transcript was found.                                             |
| Automated UI tests            | Not present                                | No Playwright/Cypress test suite exists in repository dependencies.                |

## Historical Validation Detail

| Date       | Command                                  | Result  | Notes                                                             |
| ---------- | ---------------------------------------- | ------- | ----------------------------------------------------------------- |
| 2026-07-07 | `npm audit --audit-level=high`           | Passed  | Completed successfully.                                           |
| 2026-07-09 | `npm run format`                         | Passed  | Completed successfully.                                           |
| 2026-07-09 | `npm run format:check`                   | Passed  | Completed successfully.                                           |
| 2026-07-09 | `npm run lint`                           | Passed  | Passed with existing Node module-type warning only.               |
| 2026-07-09 | `npm run typecheck --workspace frontend` | Passed  | Completed successfully.                                           |
| 2026-07-09 | `npm run typecheck --workspace backend`  | Passed  | Completed successfully.                                           |
| 2026-07-09 | `npm run typecheck --workspace electron` | Passed  | Completed successfully.                                           |
| 2026-07-09 | `npm run build`                          | Passed  | Build completed successfully.                                     |
| 2026-07-09 | `npm audit --audit-level=high`           | Passed  | Completed successfully.                                           |
| 2026-07-10 | `npm run format`                         | Passed  | Completed successfully.                                           |
| 2026-07-10 | `npm run format:check`                   | Passed  | Completed successfully.                                           |
| 2026-07-10 | `npm run lint`                           | Passed  | Passed with existing Node module-type warning only.               |
| 2026-07-10 | `npm run typecheck --workspace frontend` | Passed  | Completed successfully.                                           |
| 2026-07-10 | `npm run typecheck --workspace backend`  | Passed  | Completed successfully.                                           |
| 2026-07-10 | `npm run typecheck --workspace electron` | Passed  | Completed successfully.                                           |
| 2026-07-10 | `npm run build`                          | Passed  | Build completed successfully.                                     |
| 2026-07-10 | `npm audit --audit-level=high`           | Passed  | Completed successfully.                                           |
| 2026-07-11 | `npm run format`                         | Passed  | Completed successfully.                                           |
| 2026-07-11 | `npm run format:check`                   | Passed  | Completed successfully.                                           |
| 2026-07-11 | `npm run lint`                           | Passed  | Passed with existing Node module-type warning only.               |
| 2026-07-11 | `npm run typecheck --workspace frontend` | Passed  | Completed successfully.                                           |
| 2026-07-11 | `npm run typecheck --workspace backend`  | Passed  | Completed successfully.                                           |
| 2026-07-11 | `npm run typecheck --workspace electron` | Passed  | Completed successfully.                                           |
| 2026-07-11 | `npm run build`                          | Passed  | Build completed successfully.                                     |
| 2026-07-11 | `npm audit --audit-level=high`           | Passed  | Completed successfully.                                           |
| 2026-07-12 | `npm run format`                         | Passed  | Completed successfully.                                           |
| 2026-07-12 | `npm run format:check`                   | Passed  | Completed successfully.                                           |
| 2026-07-12 | `npm run lint`                           | Passed  | Passed with existing Node module-type warning only.               |
| 2026-07-12 | `npm run typecheck --workspace frontend` | Passed  | Completed successfully.                                           |
| 2026-07-12 | `npm run typecheck --workspace backend`  | Passed  | Completed successfully.                                           |
| 2026-07-12 | `npm run typecheck --workspace electron` | Passed  | Completed successfully.                                           |
| 2026-07-12 | `npm run build`                          | Passed  | Build completed successfully.                                     |
| 2026-07-12 | `npm audit --audit-level=high`           | Passed  | Completed successfully.                                           |
| 2026-07-15 | `npm run format`                         | Passed  | Completed successfully.                                           |
| 2026-07-15 | `npm run format:check`                   | Passed  | Completed successfully.                                           |
| 2026-07-15 | `npm run lint`                           | Passed  | Passed with existing Node module-type warning only.               |
| 2026-07-15 | `npm run typecheck --workspace frontend` | Passed  | Completed successfully.                                           |
| 2026-07-15 | `npm run typecheck --workspace backend`  | Passed  | Completed successfully.                                           |
| 2026-07-15 | `npm run typecheck --workspace electron` | Passed  | Completed successfully.                                           |
| 2026-07-15 | `npm run build`                          | Passed  | Build completed successfully.                                     |
| 2026-07-15 | `npm audit --audit-level=high`           | Passed  | Completed successfully.                                           |
| 2026-07-16 | `npm run format`                         | Passed  | Completed successfully.                                           |
| 2026-07-16 | `npm run format:check`                   | Passed  | Completed successfully.                                           |
| 2026-07-16 | `npm run lint`                           | Passed  | Passed with existing Node module-type warning only.               |
| 2026-07-16 | `npm run typecheck --workspace frontend` | Passed  | Completed successfully.                                           |
| 2026-07-16 | `npm run typecheck --workspace backend`  | Passed  | Completed successfully.                                           |
| 2026-07-16 | `npm run typecheck --workspace electron` | Passed  | Completed successfully.                                           |
| 2026-07-16 | `npm run build`                          | Passed  | Build completed successfully.                                     |
| 2026-07-16 | `npm audit --audit-level=high`           | Passed  | Completed successfully.                                           |
| 2026-08-09 | `npm run format`                         | Pending | Run validation before push and record the result.                 |
| 2026-08-09 | `npm run format:check`                   | Pending | Run validation before push and record the result.                 |
| 2026-08-09 | `npm run lint`                           | Pending | Run validation before push and record the result.                 |
| 2026-08-09 | `npm run typecheck --workspace frontend` | Pending | Run validation before push and record the result.                 |
| 2026-08-09 | `npm run typecheck --workspace backend`  | Pending | Run validation before push and record the result.                 |
| 2026-08-09 | `npm run typecheck --workspace electron` | Pending | Run validation before push and record the result.                 |
| 2026-08-09 | `npm run build`                          | Pending | Run validation before push and record the result.                 |
| 2026-08-09 | `npm audit --audit-level=high`           | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm run format`                         | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm run format:check`                   | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm run lint`                           | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm run typecheck --workspace frontend` | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm run typecheck --workspace backend`  | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm run typecheck --workspace electron` | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm run build`                          | Pending | Run validation before push and record the result.                 |
| 2026-08-10 | `npm audit --audit-level=high`           | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm run format`                         | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm run format:check`                   | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm run lint`                           | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm run typecheck --workspace frontend` | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm run typecheck --workspace backend`  | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm run typecheck --workspace electron` | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm run build`                          | Pending | Run validation before push and record the result.                 |
| 2026-08-11 | `npm audit --audit-level=high`           | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm run format`                         | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm run format:check`                   | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm run lint`                           | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm run typecheck --workspace frontend` | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm run typecheck --workspace backend`  | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm run typecheck --workspace electron` | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm run build`                          | Pending | Run validation before push and record the result.                 |
| 2026-08-14 | `npm audit --audit-level=high`           | Pending | Run validation before push and record the result.                 |
| 2026-08-18 | `npm run verify:code`                    | Passed  | The aggregate read-only code verification completed successfully. |
| 2026-08-23 | `npm run verify:code`                    | Passed  | The aggregate read-only code verification completed successfully. |
| 2026-08-24 | `npm run verify:code`                    | Passed  | The aggregate read-only code verification completed successfully. |
| 2026-08-26 | `npm run verify:code`                    | Passed  | The aggregate read-only code verification completed successfully. |

## Manual Review Evidence

| Date       | Area                                                                   | Result                        | Notes                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-07 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-07-11 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-07-12 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-07-15 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-07-16 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-08-09 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-08-10 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-08-11 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-08-14 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-08-18 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-08-23 | Changed files                                                          | Not required by changed files | No changed user-facing flow was detected by the artifact update.                                                                                                    |
| 2026-08-24 | Auth UI, trusted-device flow, logout confirmation, and session restore | Not yet manually verified     | Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast. |
| 2026-08-26 | Changed files                                                          | Manually verified             | Customer registration/login/session/logout and Staff/Owner realm-isolation manual QA completed; cross-realm auth toast containment visually verified.               |

## Discontinued Product Normalization

The one-time cleanup script normalized these live products from `DISCONTINUED` to `INACTIVE` without changing inventory, movement, sales, or forecasting history:

- `prd_hand_sanitizer` - Pocket Hand Sanitizer - `TOI-SANI-001`
- `cmrgb64pg007tibtw4uar02vb` - DATA FLOW TEST PRODUCT e78d9047 - `TEST-9B3A7C4E-0F4`
- `cmrgb8s9r007tibr4g6j4hezb` - DATA FLOW TEST PRODUCT 4955628f - `TEST-4C43F0A5-0E5`
