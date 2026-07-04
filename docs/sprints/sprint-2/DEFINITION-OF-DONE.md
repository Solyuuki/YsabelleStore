# Definition of Done

Sprint 2 work is complete only when authentication, remembered-account quick access, role-based access control, database seed readiness, documentation, and validation evidence are present.

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

| Requirement         | Done Criteria                                                                       |
| ------------------- | ----------------------------------------------------------------------------------- |
| Local account setup | Authorized owner/staff store users can be created                                   |
| Fields              | Name, email, password, confirm password, and role are present                       |
| Validation          | Email format, password length, confirm password match, and role value are validated |
| Backend register    | `/api/auth/register` creates users through the existing auth structure              |
| Password storage    | Registered passwords are stored as hashes, not plaintext                            |
| Safe response       | Password hashes are never returned to the frontend                                  |

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

## Database Done Criteria

| Requirement       | Done Criteria                                                                       |
| ----------------- | ----------------------------------------------------------------------------------- |
| User model        | Prisma user model supports email, password hash, role, and active/inactive status   |
| Seed users        | Development owner and staff accounts exist or can be created with `npm run db:seed` |
| Seed safety       | Seed credentials are documented as development-only                                 |
| Hash verification | Seed password hash exists and is not plaintext                                      |
| Prisma validation | Prisma schema validates after auth changes                                          |

## Out-of-Scope Guardrail

Sprint 2 must not claim product CRUD, final POS, inventory movement logic, SARIMA forecasting, recommendations, dashboard analytics, reports, or CSV/Excel import are implemented. Those modules remain future work after authentication and RBAC are stable.

## Validation Done Criteria

| Check          | Command                                                      |
| -------------- | ------------------------------------------------------------ |
| Format         | `npm run format:check`                                       |
| Lint           | `npm run lint`                                               |
| Typecheck      | `npm run typecheck --workspaces`                             |
| Audit          | `npm audit --audit-level=high`                               |
| Prisma         | `npx prisma validate --schema=database/prisma/schema.prisma` |
| Build, if safe | `npm run build`                                              |
