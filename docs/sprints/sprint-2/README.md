# Sprint 2 Planning Index

Sprint 2 moves YsabelleStore from static auth mockups into a working authentication, remembered-account quick access, owner-only user management, and role-based access control foundation. The sprint now uses a clearer ownership split:

## Sprint 2 Member Ownership

| Member       | Role                 | Updated Scope                                                                                                                                                    | Status Target          |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| M1 / Abarado | Full Stack / Auth UI | Login UI, auth state, device recognition, quick access, toast notifications, RBAC UI, owner-only Users page, Docker setup, healthcheck docs, artifact automation | Feature implementation |
| M2 / Ramos   | Testing / QA         | Seed verification, auth testing, RBAC testing, device recognition testing, backend guard testing, validation evidence                                            | QA validation          |
| M3 / Vito    | Backend Security     | Protect register endpoint, owner-only backend guard, backend auth/RBAC hardening, safe API responses, backend/security blocker resolution                        | Security hardening     |

## Sprint Metadata

| Field         | Details                                                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint        | Sprint 2                                                                                                                                                                                  |
| Version       | `v0.2`                                                                                                                                                                                    |
| Sprint branch | `sprint/v0.2/sprint-2`                                                                                                                                                                    |
| Sprint status | Implementation in progress                                                                                                                                                                |
| Primary focus | Authentication, remembered local accounts, owner-only user management, backend auth security, frontend RBAC, Docker MySQL setup, healthcheck validation, artifact evidence, QA validation |
| Excluded work | Product CRUD, final POS, inventory movement logic, SARIMA forecasting, recommendation engine, reports, dashboard analytics                                                                |

## Sprint 2 Priority Order

| Order | Member | Task                                                             |
| ----- | ------ | ---------------------------------------------------------------- |
| 1     | M3     | Protect `/api/auth/register` with owner-only backend guard       |
| 2     | M2     | Test M1 auth flows and M3 backend guard                          |
| 3     | M1     | Fix UI bugs found by M2                                          |
| 4     | M1     | Maintain Docker setup and `npm run healthcheck` evidence         |
| 5     | M1     | Keep M1 implementation artifacts synchronized through automation |
| 6     | All    | Prepare PR to `sprint/v0.2/sprint-2`                             |

## Planning Documents

| Document                                       | Purpose                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| [SPRINT-GOAL.md](SPRINT-GOAL.md)               | Defines the Sprint 2 goal, scope, and expected outcome                       |
| [SPRINT-BACKLOG.md](SPRINT-BACKLOG.md)         | Groups Sprint 2 tasks by member, priority, blocker ownership, and validation |
| [DEFINITION-OF-DONE.md](DEFINITION-OF-DONE.md) | Defines completion requirements for Sprint 2 work                            |
| [MEMBER-ASSIGNMENTS.md](MEMBER-ASSIGNMENTS.md) | Indexes the per-member Sprint 2 assignment files                             |
| [members/m1-abarado.md](members/m1-abarado.md) | M1 auth UI, remembered accounts, RBAC UI, and owner-only Users scope         |
| [members/m2-ramos.md](members/m2-ramos.md)     | M2 testing and QA scope                                                      |
| [members/m3-vito.md](members/m3-vito.md)       | M3 backend auth security hardening scope                                     |

## Sprint Rule

Sprint 2 is authentication, remembered-account quick access, owner-only user management, backend auth security, and RBAC foundation only. Public registration is removed from the login page. Product, inventory, POS, forecasting, recommendation, reports, dashboard analytics, and import modules remain out of scope until authorized user access is stable.

Owner-only User Management handles store account creation and staff administration. Staff self password change remains future work.

## Sprint 2 Blockers and Ownership

| Blocker                                        | Owner             | Status                      |
| ---------------------------------------------- | ----------------- | --------------------------- |
| Backend `/api/auth/register` is still public   | M3 / Vito         | Pending                     |
| No-token register request must be blocked      | M3 / Vito         | Pending                     |
| Invalid-token register request must be blocked | M3 / Vito         | Pending                     |
| Staff-token register request must be blocked   | M3 / Vito         | Pending                     |
| Inactive-user register request must be blocked | M3 / Vito         | Pending                     |
| Owner-token register request must still work   | M3 / Vito         | Pending                     |
| M1 UI needs backend confirmation               | M3 then M2        | Pending                     |
| Prisma DLL lock during build                   | All / Environment | Known environment issue     |
| Prisma EPERM during healthcheck build          | All / Environment | Active / Needs verification |

