# Definition of Done

A Sprint 2 task is complete only when its approved scope, validation evidence, documentation, and owner review are present. This document is planning only and does not implement Sprint 2 work.

## Task Completion Checklist

| Requirement              | Status Rule                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Scope completed          | Work matches the approved Sprint 2 backlog item                                                    |
| Branch name valid        | Branch follows approved member/version/type/task-name format                                       |
| Pull request created     | Work is reviewed through GitHub PR                                                                 |
| Review passed            | Assigned reviewer and affected owner approve the PR                                                |
| Format check passed      | `npm run format:check` passes                                                                      |
| Lint passed              | `npm run lint` passes                                                                              |
| Typecheck passed         | Affected workspace typecheck passes                                                                |
| Prisma validation passed | `npx prisma validate --schema=database/prisma/schema.prisma` passes when database work is affected |
| Audit passed             | `npm audit --audit-level=high` passes                                                              |
| Documentation updated    | Sprint 2 docs and member artifacts reflect the work                                                |
| Regression reviewed      | Existing Sprint 1 UI and foundation behavior remain safe                                           |

## Sprint 2 Required Outcomes

| Outcome                                                                   | Requirement                                                                  |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Login works with real backend                                             | Login must validate credentials through backend authentication               |
| Mock authentication removed or replaced                                   | Hardcoded session/user UI must not remain as the auth source                 |
| User data comes from database                                             | Current user must come from Prisma-backed user data                          |
| Owner and Staff roles are recognized                                      | Role values must support owner and staff behavior                            |
| Protected routes are enforced                                             | Unauthenticated users cannot access protected routes                         |
| Seed users are documented                                                 | Development owner/staff accounts and safe credential handling are documented |
| Prisma validation passes                                                  | Prisma schema remains valid after authentication/database work               |
| Lint passes                                                               | Repository lint check is green                                               |
| Typecheck passes                                                          | Affected TypeScript workspaces are green                                     |
| Format check passes                                                       | Repository formatting check is green                                         |
| Audit passes                                                              | No high or critical dependency vulnerabilities remain unresolved             |
| No unrelated UI regression                                                | Existing Sprint 1 app shell and placeholders remain stable                   |
| No unrelated source-code changes outside approved Sprint 2 implementation | PR scope is limited to approved Sprint 2 work                                |

## Authentication Done Criteria

| Area             | Requirement                                                         |
| ---------------- | ------------------------------------------------------------------- |
| Login            | Valid credentials authenticate through backend and database records |
| Logout           | User can end the authenticated session safely                       |
| Session          | Current-user/session validation restores authenticated state        |
| Owner            | Owner role is recognized for owner-only areas                       |
| Staff            | Staff role is recognized and blocked from owner-only areas          |
| Protected routes | Protected routes reject unauthenticated users                       |
| JWT / Session    | Token or session handling is safe and environment-driven            |
| Middleware       | Backend middleware protects authenticated and role-limited APIs     |

## Backend Done Criteria

| Area        | Requirement                                                               |
| ----------- | ------------------------------------------------------------------------- |
| Routes      | Auth routes follow approved API naming and response standards             |
| Controllers | Controllers translate validated requests into service calls               |
| Services    | Services own authentication and backend business decisions                |
| Validation  | Request body, params, and query values are validated before service calls |
| Errors      | Expected auth and API failures return safe standardized errors            |

## Database Done Criteria

| Area                 | Requirement                                                               |
| -------------------- | ------------------------------------------------------------------------- |
| Seed users           | Owner and staff development seed users are documented                     |
| Password hash        | Password hash storage is planned and never exposed in responses           |
| Prisma integration   | Backend user lookup uses the approved Prisma client boundary              |
| Migration validation | Migration and Prisma validation evidence are recorded before sprint close |

## Integration Done Criteria

| Area                       | Requirement                                                           |
| -------------------------- | --------------------------------------------------------------------- |
| Frontend-backend auth      | Login form, auth API calls, session load, and logout flow align       |
| Protected route behavior   | Dashboard and sensitive modules use authenticated session state       |
| Product backend planning   | Product API planning follows auth and validation patterns             |
| Inventory backend planning | Inventory API planning follows database and validation constraints    |
| Regression                 | Electron shell, dashboard shell, and Sprint 1 foundations remain safe |

## Validation Checklist

| Checker       | Required Evidence                                                   |
| ------------- | ------------------------------------------------------------------- |
| Build         | `npm run build` result                                              |
| Lint          | `npm run lint` result                                               |
| Typecheck     | Affected workspace typecheck result                                 |
| Prisma        | `npx prisma validate --schema=database/prisma/schema.prisma` result |
| Audit         | `npm audit --audit-level=high` result                               |
| Regression    | No unrelated UI or foundation regression notes                      |
| Documentation | Sprint 2 docs and member artifacts updated                          |

## Merge Requirements

| Requirement       | Rule                                                                       |
| ----------------- | -------------------------------------------------------------------------- |
| PR required       | Every Sprint 2 implementation task must merge through pull request         |
| Owner approval    | Cross-layer changes require affected owner review                          |
| Validation record | Required command results must be listed in the PR                          |
| Auth evidence     | Auth PRs must include login, logout, session, and protected route evidence |
| Database evidence | Seed, Prisma, or migration changes must include database validation notes  |
| Documentation     | Related Sprint 2 member docs must be updated before merge                  |
