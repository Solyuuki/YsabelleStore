# Sprint 2 Backlog

Sprint 2 backlog items are grouped around authentication, remembered local accounts, owner-only user management, backend auth security, RBAC, QA validation, and documentation. Product, inventory, POS, forecasting, recommendations, dashboard analytics, and import features remain out of scope.

## Sprint Ownership Summary

| Member       | Role                 | Updated Scope                                                                                                                             | Status Target          |
| ------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| M1 / Abarado | Full Stack / Auth UI | Login UI, auth state, device recognition, quick access, toast notifications, RBAC UI, owner-only Users page                               | Feature implementation |
| M2 / Ramos   | Backend Security     | Protect register endpoint, owner-only backend guard, backend auth/RBAC hardening, safe API responses, backend/security blocker resolution | Security hardening     |
| M3 / Vito    | Testing / QA         | Seed verification, auth testing, RBAC testing, device recognition testing, backend guard testing, validation evidence                     | QA validation          |

## M1 - Auth UI and User Management

| Task ID       | Owner        | Priority | Description                                          | Expected Output                                                     | Status      |
| ------------- | ------------ | -------- | ---------------------------------------------------- | ------------------------------------------------------------------- | ----------- |
| YSB-S2-M1-001 | M1 / Abarado | P0       | Build login UI and login states                      | Email/password login form with loading and error handling           | In Progress |
| YSB-S2-M1-002 | M1 / Abarado | P0       | Implement remembered accounts and device recognition | Safe quick access cards using local metadata only                   | In Progress |
| YSB-S2-M1-003 | M1 / Abarado | P0       | Add toast notifications for auth flows               | Success, error, logout, access denied, and device-recognized toasts | In Progress |
| YSB-S2-M1-004 | M1 / Abarado | P0       | Enforce frontend RBAC                                | Sidebar filtering and access-denied route handling                  | In Progress |
| YSB-S2-M1-005 | M1 / Abarado | P0       | Build owner-only User Management UI                  | Name, email, password, confirm password, and role fields            | In Progress |
| YSB-S2-M1-006 | M1 / Abarado | P1       | Keep docs aligned with auth scope                    | README, backlog, DoD, and member docs stay consistent               | In Progress |

## M2 - Backend Security Hardening

| Task ID       | Owner      | Priority | Description                   | Expected Output                                   | Status  |
| ------------- | ---------- | -------- | ----------------------------- | ------------------------------------------------- | ------- |
| YSB-S2-M2-001 | M2 / Ramos | P0       | Protect register endpoint     | Public users cannot call `/api/auth/register`     | Pending |
| YSB-S2-M2-002 | M2 / Ramos | P0       | Add owner-only guard          | Only OWNER users can create accounts              | Pending |
| YSB-S2-M2-003 | M2 / Ramos | P0       | Reuse auth middleware         | Apply existing JWT/session validation pattern     | Pending |
| YSB-S2-M2-004 | M2 / Ramos | P0       | Safe error responses          | Return clear `401` and `403` responses            | Pending |
| YSB-S2-M2-005 | M2 / Ramos | P1       | Validate active owner status  | Reject inactive users and non-owner roles         | Pending |
| YSB-S2-M2-006 | M2 / Ramos | P1       | Preserve password hashing     | Keep secure password hashing for created accounts | Pending |
| YSB-S2-M2-007 | M2 / Ramos | P1       | Document backend access rules | Owner-only register behavior is documented        | Pending |

## M3 - Testing and QA