M1 already moved account creation to the owner-only User Management UI, but complete security requires M3 backend enforcement. M1 should not be responsible for fixing backend register protection unless explicitly reassigned. M3 owns backend auth hardening, and M2 validates the final behavior through API and UI tests.

## M1 Setup and Validation Additions

| Task                       |                                     Status | Notes                                                                             |
| -------------------------- | -----------------------------------------: | --------------------------------------------------------------------------------- |
| Docker Development Setup   |              Completed / Runtime Validated | MySQL Docker Compose setup is healthy on port `3306`                              |
| Project Healthcheck Script | Implemented / Needs final clean validation | `npm run healthcheck` runs all required local checks and reports pass/fail status |
| Future Artifact Automation |                                Implemented | Pre-commit artifact check requires M1 evidence for future implementation changes  |

## M1 Verified Sprint 2 Backfill

| Work Area                               |                Status | Evidence                                                                                     |
| --------------------------------------- | --------------------: | -------------------------------------------------------------------------------------------- |
| Auth Fullstack Flow Foundation          |              Verified | Frontend auth context/API client and backend auth routes/controller/service/middleware exist |
| Login Page Flow Update                  |              Verified | `WelcomePage` contains login, remembered account, loading, and password visibility flows     |
| Register Flow Security Decision         | Documented / Verified | Public registration is removed from login UI; backend endpoint remains a tracked M3 blocker  |
| Owner-Controlled Staff Account Creation |              Verified | `UserManagementPage` handles owner-side account creation and preserves owner session         |
| Protected Access / Access Denied UX     |              Verified | Route role metadata, sidebar filtering, and `AccessDeniedPage` are present                   |
| User Management Direction/Page          |              Verified | `/users` is OWNER-only and points to `UserManagementPage`                                    |

## Sprint 2 Artifact Tracking Workflow

Before committing implementation work, members must run the Sprint Ready workflow.

| Member       | Command                               |
| ------------ | ------------------------------------- |
| M1 / Abarado | `npm run sprint:ready -- --member=m1` |
| M2 / Ramos   | `npm run sprint:ready -- --member=m2` |
| M3 / Vito    | `npm run sprint:ready -- --member=m3` |

Recommended flow:

```sh
git add .
npm run sprint:ready -- --member=m1
git add .
git commit -m "feat: update sprint 2 work"
git push
```

This command:

| Step            | Purpose                                                    |
| --------------- | ---------------------------------------------------------- |
| Artifact update | Generates member artifact logs from Git changes            |
| Artifact check  | Ensures implementation work includes documentation updates |
| Healthcheck     | Runs full local validation checklist                       |

Generated artifact logs must be reviewed before push.

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script -->

## Auto-Tracked Backlog Update — 2026-07-05 20:42:36 Asia/Manila

| Member       | Task Area                      |                     Status | Evidence                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------ | -------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 / Abarado | Git Hook Update                | Implemented / Needs review | `.husky/pre-commit`                                                                                                                                                                                                                                                                                          |
| M1 / Abarado | Implementation Artifact Update |                 Documented | `docs/implementation-artifacts/m1-abarado/BLOCKERS.md`, `docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md`, `docs/implementation-artifacts/m1-abarado/DECISIONS.md`, `docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md`, `docs/implementation-artifacts/m1-abarado/README.md`, and 4 more |
| M1 / Abarado | Sprint Documentation Update    |                 Documented | `docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md`, `docs/sprints/sprint-2/README.md`, `docs/sprints/sprint-2/SPRINT-BACKLOG.md`, `docs/sprints/sprint-2/SPRINT-GOAL.md`, `docs/sprints/sprint-2/members/m1-abarado.md`                                                                                           |
| M1 / Abarado | Project Healthcheck Script     | Implemented / Needs review | `package.json`                                                                                                                                                                                                                                                                                               |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json|AGENTS.md|scripts/:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script|Unclassified Repository Update|Unclassified Repository Update -->

