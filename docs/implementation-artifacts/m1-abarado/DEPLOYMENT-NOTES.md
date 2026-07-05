# m1 Deployment Notes

## Deployment Scope

| Area                               | Status                                  | Evidence                                                                                             |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Frontend production build          | Ready for Sprint 1 static shell         | `npm run build --workspace frontend` passed on 2026-06-29 and in historical M1 reports               |
| Electron runtime foundation        | Foundation ready                        | `electron/src/main/**`, `electron/src/preload/**`, `electron/src/security/**`                        |
| Electron packaged installer        | Not yet verified                        | No committed package artifact or installer validation transcript exists                              |
| Backend/database connection for UI | Not implemented in M1 frontend          | UI screens are static and do not call backend APIs yet                                               |
| Docker MySQL development runtime   | Ready for local development             | Docker Compose starts `ysabelle-mysql` and reports healthy on port `3306`                            |
| Healthcheck validation command     | Implemented / build rerun needed        | `npm run healthcheck` reports all checks; current build can hit Prisma EPERM file lock               |
| Artifact automation                | Ready for local commits                 | Pre-commit runs `npm run artifacts:check`; generator is available through `npm run artifacts:update` |
| Release documentation              | In progress through this reconstruction | Updated implementation artifacts and migration standards                                             |

## Deployment Log

| Version / Branch     | Date       | Target                                                                                  | Status    | Notes                                                                                                        |
| -------------------- | ---------- | --------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------ |
| Foundation history   | 2026-06-24 | Repository documentation and architecture                                               | Completed | No application release package was produced.                                                                 |
| Sprint 1 foundation  | 2026-06-25 | Frontend, backend, database, Electron, CI, configuration, deployment, testing scaffolds | Completed | Foundations were created as repository structures and docs.                                                  |
| M1 frontend branch   | 2026-06-27 | Static React frontend shell                                                             | Completed | Frontend build and full validation were recorded as passed.                                                  |
| Sprint 1 integration | 2026-06-29 | Current sprint branch                                                                   | In review | M1 frontend and M3 database/backend database boundary are present; documentation reconstruction is underway. |
| Sprint 2 setup       | 2026-07-05 | Docker MySQL and project healthcheck                                                    | In review | Docker runtime is healthy; healthcheck works but needs a clean rerun after Prisma EPERM lock is cleared.     |
| Sprint 2 artifacts   | 2026-07-05 | M1 artifact backfill and automation                                                     | In review | Existing M1 Sprint 2 auth/setup work is backfilled; future implementation changes are guarded by pre-commit. |

## Release Checklist

| Check                                        | Status       | Evidence / Required Action                                                                |
| -------------------------------------------- | ------------ | ----------------------------------------------------------------------------------------- |
| Frontend build passes                        | Passed       | Verified 2026-06-29.                                                                      |
| Backend build passes                         | Passed       | Verified 2026-06-29.                                                                      |
| Prisma schema validates                      | Passed       | Verified 2026-06-29.                                                                      |
| Full root build passes                       | Passed       | `npm run build` passed on 2026-06-29.                                                     |
| Lint passes                                  | Passed       | `npm run lint` passed on 2026-06-29 with only the existing ESLint module-type warning.    |
| Format check passes                          | Passed       | `npm run format:check` passed on 2026-06-29.                                              |
| Security audit has no high vulnerabilities   | Passed       | `npm audit --audit-level=high` found 0 vulnerabilities on 2026-06-29.                     |
| Docker Desktop available                     | Passed       | Docker CLI and Docker Compose were available during Sprint 2 setup validation.            |
| MySQL container healthy                      | Passed       | `ysabelle-mysql` reported healthy on port `3306`.                                         |
| Healthcheck sequence and report              | Passed       | `npm run healthcheck` ran all checks in order and printed a final report table.           |
| Healthcheck clean build                      | Blocked      | Prisma EPERM file lock must be cleared, then `npm run healthcheck` should be rerun.       |
| Artifact check command                       | Passed       | `npm run artifacts:check` passes when implementation changes include M1 artifact updates. |
| Electron package builds                      | Not verified | Required before a release installer is claimed.                                           |
| Prisma migrations are applied to local MySQL | Not verified | Migration artifact exists, but application against a real database is not documented.     |

## Sprint 2 Local Setup Notes

| Note                              | Detail                                              |
| --------------------------------- | --------------------------------------------------- |
| Docker Desktop required           | Docker Desktop is required once per member machine. |
| Manual MySQL install not required | Members do not need to manually install MySQL.      |
| Start shared MySQL                | Use `docker compose up -d` to start shared MySQL.   |

## Known Deployment Limits

| Limit                              | Impact                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Static frontend only               | UI demonstrates shell readiness, not live business workflows.                                |
| No packaged desktop artifact       | Sprint 1 cannot claim installer readiness.                                                   |
| Migration SQL review artifact only | Database deployment to a real environment still requires controlled migration application.   |
| Prisma EPERM lock during build     | Close running Node/backend processes before rerunning `npm run healthcheck`.                 |
| Register endpoint still public     | Backend owner-only guard must land before server-side account creation is considered secure. |
