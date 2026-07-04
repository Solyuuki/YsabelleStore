# M1 - Abarado

## Role

Full Stack Auth Flow Lead.

## Sprint Focus

Own the complete frontend-facing authentication flow for Sprint 2: login, account setup, auth state, API integration, route protection, switch user, logout, and frontend role-based access control.

## Assigned Scope

| Area             | Scope                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| Login UI         | Real email/password login screen with password show/hide control             |
| Account setup UI | Local owner/staff user registration form                                     |
| Auth state       | Frontend state for loading, authenticated, unauthenticated, and error states |
| API integration  | Login, register, current-user/session, switch user, and logout API calls     |
| Route protection | Block unauthenticated users from app modules                                 |
| Frontend RBAC    | Restrict owner-only modules from staff users                                 |
| Thesis alignment | Keep Sprint 2 access rules aligned with owner/staff thesis scope             |

## Assigned Tasks

| Task | Description                                                                   |
| ---- | ----------------------------------------------------------------------------- |
| 1    | Replace static welcome/session screen with real auth flow                     |
| 2    | Add login form and password visibility toggle                                 |
| 3    | Add account setup form with name, email, password, confirm password, and role |
| 4    | Connect login/register/session state to backend auth API                      |
| 5    | Protect dashboard and module routes behind authenticated session              |
| 6    | Enforce owner/staff route-level RBAC in the frontend                          |
| 7    | Implement switch user and logout session clearing                             |
| 8    | Preserve Sprint 1 visual shell while removing hardcoded mock user state       |

## Validation Responsibility

| Validation Area | Responsibility                                                            |
| --------------- | ------------------------------------------------------------------------- |
| Frontend        | Login/register UI, session restoration, route guard, RBAC behavior        |
| Integration     | Confirm frontend payloads and responses align with backend auth endpoints |
| Regression      | Confirm Sprint 1 shell is not redesigned outside auth scope               |

## Risks / Notes

| Risk or Note                                      | Mitigation                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| Account setup is mistaken for public registration | Label it as local store account setup for owner/staff users only |
| Staff bypasses owner-only UI by direct URL        | Route-level role checks must render access denied                |
| Backend or DB unavailable                         | Show clear auth service/database/seed messages                   |

## Status

| Item           | Status      |
| -------------- | ----------- |
| Sprint 2 role  | Active      |
| Implementation | In progress |
