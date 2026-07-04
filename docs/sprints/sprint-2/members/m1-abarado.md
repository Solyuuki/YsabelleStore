# M1 - Abarado

## Role

Full Stack Auth and Quick Access Lead.

## Sprint Focus

Own the complete frontend-facing authentication flow for Sprint 2: login, remembered-account quick access, owner-only user management, auth state, API integration, route protection, switch user, logout, and frontend role-based access control.

## Assigned Scope

| Area                | Scope                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Login UI            | Real email/password login screen with password show/hide control                                           |
| Remembered accounts | Safe local metadata for device recognition and quick access                                                |
| User management     | Owner-only account creation for staff and owner access                                                     |
| Auth state          | Frontend state for loading, authenticated, unauthenticated, remembered, and error states                   |
| API integration     | Login, current-user/session, quick access verification, user management, switch user, and logout API calls |
| Route protection    | Block unauthenticated users from app modules                                                               |
| Frontend RBAC       | Restrict owner-only modules from staff users                                                               |
| Thesis alignment    | Keep Sprint 2 access rules aligned with owner/staff thesis scope                                           |

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

## Validation Responsibility

| Validation Area | Responsibility                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend        | Login UI, remembered accounts, user management, session restoration, route guard, RBAC behavior                                       |
| Integration     | Confirm frontend payloads and responses align with backend auth endpoints, quick access verification, and owner-only account creation |
| Regression      | Confirm Sprint 1 shell is not redesigned outside auth scope                                                                           |

## Risks / Notes

| Risk or Note                                       | Mitigation                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| Remembered metadata is mistaken for authentication | Keep quick access limited to safe local metadata and token/session verification |
| Public registration remains visible                | Remove public sign-up from the login page and keep account creation in Users    |
| Staff bypasses owner-only UI by direct URL         | Route-level role checks must render access denied                               |
| Backend or DB unavailable                          | Show clear auth service/database/seed messages                                  |

## Out of Scope

| Item                       | Note                                                       |
| -------------------------- | ---------------------------------------------------------- |
| Staff self password change | Future work after owner-managed account creation is stable |

## Status

| Item           | Status      |
| -------------- | ----------- |
| Sprint 2 role  | Active      |
| Implementation | In progress |
