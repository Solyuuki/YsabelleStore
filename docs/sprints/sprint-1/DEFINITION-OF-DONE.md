# Definition of Done

A Sprint 1 task is complete only when scope, review, validation, and governance evidence are all present.

## Task Completion Checklist

| Requirement               | Status Rule                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Scope completed           | The task matches its approved backlog description                                                  |
| Branch name valid         | Branch follows Sprint 1 branch governance                                                          |
| Pull request created      | Work is reviewed through GitHub PR                                                                 |
| Review passed             | Assigned reviewer approves the PR                                                                  |
| Format applied            | `npm run format` has been run by the task owner                                                    |
| Format check passed       | `npm run format:check` passes                                                                      |
| Lint passed               | `npm run lint` passes                                                                              |
| Build passed              | `npm run build` passes                                                                             |
| Security audit passed     | `npm audit --audit-level=high` reports no high or critical vulnerabilities                         |
| Prisma validation passed  | `npx prisma validate --schema=database/prisma/schema.prisma` passes when database work is affected |
| No unfinished markers     | No unfinished task markers remain in deliverable files                                             |
| No severe vulnerabilities | No high or critical dependency vulnerabilities remain unresolved                                   |

## Evidence Required in PR

| Evidence          | Required Detail                                   |
| ----------------- | ------------------------------------------------- |
| Scope             | Backlog task ID and short summary                 |
| Files changed     | List affected files or folders                    |
| Validation        | Commands run and pass/fail result                 |
| Screenshots       | Required for visible frontend or Electron changes |
| Database evidence | Required for Prisma schema or migration changes   |
| Risk notes        | Known risks or carry-over items                   |
| Ownership         | Reviewer and affected owner approval              |

## Sprint 1 Exit Criteria

| Exit Item      | Requirement                                                           |
| -------------- | --------------------------------------------------------------------- |
| Sprint backlog | All committed Sprint 1 tasks are completed or explicitly carried over |
| CI             | Sprint branch passes required GitHub Actions                          |
| Integration    | Frontend, backend, database, and Electron foundations do not conflict |
| Review         | Sprint review document is updated with validation results             |
| Staging        | Sprint branch is ready for PR into `staging`                          |
