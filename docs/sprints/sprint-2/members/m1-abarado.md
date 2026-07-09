# M1 - Abarado

## Role

Full Stack / Auth UI Lead.

## Sprint Focus

Own the user-facing authentication flow for Sprint 2: login, remembered-account quick access, owner-only user management, auth state, toast notifications, route protection, switch user, logout, and frontend role-based access control.

## Assigned Scope

| Area                | Scope                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Login UI            | Real email/password login screen with password show/hide control                         |
| Device recognition  | Safe local metadata for remembered accounts and quick access                             |
| Toast notifications | Auth success, error, logout, access denied, and device-recognized toasts                 |
| Auth state          | Frontend state for loading, authenticated, unauthenticated, remembered, and error states |
| RBAC UI             | Sidebar filtering and direct-route access denied handling                                |
| User management     | Owner-only Users page and account creation form                                          |
| Session actions     | Switch user and logout session clearing                                                  |
| Thesis alignment    | Keep Sprint 2 access rules aligned with owner/staff scope                                |

## Assigned Tasks

| Task | Description                                                                |
| ---- | -------------------------------------------------------------------------- |
| 1    | Replace static welcome/session screen with remembered-account quick access |
| 2    | Add login form and password visibility toggle                              |
| 3    | Move account creation into owner-only User Management                      |
| 4    | Add remembered local accounts and safe session verification                |
| 5    | Protect dashboard and module routes behind authenticated session           |
| 6    | Enforce owner/staff route-level RBAC in the frontend                       |
| 7    | Implement switch user and logout session clearing                          |
| 8    | Preserve Sprint 1 visual shell while removing hardcoded mock user state    |

## M1 Responsibility Table

| Area                | M1 Responsibility                                                    | Status                    |
| ------------------- | -------------------------------------------------------------------- | ------------------------- |
| Login UI            | Login form, loading states, error handling                           | Implemented / In Progress |
| Device Recognition  | Remembered accounts and quick access UI                              | Implemented / In Progress |
| Toast Notifications | Auth success, error, logout, access denied, device recognized toasts | Implemented / In Progress |
| RBAC UI             | Sidebar filtering and access-denied flow                             | Implemented / In Progress |
| User Management UI  | Owner-only Users page and account creation form                      | Implemented / In Progress |

M1 owns the user-facing authentication flow and owner-only User Management UI. Backend/security blockers discovered from M1 work, such as the public register endpoint, are assigned to M2 because they require server-side enforcement. M1 may handle UI fixes found by M3 during QA.

## Validation Responsibility

| Validation Area | Responsibility                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend        | Login UI, remembered accounts, user management, session restoration, route guard, RBAC behavior                                       |
| Integration     | Confirm frontend payloads and responses align with backend auth endpoints, quick access verification, and owner-only account creation |
| Regression      | Confirm Sprint 1 shell is not redesigned outside auth scope                                                                           |

## Out of Scope

| Item                                  | Owner                      | Reason                                                |
| ------------------------------------- | -------------------------- | ----------------------------------------------------- |
| Backend register endpoint guard       | M2 / Ramos                 | Requires backend auth middleware and server-side RBAC |
| API-level account creation protection | M2 / Ramos                 | Frontend RBAC is not enough for security              |
| Full QA validation                    | M3 / Vito                  | M3 owns test evidence and validation                  |
| Product/inventory/POS modules         | Future sprint/module scope | Not part of Sprint 2 auth ownership                   |
| SARIMA forecasting                    | Future sprint/module scope | Not part of Sprint 2 auth ownership                   |

## Status

| Item          | Status                             |
| ------------- | ---------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ----------------------------- | -------------------------- |
| Sprint 2 role | Co                                 | Date                            | Branch                                                                                        | Work Areas                                                                                                                                                                                                                                                                                 | Completed / Updated Work                     | Evidence                      | Next QA                    |
| ---           | ---                                | ---                             | ---                                                                                           | ---                                                                                                                                                                                                                                                                                        | ---                                          |
| 2026-07-07    | m1/v0.2/feat/auth-fullstack-flow   | Backend<br>Docs<br>Scripts / CI | Sprint documentation and validation evidence were updated for the current branch.             | backend/package.json                                                                                                                                                                                                                                                                       | Review backend/database validation evidence. |
| 2026-07-08    | m1/v0.2/feat/auth-fullstack-flow   | Docs                            | Sprint 2 closure documentation was finalized and the app version was aligned to `v0.2.0`.     | docs/sprints/sprint-2/README.md<br>docs/sprints/sprint-2/SPRINT-GOAL.md<br>docs/sprints/sprint-2/SPRINT-BACKLOG.md<br>docs/sprints/sprint-2/DEFINITION-OF-DONE.md<br>frontend/src/config/appVersion.ts<br>frontend/src/pages/WelcomePage.tsx<br>frontend/src/components/app/AppSidebar.tsx | Review final closure docs.                   |
| 2026-07-09    | m1/v0.3/feat/pos-sales-integration | Backend<br>Docs<br>Frontend     | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior. | backend/src/controllers/searchController.ts<br>backend/src/routes/index.ts<br>backend/src/routes/search.routes.ts<br>backend/src/services/searchService.ts<br>backend/src/types/search.ts<br>backend/src/validators/search.validators.ts                                                   | Manual QA required for auth/device/UI flow.  | components/app/AppSidebar.tsx | Review final closure docs. |

## Current Sprint Activity

| Date       | Branch                             | Work Areas       | Completed / Updated Work                                                                      | Evidence                                    | Next QA                                     |
| ---------- | ---------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 2026-07-09 | m1/v0.3/feat/pos-sales-integration | Docs<br>Frontend | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior. | docs/sprints/sprint-2/DEFINITION-OF-DONE.md | Manual QA required for auth/device/UI flow. |
