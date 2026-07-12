# M3 - Vito

## Role

Testing / QA Lead.

## Sprint Focus

Validate the Sprint 2 authentication, RBAC, backend guard, and seed behavior through repeatable QA evidence.

## Assigned Scope

| Area                       | Scope                                                                  |
| -------------------------- | ---------------------------------------------------------------------- |
| Seed verification          | Confirm owner and staff development accounts are active and usable     |
| Auth testing               | Validate login, logout, switch user, and invalid login behavior        |
| RBAC testing               | Verify owner-only Users access and staff denial behavior               |
| Device recognition testing | Confirm remembered-account quick access and token/session verification |
| Backend guard testing      | Validate register endpoint behavior after M2 hardening                 |
| Validation evidence        | Capture terminal output, screenshots, and API responses                |
| Bug reports                | Document issues with severity and reproduction steps                   |

## Assigned Tasks

| Task | Description                                                   |
| ---- | ------------------------------------------------------------- |
| 1    | Verify owner login and dashboard access                       |
| 2    | Verify staff login with limited access                        |
| 3    | Verify invalid login and logout behavior                      |
| 4    | Verify switch user and remembered-account quick access        |
| 5    | Verify owner-only Users page and staff access denied behavior |
| 6    | Validate backend register protection after M2 work            |
| 7    | Confirm seed user readiness and Prisma validation results     |
| 8    | Record bugs, evidence, and final QA notes                     |

## M3 Test Area Table

| Priority | M3 Test Area                | Description                                                                                        | Expected Evidence      |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| P0       | Owner login                 | Verify owner can log in and reach dashboard                                                        | Screenshot / test note |
| P0       | Staff login                 | Verify staff can log in with limited access                                                        | Screenshot / test note |
| P0       | Invalid login               | Verify wrong credentials show error toast                                                          | Screenshot             |
| P0       | Logout                      | Verify session clears properly                                                                     | Screenshot / test note |
| P0       | Switch user                 | Verify remembered account and login fallback behavior                                              | Screenshot             |
| P0       | Device recognition          | Verify quick access flow and device recognized toast                                               | Screenshot             |
| P0       | Owner-only Users page       | Verify owner can access `/users`                                                                   | Screenshot             |
| P0       | Staff access denied         | Verify staff cannot access `/users`                                                                | Screenshot             |
| P0       | Backend register protection | Verify no-token, invalid-token, staff-token, inactive-user, and owner-token behavior after M2 work | API result             |
| P1       | Seed verification           | Confirm owner and staff seed accounts are active and usable                                        | Terminal output        |
| P1       | Validation commands         | Run format, lint, typecheck, audit, Prisma validate, and build                                     | Terminal output        |
| P1       | Bug reporting               | List issues with severity and reproduction steps                                                   | QA report              |

## M2 Blocker Validation

After M2 completes backend auth hardening, M3 must validate that the blockers are resolved.

| Blocker Tested                 | Expected Result                                    | Evidence Required                       |
| ------------------------------ | -------------------------------------------------- | --------------------------------------- |
| No-token register request      | `401 Unauthorized`                                 | API response screenshot/terminal output |
| Invalid-token register request | `401 Unauthorized`                                 | API response screenshot/terminal output |
| Staff-token register request   | `403 Forbidden`                                    | API response screenshot/terminal output |
| Inactive-user register request | `403 Forbidden`                                    | API response screenshot/terminal output |
| Owner-token register request   | Account creation succeeds                          | API response screenshot/terminal output |
| Staff direct `/users` route    | Access Denied page                                 | UI screenshot                           |
| Owner `/users` route           | User Management page opens                         | UI screenshot                           |
| Device recognition             | Remembered account flow verifies session           | UI screenshot                           |
| Wrong password                 | Error toast appears and user remains on login page | UI screenshot                           |

## Validation Responsibility

| Validation Area   | Responsibility                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| QA                | Auth behavior, RBAC behavior, device recognition, backend guard verification, and evidence collection |
| Seed verification | Owner/staff development account readiness and role correctness                                        |
| Documentation     | Record results clearly for Sprint 2 sign-off review                                                   |

## Out of Scope

| Out of Scope                          | Reason                                |
| ------------------------------------- | ------------------------------------- |
| Main feature implementation           | M3 is QA/testing focused for Sprint 2 |
| Backend register guard implementation | Owned by M2                           |
| Frontend auth UI implementation       | Owned by M1                           |
| Product/inventory/POS modules         | Future sprint/module scope            |
| SARIMA forecasting                    | Future sprint/module scope            |

## Status

| Item           | Status    |
| -------------- | --------- |
| Sprint 2 role  | Completed |
| Implementation | Completed |

## Current Sprint Activity

| Date       | Branch                                     | Work Areas                                              | Completed / Updated Work                                                                      | Evidence                                                                                                                                                                                                                                                                                                                              | Next QA                                     |
| ---------- | ------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 2026-07-10 | m3/v0.3/feat/products-inventory-foundation | Backend<br>Database<br>Docs<br>Frontend<br>Scripts / CI | Auth UI and session UX were updated while preserving trusted-device and route-guard behavior. | backend/package.json<br>backend/README.md<br>backend/src/controllers/inventoryController.ts<br>backend/src/controllers/productController.ts<br>backend/src/controllers/productImportController.ts<br>backend/src/middleware/errorHandler.ts<br>backend/src/middleware/roleMiddleware.ts<br>backend/src/middleware/uploadMiddleware.ts | Manual QA required for auth/device/UI flow. |