## Auto-Tracked Backlog Update — 2026-07-05 20:43:15 Asia/Manila

| Member       | Task Area                      |                     Status | Evidence                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------ | -------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 / Abarado | Git Hook Update                | Implemented / Needs review | `.husky/pre-commit`                                                                                                                                                                                                                                                                                          |
| M1 / Abarado | Implementation Artifact Update |                 Documented | `docs/implementation-artifacts/m1-abarado/BLOCKERS.md`, `docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md`, `docs/implementation-artifacts/m1-abarado/DECISIONS.md`, `docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md`, `docs/implementation-artifacts/m1-abarado/README.md`, and 4 more |
| M1 / Abarado | Sprint Documentation Update    |                 Documented | `docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md`, `docs/sprints/sprint-2/README.md`, `docs/sprints/sprint-2/SPRINT-BACKLOG.md`, `docs/sprints/sprint-2/SPRINT-GOAL.md`, `docs/sprints/sprint-2/members/m1-abarado.md`                                                                                           |
| M1 / Abarado | Project Healthcheck Script     | Implemented / Needs review | `package.json`                                                                                                                                                                                                                                                                                               |
| M1 / Abarado | Unclassified Repository Update |               Needs review | `AGENTS.md`                                                                                                                                                                                                                                                                                                  |
| M1 / Abarado | Unclassified Repository Update | Implemented / Needs review | `scripts/`                                                                                                                                                                                                                                                                                                   |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json|AGENTS.md|scripts/check-artifacts.mjs|scripts/healthcheck.mjs|scripts/sprint-ready.mjs|scripts/update-artifacts.mjs:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script|Unclassified Repository Update|Project Healthcheck Script -->

## Auto-Tracked Backlog Update — 2026-07-05 20:43:42 Asia/Manila

| Member       | Task Area                      |                     Status | Evidence                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------ | -------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 / Abarado | Git Hook Update                | Implemented / Needs review | `.husky/pre-commit`                                                                                                                                                                                                                                                                                          |
| M1 / Abarado | Implementation Artifact Update |                 Documented | `docs/implementation-artifacts/m1-abarado/BLOCKERS.md`, `docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md`, `docs/implementation-artifacts/m1-abarado/DECISIONS.md`, `docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md`, `docs/implementation-artifacts/m1-abarado/README.md`, and 4 more |
| M1 / Abarado | Sprint Documentation Update    |                 Documented | `docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md`, `docs/sprints/sprint-2/README.md`, `docs/sprints/sprint-2/SPRINT-BACKLOG.md`, `docs/sprints/sprint-2/SPRINT-GOAL.md`, `docs/sprints/sprint-2/members/m1-abarado.md`                                                                                           |
| M1 / Abarado | Project Healthcheck Script     | Implemented / Needs review | `package.json`                                                                                                                                                                                                                                                                                               |
| M1 / Abarado | Unclassified Repository Update |               Needs review | `AGENTS.md`                                                                                                                                                                                                                                                                                                  |
| M1 / Abarado | Project Healthcheck Script     | Implemented / Needs review | `scripts/check-artifacts.mjs`, `scripts/healthcheck.mjs`, `scripts/sprint-ready.mjs`, `scripts/update-artifacts.mjs`                                                                                                                                                                                         |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:.husky/pre-commit|docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|package.json|AGENTS.md|scripts/check-artifacts.mjs|scripts/healthcheck.mjs|scripts/sprint-ready.mjs|scripts/update-artifacts.mjs:Git Hook Update|Implementation Artifact Update|Sprint Documentation Update|Project Healthcheck Script|Unclassified Repository Update|Automatic Artifact Log Generator -->

## Auto-Tracked Backlog Update — 2026-07-05 20:44:40 Asia/Manila

