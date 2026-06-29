# Sprint 2 Goal

Sprint 2 focuses on moving YsabelleStore from a foundation-only repository into a working authentication and backend API foundation.

## Goal Statement

Plan and deliver the work needed for real authentication, backend authentication APIs, frontend-backend authentication integration, session validation, owner and staff roles, protected routes, database seed users, Prisma user integration, and checkers-green validation.

## Sprint Overview

| Area        | Sprint 2 Focus                                                                           |
| ----------- | ---------------------------------------------------------------------------------------- |
| Frontend    | Login page planning, auth state planning, protected route behavior, API calls            |
| Backend     | Authentication API planning, middleware planning, validation, controller/service pattern |
| Database    | Seed users, Prisma user integration, password hash storage, migration validation         |
| Integration | Frontend login to backend auth endpoints, current-user/session validation                |
| Validation  | Build, lint, typecheck, Prisma, audit, regression, and documentation evidence            |

## Objectives

| Objective                         | Expected Result                                                     |
| --------------------------------- | ------------------------------------------------------------------- |
| Authentication planning           | Login, logout, session, owner/staff roles, JWT/session, middleware  |
| Backend API foundation planning   | Auth controller/service/routes, validation, responses, errors       |
| Database integration planning     | Seed users, Prisma user lookup, password hashes, migration evidence |
| Frontend-backend integration plan | Auth context, `useAuth`, API calls, protected routes, logout        |
| Checkers green planning           | Required validation is clear before Sprint 2 work closes            |

## In Scope

| Area                         | Scope                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| Authentication / Login Page  | Real login page planning and removal or replacement of mock session UI |
| Backend authentication API   | Login, logout, current-user/session endpoint planning                  |
| Frontend-backend integration | Frontend auth state connected to backend auth responses                |
| Session validation           | Current user comes from backend/database, not hardcoded frontend text  |
| Owner and Staff roles        | Role recognition and protected access planning                         |
| Protected routes             | Unauthenticated users cannot access protected areas                    |
| Database seed users          | Development owner/staff accounts planned and documented                |
| Prisma user integration      | User model access and migration validation planned                     |
| Product backend planning     | Product backend API planning after authentication foundation           |
| Inventory backend planning   | Inventory backend API planning after authentication foundation         |

## Out of Scope

| Area                           | Reason                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| SARIMA forecasting             | Forecasting belongs to a later sprint                            |
| Recommendation engine          | Recommendations depend on completed inventory and forecast flows |
| Reports                        | Reports require stable data flows from later modules             |
| Dashboard analytics            | Analytics require completed backend data and reporting scope     |
| Full product CRUD frontend     | Sprint 2 focuses on backend planning, not full frontend CRUD     |
| Full inventory CRUD frontend   | Sprint 2 focuses on backend planning, not full frontend CRUD     |
| Sales/POS final implementation | POS completion belongs to a later operational module sprint      |

## Sprint Goals

| Goal                     | Result                                                                      |
| ------------------------ | --------------------------------------------------------------------------- |
| Remove mock auth path    | Mock session UI is planned for replacement with real backend auth           |
| Establish auth contract  | Backend auth endpoints and frontend auth state have a shared contract       |
| Protect application flow | Dashboard and protected modules require authenticated session planning      |
| Prepare database auth    | Owner/staff users, password hash storage, and Prisma validation are planned |
| Prepare backend modules  | Product and inventory backend planning follows auth and validation patterns |

## Deliverables

| Deliverable                       | Owner        | Expected Outcome                                              |
| --------------------------------- | ------------ | ------------------------------------------------------------- |
| Login UI and auth state plan      | m1 - Abarado | Login page, auth context, `useAuth`, logout, protected routes |
| Backend auth API plan             | m2 - Ramos   | Auth routes, controllers, services, validators, middleware    |
| Database authentication plan      | m3 - Vito    | Seed users, Prisma user integration, migration verification   |
| Integration plan                  | m1, m2       | Frontend calls backend auth APIs and handles sessions         |
| Product backend planning          | m2           | Product API route/controller/service planning                 |
| Inventory backend planning        | m2, m3       | Inventory API route/service/data planning                     |
| Checkers-green validation package | m1, m2, m3   | Validation commands and documentation evidence are defined    |

## Expected Sprint Outcome

After Sprint 2 completes, the repository should have a real authentication path planned and implemented through approved Sprint 2 work, backend auth APIs, database-backed users, protected frontend routes, and a clean validation record. Product and inventory backend planning should be ready to move into implementation without pulling in forecasting, recommendations, reports, analytics, or final POS work.