| Task ID       | Owner     | Priority | Description                        | Expected Output                                                                             | Status  |
| ------------- | --------- | -------- | ---------------------------------- | ------------------------------------------------------------------------------------------- | ------- |
| YSB-S2-M3-001 | M3 / Vito | P0       | Verify owner login                 | Owner can log in and reach dashboard                                                        | Pending |
| YSB-S2-M3-002 | M3 / Vito | P0       | Verify staff login                 | Staff can log in with limited access                                                        | Pending |
| YSB-S2-M3-003 | M3 / Vito | P0       | Verify invalid login handling      | Wrong credentials show an error toast                                                       | Pending |
| YSB-S2-M3-004 | M3 / Vito | P0       | Verify logout                      | Session clears properly                                                                     | Pending |
| YSB-S2-M3-005 | M3 / Vito | P0       | Verify switch user                 | Remembered account and login fallback behave correctly                                      | Pending |
| YSB-S2-M3-006 | M3 / Vito | P0       | Verify device recognition          | Quick access flow and device recognized toast work                                          | Pending |
| YSB-S2-M3-007 | M3 / Vito | P0       | Verify owner-only Users page       | Owner can access `/users`                                                                   | Pending |
| YSB-S2-M3-008 | M3 / Vito | P0       | Verify staff access denied         | Staff cannot access `/users`                                                                | Pending |
| YSB-S2-M3-009 | M3 / Vito | P0       | Verify backend register protection | No-token, invalid-token, staff-token, inactive-user, and owner-token behavior after M2 work | Pending |
| YSB-S2-M3-010 | M3 / Vito | P1       | Verify seed users                  | Owner and staff seed accounts are active and usable                                         | Pending |
| YSB-S2-M3-011 | M3 / Vito | P1       | Run validation commands            | Format, lint, typecheck, audit, Prisma validate, and build                                  | Pending |
| YSB-S2-M3-012 | M3 / Vito | P1       | Capture bug reports                | Issues are listed with severity and reproduction notes                                      | Pending |

## Sprint 2 Blockers and Ownership

| Blocker                                        | Affected Work                          | Severity | Owner             | Required Action                                                                    | Status                  |
| ---------------------------------------------- | -------------------------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------- | ----------------------- |
| Backend `/api/auth/register` is still public   | M1 owner-only User Management security | High     | M2 / Ramos        | Add owner-only backend guard so only authenticated OWNER users can create accounts | Pending                 |
| No-token register request must be blocked      | Backend auth security                  | High     | M2 / Ramos        | Return `401 Unauthorized` for unauthenticated register attempts                    | Pending                 |
| Invalid-token register request must be blocked | Backend auth security                  | High     | M2 / Ramos        | Return `401 Unauthorized` for invalid tokens                                       | Pending                 |
| Staff-token register request must be blocked   | Backend RBAC enforcement               | High     | M2 / Ramos        | Return `403 Forbidden` for STAFF users attempting account creation                 | Pending                 |
| Inactive-user register request must be blocked | Backend account safety                 | Medium   | M2 / Ramos        | Reject inactive users even if token exists                                         | Pending                 |
| Owner-token register request must still work   | Owner User Management flow             | High     | M2 / Ramos        | Allow active OWNER users to create accounts through `/api/auth/register`           | Pending                 |
| M1 UI needs backend confirmation               | User Management end-to-end validation  | Medium   | M2 then M3        | M2 protects endpoint, then M3 verifies owner/staff/no-token behavior               | Pending                 |
| Prisma DLL lock during build                   | Local Windows validation               | Low      | All / Environment | Close Node/Electron processes, regenerate Prisma client, rerun build               | Known environment issue |

## Validation

| Task ID        | Owner      | Priority | Description                   | Expected Output                                   | Status      |
| -------------- | ---------- | -------- | ----------------------------- | ------------------------------------------------- | ----------- |
| YSB-S2-VAL-001 | M1, M2, M3 | High     | Run required validation gates | Format, lint, typecheck, audit, Prisma validation | In Progress |
| YSB-S2-VAL-002 | M1, M2, M3 | Medium   | Run build when safe           | Full workspace build validation                   | Pending     |

## Ownership Note

M1 already moved account creation to the owner-only User Management UI, but complete security requires M2 backend enforcement. M1 should not be responsible for fixing backend register protection unless explicitly reassigned. M2 owns backend auth hardening, and M3 validates the final behavior through API and UI tests.