| Member       | Task Area                        |                     Status | Evidence                                                                                                                                                                                                                                                                                                     |
| ------------ | -------------------------------- | -------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 / Abarado | Git Hook Update                  | Implemented / Needs review | `.husky/pre-commit`                                                                                                                                                                                                                                                                                          |
| M1 / Abarado | Implementation Artifact Update   |                 Documented | `docs/implementation-artifacts/m1-abarado/BLOCKERS.md`, `docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md`, `docs/implementation-artifacts/m1-abarado/DECISIONS.md`, `docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md`, `docs/implementation-artifacts/m1-abarado/README.md`, and 4 more |
| M1 / Abarado | Sprint Documentation Update      |                 Documented | `docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md`, `docs/sprints/sprint-2/README.md`, `docs/sprints/sprint-2/SPRINT-BACKLOG.md`, `docs/sprints/sprint-2/SPRINT-GOAL.md`, `docs/sprints/sprint-2/members/m1-abarado.md`                                                                                           |
| M1 / Abarado | Project Healthcheck Script       | Implemented / Needs review | `package.json`                                                                                                                                                                                                                                                                                               |
| M1 / Abarado | Unclassified Repository Update   |               Needs review | `AGENTS.md`                                                                                                                                                                                                                                                                                                  |
| M1 / Abarado | Automatic Artifact Log Generator | Implemented / Needs review | `scripts/check-artifacts.mjs`, `scripts/healthcheck.mjs`, `scripts/sprint-ready.mjs`, `scripts/update-artifacts.mjs`                                                                                                                                                                                         |

<!-- artifact-signature:m1:staged changes:2026-07-05:docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md|docs/implementation-artifacts/m1-abarado/DECISIONS.md|docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md|docs/implementation-artifacts/m1-abarado/README.md|docs/implementation-artifacts/m1-abarado/SPRINT-PLANNING.md|docs/implementation-artifacts/m1-abarado/SPRINT-PROGRESS.md|docs/implementation-artifacts/m1-abarado/TASKS.md|docs/implementation-artifacts/m1-abarado/TESTING-REPORTS.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md:Implementation Artifact Update|Sprint Documentation Update -->

## Auto-Tracked Backlog Update — 2026-07-05 20:50:23 Asia/Manila

| Member       | Task Area                      |     Status | Evidence                                                                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------ | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 / Abarado | Implementation Artifact Update | Documented | `docs/implementation-artifacts/m1-abarado/BLOCKERS.md`, `docs/implementation-artifacts/m1-abarado/DAILY-NOTES.md`, `docs/implementation-artifacts/m1-abarado/DECISIONS.md`, `docs/implementation-artifacts/m1-abarado/DEPLOYMENT-NOTES.md`, `docs/implementation-artifacts/m1-abarado/README.md`, and 4 more |
| M1 / Abarado | Sprint Documentation Update    | Documented | `docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md`, `docs/sprints/sprint-2/README.md`, `docs/sprints/sprint-2/SPRINT-BACKLOG.md`, `docs/sprints/sprint-2/SPRINT-GOAL.md`, `docs/sprints/sprint-2/members/m1-abarado.md`                                                                                           |

<!-- artifact-signature:m1:unstaged changes:2026-07-05:docs/implementation-artifacts/m1-abarado/BLOCKERS.md|docs/sprints/sprint-2/DEFINITION-OF-DONE.md|docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md|docs/sprints/sprint-2/README.md|docs/sprints/sprint-2/SPRINT-BACKLOG.md|docs/sprints/sprint-2/SPRINT-GOAL.md|docs/sprints/sprint-2/members/m1-abarado.md|docs/sprints/sprint-2/members/m2-ramos.md|docs/sprints/sprint-2/members/m3-vito.md:Implementation Artifact Update|Sprint Documentation Update -->

## Auto-Tracked Backlog Update — 2026-07-05 21:21:52 Asia/Manila

| Member       | Task Area                      |     Status | Evidence                                                                                                                                                                                                                       |
| ------------ | ------------------------------ | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M1 / Abarado | Implementation Artifact Update | Documented | `docs/implementation-artifacts/m1-abarado/BLOCKERS.md`                                                                                                                                                                         |
| M1 / Abarado | Sprint Documentation Update    | Documented | `docs/sprints/sprint-2/DEFINITION-OF-DONE.md`, `docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md`, `docs/sprints/sprint-2/README.md`, `docs/sprints/sprint-2/SPRINT-BACKLOG.md`, `docs/sprints/sprint-2/SPRINT-GOAL.md`, and 3 more |
