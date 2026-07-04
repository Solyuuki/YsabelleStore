# Sprint 2 Backlog

Sprint 2 backlog items are grouped around authentication, remembered local accounts, owner-only user management, RBAC, seed users, and validation. Product, inventory, POS, forecasting, recommendations, dashboard analytics, and import features are intentionally out of scope.

## Authentication and Session Flow

| Task ID         | Owner        | Priority | Description                                 | Expected Output                                                                 | Status      |
| --------------- | ------------ | -------- | ------------------------------------------- | ------------------------------------------------------------------------------- | ----------- |
| YSB-S2-AUTH-001 | M1 - Abarado | High     | Replace static welcome/session screen       | Recognized-device welcome screen with quick access                              | In Progress |
| YSB-S2-AUTH-002 | M1 - Abarado | High     | Add password visibility toggle              | Accessible show/hide password button                                            | In Progress |
| YSB-S2-AUTH-003 | M1 - Abarado | High     | Add frontend auth state                     | Loading, authenticated, unauthenticated, remembered-account, and error states   | In Progress |
| YSB-S2-AUTH-004 | M1 - Abarado | High     | Wire login, switch user, and logout         | Token/session is stored and cleared correctly; quick access is verified locally | In Progress |
| YSB-S2-AUTH-005 | M2 - Solo    | High     | Implement backend login/current-user/logout | Backend auth endpoints and safe responses                                       | In Progress |

## Registration / Account Setup

| Task ID        | Owner        | Priority | Description                         | Expected Output                                                                   | Status      |
| -------------- | ------------ | -------- | ----------------------------------- | --------------------------------------------------------------------------------- | ----------- |
| YSB-S2-REG-001 | M1 - Abarado | High     | Build owner-only User Management UI | Name, email, password, confirm password, role selection                           | In Progress |
| YSB-S2-REG-002 | M2 - Solo    | High     | Implement `/api/auth/register`      | Hashed local owner/staff account creation                                         | In Progress |
| YSB-S2-REG-003 | M1, M2       | High     | Connect User Management to backend  | Successful registration preserves the owner session and creates a managed account | In Progress |

## Role-Based Access Control

| Task ID         | Owner        | Priority | Description                                    | Expected Output                                           | Status      |
| --------------- | ------------ | -------- | ---------------------------------------------- | --------------------------------------------------------- | ----------- |
| YSB-S2-RBAC-001 | M1 - Abarado | High     | Add route-level role metadata                  | Owner/staff access rules are centralized                  | In Progress |
| YSB-S2-RBAC-002 | M1 - Abarado | High     | Filter navigation by role                      | Staff users do not see owner-only modules where practical | In Progress |
| YSB-S2-RBAC-003 | M1 - Abarado | High     | Block direct owner-only route access for staff | Access denied page or redirect                            | In Progress |

## Database and Seed Users

| Task ID       | Owner      | Priority | Description                        | Expected Output                                       | Status      |
| ------------- | ---------- | -------- | ---------------------------------- | ----------------------------------------------------- | ----------- |
| YSB-S2-DB-001 | M3 - James | High     | Verify Prisma User model           | User supports login, role, status, and password hash  | In Progress |
| YSB-S2-DB-002 | M3 - James | High     | Add owner and staff dev seed users | Local test accounts with hashed passwords             | In Progress |
| YSB-S2-DB-003 | M3 - James | High     | Verify seed user state             | Owner/staff exist, active, role-correct, hash present | In Progress |

## Documentation and Thesis Alignment

| Task ID        | Owner        | Priority | Description                     | Expected Output                                                                                                        | Status      |
| -------------- | ------------ | -------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------- |
| YSB-S2-DOC-001 | M1 - Abarado | Medium   | Align Sprint 2 docs             | Auth, remembered accounts, owner-only user management, quick access, RBAC, and owner/staff responsibilities documented | In Progress |
| YSB-S2-DOC-002 | M1 - Abarado | Medium   | Add thesis scope alignment note | Chapter 1-2 scope mapped to implementation roadmap                                                                     | In Progress |

## Validation

| Task ID        | Owner      | Priority | Description                   | Expected Output                                   | Status      |
| -------------- | ---------- | -------- | ----------------------------- | ------------------------------------------------- | ----------- |
| YSB-S2-VAL-001 | M1, M2, M3 | High     | Run required validation gates | Format, lint, typecheck, audit, Prisma validation | In Progress |
| YSB-S2-VAL-002 | M1, M2, M3 | Medium   | Run build when safe           | Full workspace build validation                   | Pending     |
