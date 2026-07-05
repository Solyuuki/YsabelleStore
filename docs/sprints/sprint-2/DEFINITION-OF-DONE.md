# Definition of Done

Sprint 2 work is complete only when authentication, remembered-account quick access, role-based access control, backend account creation protection, QA validation, documentation, and validation evidence are present.

Public registration is removed from the login page. Account creation is handled only from owner-only User Management, and staff self password change remains future work.

## Sprint 2 Completion Requirements

| Requirement                       | Done Criteria                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| Login flow complete               | Owner and staff can log in successfully                                               |
| Device recognition complete       | Remembered account quick access works safely                                          |
| Public registration removed       | Login page does not expose account setup                                              |
| Owner-only User Management exists | Owner can access Users/User Management page                                           |
| Staff blocked from Users page     | Staff cannot see or access owner-only account creation                                |
| Backend register protected        | `/api/auth/register` requires owner authentication                                    |
| API access tested                 | No-token, invalid-token, inactive-user, and staff-token register attempts are blocked |
| Owner account creation tested     | Owner-token register attempt works                                                    |
| M1 blockers assigned              | Backend/security blockers from M1 are assigned to M3                                  |
| M3 backend hardening complete     | Backend owner-only guard behavior is documented                                       |
| M2 QA checklist completed         | Auth, RBAC, quick access, and backend guard tests are documented                      |
| Validation recorded               | Format, lint, typecheck, audit, Prisma validate, and build are documented             |
| Prisma DLL lock documented        | If build fails due Windows Prisma DLL lock, it is classified as environment-only      |

## Authentication Done Criteria

| Requirement             | Done Criteria                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------- |
| Real login form         | User can enter email and password                                                       |
| Password visibility     | Password is hidden by default and can be shown/hidden with accessible labels            |
| Backend login           | Backend verifies credentials using stored password hashes                               |
| Session check           | App checks current token/session on startup and before quick access opens the dashboard |
| Loading state           | Session loading resolves to authenticated or unauthenticated state                      |
| Logout                  | User can end the authenticated desktop session without deleting remembered accounts     |
| Switch user             | Existing session clears and returns to the remembered-account chooser or auth screen    |
| No hardcoded user       | Current user is loaded from backend/session state                                       |
| Remembered accounts     | Device stores only id, name, email, role, and lastUsedAt locally                        |
| Quick access            | Remembered account metadata never bypasses token/session verification                   |
| RBAC after quick access | Owner/staff route access still applies after device recognition                         |
| Local removal           | Removing a remembered account clears only local quick-access metadata                   |

## Registration / Account Setup Done Criteria

| Requirement         | Done Criteria                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Local account setup | Authorized owner-only user management can create store users                                          |
| Fields              | Name, email, password, confirm password, and role are present                                         |
| Validation          | Email format, password length, confirm password match, and role value are validated                   |
| Backend register    | `/api/auth/register` creates users through the existing auth structure only after owner authorization |
| Password storage    | Registered passwords are stored as hashes, not plaintext                                              |
| Safe response       | Password hashes are never returned to the frontend                                                    |

## RBAC Done Criteria

| Requirement             | Done Criteria                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Authenticated user role | Frontend user object includes `OWNER` or `STAFF`                                                     |
| Protected routes        | Unauthenticated users cannot open app modules                                                        |
| Owner access            | Owner can open dashboard, POS, sales, inventory, products, reports, forecasting, and settings shells |
| Staff access            | Staff can open dashboard, POS/sales processing, and inventory monitoring shells                      |
| Staff restriction       | Staff cannot open owner-only product management, reports, forecasting, or settings shells            |
| Navigation              | Sidebar hides owner-only modules from staff where practical                                          |
| Direct URL access       | Staff direct navigation to owner-only routes shows access denied or redirects safely                 |

## Backend Security Done Criteria

| Requirement                 | Done Criteria                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Owner-only register guard   | `/api/auth/register` blocks no-token, invalid-token, staff-token, and inactive-user requests |
| Safe auth responses         | Backend returns clear `401` and `403` responses without exposing sensitive details           |
| Active owner validation     | Only active OWNER users can create accounts                                                  |
| Password hashing preserved  | New accounts continue to use secure password hashing                                         |
| Backend behavior documented | Owner-only register behavior is documented in Sprint 2 docs                                  |

## QA Done Criteria

| Requirement                          | Done Criteria                                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Owner login verified                 | Owner login is tested and recorded                                                                                    |
| Staff login verified                 | Staff login is tested and recorded                                                                                    |
| Invalid login verified               | Wrong credentials are tested and recorded                                                                             |
| Logout verified                      | Logout behavior is tested and recorded                                                                                |
| Switch user verified                 | Remembered account fallback is tested and recorded                                                                    |
| Device recognition verified          | Quick access session verification is tested and recorded                                                              |
| Owner-only Users page verified       | Owner access to `/users` is tested and recorded                                                                       |
| Staff access denied verified         | Staff access denial for `/users` is tested and recorded                                                               |
| Backend register protection verified | API behavior for no-token, invalid-token, staff-token, inactive-user, and owner-token requests is tested and recorded |
| Validation commands recorded         | Format, lint, typecheck, audit, Prisma validate, and build results are documented                                     |

## Database Done Criteria

| Requirement       | Done Criteria                                                                       |
| ----------------- | ----------------------------------------------------------------------------------- |
| User model        | Prisma user model supports email, password hash, role, and active/inactive status   |
| Seed users        | Development owner and staff accounts exist or can be created with `npm run db:seed` |
| Seed safety       | Seed credentials are documented as development-only                                 |
| Hash verification | Seed password hash exists and is not plaintext                                      |
| Prisma validation | Prisma schema validates after auth changes                                          |

## Out-of-Scope Guardrail

Sprint 2 must not claim product CRUD, final POS, inventory movement logic, SARIMA forecasting, recommendations, dashboard analytics, reports, or CSV/Excel import are implemented. Those modules remain future work after authentication, backend security, and RBAC are stable.

## Validation Done Criteria

| Check          | Command                                                      |
| -------------- | ------------------------------------------------------------ |
| Format         | `npm run format:check`                                       |
| Lint           | `npm run lint`                                               |
| Typecheck      | `npm run typecheck --workspaces`                             |
| Audit          | `npm audit --audit-level=high`                               |
| Prisma         | `npx prisma validate --schema=database/prisma/schema.prisma` |
| Build, if safe | `npm run build`                                              |
