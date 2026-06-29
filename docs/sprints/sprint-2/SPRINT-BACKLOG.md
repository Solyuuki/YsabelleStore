# Sprint 2 Backlog

Sprint 2 backlog items are grouped by module. This is planning only and does not implement the listed items.

## Authentication

| Task ID         | Owner        | Priority | Description                                            | Expected Output                                       | Status  |
| --------------- | ------------ | -------- | ------------------------------------------------------ | ----------------------------------------------------- | ------- |
| YSB-S2-AUTH-001 | m1 - Abarado | High     | Plan real Login Page integration                       | Login UI plan with loading, validation, and errors    | Planned |
| YSB-S2-AUTH-002 | m2 - Ramos   | High     | Plan backend login, logout, and current-user endpoints | Backend auth endpoint plan                            | Planned |
| YSB-S2-AUTH-003 | m2 - Ramos   | High     | Plan authentication and role middleware                | Middleware plan for authenticated and role-gated APIs | Planned |
| YSB-S2-AUTH-004 | m1 - Abarado | High     | Plan mock session UI removal or replacement            | Mock-auth replacement plan                            | Planned |

## Backend API Foundation

| Task ID       | Owner      | Priority | Description                                         | Expected Output                              | Status  |
| ------------- | ---------- | -------- | --------------------------------------------------- | -------------------------------------------- | ------- |
| YSB-S2-BE-001 | m2 - Ramos | High     | Plan auth controller/service/route structure        | Controller/service/route pattern plan        | Planned |
| YSB-S2-BE-002 | m2 - Ramos | High     | Plan reusable request validation                    | Validation plan for auth, product, inventory | Planned |
| YSB-S2-BE-003 | m2 - Ramos | Medium   | Plan standardized API response and error handling   | Response and error handling readiness notes  | Planned |
| YSB-S2-BE-004 | m2 - Ramos | Medium   | Plan backend middleware usage across protected APIs | Middleware usage notes                       | Planned |

## Database and Seed Users

| Task ID       | Owner     | Priority | Description                              | Expected Output                             | Status  |
| ------------- | --------- | -------- | ---------------------------------------- | ------------------------------------------- | ------- |
| YSB-S2-DB-001 | m3 - Vito | High     | Plan Prisma user integration             | Prisma user lookup and persistence plan     | Planned |
| YSB-S2-DB-002 | m3 - Vito | High     | Plan owner and staff seed users          | Development seed user plan                  | Planned |
| YSB-S2-DB-003 | m3 - Vito | High     | Plan password hash storage               | Password hash storage and safety notes      | Planned |
| YSB-S2-DB-004 | m3 - Vito | Medium   | Plan migration and database verification | Migration validation and verification notes | Planned |

## Frontend-Backend Integration

| Task ID        | Owner        | Priority | Description                                      | Expected Output                                | Status  |
| -------------- | ------------ | -------- | ------------------------------------------------ | ---------------------------------------------- | ------- |
| YSB-S2-INT-001 | m1 - Abarado | High     | Plan Auth Context and `useAuth`                  | Auth state plan                                | Planned |
| YSB-S2-INT-002 | m1 - Abarado | High     | Plan frontend calls to backend auth APIs         | Login/logout/session API integration plan      | Planned |
| YSB-S2-INT-003 | m1 - Abarado | High     | Plan protected route behavior                    | Protected route and role-aware access plan     | Planned |
| YSB-S2-INT-004 | m1, m2       | High     | Plan end-to-end authentication flow verification | Frontend-backend integration verification plan | Planned |

## Product Backend Planning

| Task ID         | Owner      | Priority | Description                                      | Expected Output                    | Status  |
| --------------- | ---------- | -------- | ------------------------------------------------ | ---------------------------------- | ------- |
| YSB-S2-PROD-001 | m2 - Ramos | Medium   | Plan product API route structure                 | Product route planning notes       | Planned |
| YSB-S2-PROD-002 | m2 - Ramos | Medium   | Plan product controller, service, and validation | Product backend pattern plan       | Planned |
| YSB-S2-PROD-003 | m2, m3     | Medium   | Plan product Prisma data access assumptions      | Product database integration notes | Planned |

## Inventory Backend Planning

| Task ID        | Owner      | Priority | Description                                        | Expected Output                      | Status  |
| -------------- | ---------- | -------- | -------------------------------------------------- | ------------------------------------ | ------- |
| YSB-S2-INV-001 | m2 - Ramos | Medium   | Plan inventory API route structure                 | Inventory route planning notes       | Planned |
| YSB-S2-INV-002 | m2 - Ramos | Medium   | Plan inventory controller, service, and validation | Inventory backend pattern plan       | Planned |
| YSB-S2-INV-003 | m2, m3     | Medium   | Plan inventory Prisma and stock data assumptions   | Inventory database integration notes | Planned |

## Validation / Checkers Green

| Task ID        | Owner        | Priority | Description                                  | Expected Output                                  | Status  |
| -------------- | ------------ | -------- | -------------------------------------------- | ------------------------------------------------ | ------- |
| YSB-S2-VAL-001 | m1, m2, m3   | High     | Plan full validation command set             | Build, lint, typecheck, Prisma, audit checklist  | Planned |
| YSB-S2-VAL-002 | m1, m2, m3   | High     | Plan authentication flow verification        | Login, logout, session, protected route evidence | Planned |
| YSB-S2-VAL-003 | m1 - Abarado | Medium   | Plan regression review for Sprint 1 UI shell | No unrelated UI regression notes                 | Planned |
| YSB-S2-VAL-004 | m1, m2, m3   | Medium   | Plan documentation update requirements       | Sprint 2 evidence and artifact checklist         | Planned |
