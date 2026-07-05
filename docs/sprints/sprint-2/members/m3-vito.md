# m3 - Vito

## Role

Database and Prisma Lead.

## Sprint Focus

Prepare database support for authentication.

## Assigned Scope

| Area                    | Scope                                              |
| ----------------------- | -------------------------------------------------- |
| Prisma user integration | Plan user lookup and role/status usage             |
| Seed users              | Plan owner and staff development users             |
| Migration validation    | Plan migration and Prisma validation evidence      |
| Password hash storage   | Plan safe password hash storage                    |
| Database verification   | Plan database verification for auth readiness      |
| Product data planning   | Support product backend data planning after auth   |
| Inventory data planning | Support inventory backend data planning after auth |

## Assigned Tasks

| Task | Description                                                          |
| ---- | -------------------------------------------------------------------- |
| 1    | Plan Prisma user integration                                         |
| 2    | Plan owner/staff seed users                                          |
| 3    | Plan migration validation                                            |
| 4    | Plan password hash storage                                           |
| 5    | Plan database verification                                           |
| 6    | Support product/inventory backend data planning after authentication |

## Expected Output

| Output                                          | Description                                              |
| ----------------------------------------------- | -------------------------------------------------------- |
| Database authentication plan                    | User, role, status, and password hash plan               |
| Seed user plan                                  | Development owner/staff account plan                     |
| Prisma validation plan                          | Prisma schema and client readiness plan                  |
| Migration verification notes                    | Migration status and database verification notes         |
| Database verification notes                     | Auth database readiness checks                           |
| Product/inventory backend data planning support | Data planning assumptions after authentication readiness |

## Dependencies

| Dependency          | Reason                                           |
| ------------------- | ------------------------------------------------ |
| Existing User model | Auth planning depends on Prisma user schema      |
| Backend auth plan   | m2 service logic depends on database access plan |
| Seed policy         | Development accounts must remain non-production  |

## Validation Responsibility

| Validation Area | Responsibility                                          |
| --------------- | ------------------------------------------------------- |
| Prisma          | Prisma validation and user model readiness              |
| Seed users      | Seed account documentation and credential safety review |
| Migration       | Migration verification and database readiness notes     |

## Database Authentication Plan

| Area              | Plan                                                                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User model source | Use the existing Prisma `User` model mapped to the MySQL `users` table. No schema change is planned in this document.                                                                                                |
| User identifier   | Use the Prisma `User.id` value as the stable authenticated user identifier returned to backend auth/session logic.                                                                                                   |
| Login lookup      | Use the unique `email` field for login lookup. If username login becomes required, M2 and M3 must approve a schema/API contract update because the current model does not define a separate unique `username` field. |
| Display name      | Use `name` for human-readable user display only; do not use it as the authentication identifier unless a future unique constraint is approved.                                                                       |
| Password field    | Use `passwordHash` / `password_hash` for stored password hashes only. Plaintext passwords must never be stored in the database.                                                                                      |
| Role field        | Use `role` values `OWNER` and `STAFF` to support owner-only and staff-allowed backend behavior.                                                                                                                      |
| Status field      | Use `status` values `ACTIVE` and `INACTIVE` so backend authentication can reject inactive accounts without deleting user records.                                                                                    |
| Timestamps        | Use `createdAt` / `created_at` and `updatedAt` / `updated_at` for audit-friendly account tracking where applicable.                                                                                                  |
| Backend boundary  | Coordinate Prisma lookup assumptions with m2 service logic so auth services read only the fields needed for login, session payloads, role checks, and inactive-account checks.                                       |

## User Lookup Requirements

| Requirement          | Planning Note                                                                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credential lookup    | Backend auth should query by unique `email` and handle a missing user with a safe invalid-credentials response.                                                |
| Active account check | Backend auth should verify `status = ACTIVE` before issuing or accepting an authenticated session.                                                             |
| Password comparison  | Backend auth should compare the submitted password against `passwordHash` through the approved password verification helper, not through plaintext comparison. |
| Session user shape   | Session/current-user responses should include safe fields such as `id`, `name`, `email`, `role`, and `status`; they must not include `passwordHash`.           |
| Role checks          | Owner-only routes should require `OWNER`; staff-allowed routes can accept `OWNER` and `STAFF` where approved by M2 route/service planning.                     |

## Seed User Plan

| Seed Account      | Planned Role | Scope                                            | Safety Requirement                                        |
| ----------------- | ------------ | ------------------------------------------------ | --------------------------------------------------------- |
| Development owner | `OWNER`      | Local development and auth flow testing only     | Must use development-only credentials and hashed storage. |
| Development staff | `STAFF`      | Local development and role behavior testing only | Must use development-only credentials and hashed storage. |

Seed users are development-only fixtures. Production credentials must be configured separately for the deployed environment and must not reuse development seed emails, passwords, or seed data. Plaintext passwords must not be stored in the database; seed scripts must hash passwords before insert or update.

## Password Hash Storage Plan

| Area               | Plan                                                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storage rule       | Store passwords as hashes only in `User.passwordHash`; never persist plaintext passwords.                                                                                                                                                                |
| Hashing approach   | Use the approved project password hashing implementation. The current backend aligns with a secure `scrypt`-based hash format; bcrypt or another approved secure password hashing method may be used only if the project standard changes intentionally. |
| Login verification | Compare login input by passing the submitted password and stored hash to the password verification helper.                                                                                                                                               |
| API safety         | Auth responses, logs, errors, seed documentation, and current-user payloads must not expose password hashes or real credentials.                                                                                                                         |

## Prisma Validation Plan

| Step              | Command                     | Expected Evidence                                              |
| ----------------- | --------------------------- | -------------------------------------------------------------- |
| Schema validation | `npx prisma validate`       | Prisma schema is valid for the configured MySQL provider.      |
| Client generation | `npx prisma generate`       | Prisma client can be generated for backend auth service usage. |
| Migration status  | `npx prisma migrate status` | Local migration state is known before sprint close.            |

If the command runner requires the explicit schema path, use `--schema=database/prisma/schema.prisma`. Migration readiness should be checked against the approved local MySQL Community Server database before Sprint 2 close, or the missing runtime evidence should remain documented as a limitation.

## Database Verification Notes

| Check                   | Verification Plan                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| User table/model exists | Confirm the Prisma `User` model exists and maps to the MySQL `users` table.                                                    |
| Auth fields exist       | Confirm `id`, `name`, `email`, `passwordHash`, `role`, `status`, `createdAt`, and `updatedAt` are available for auth planning. |
| Email lookup readiness  | Confirm `email` remains unique so backend login lookup can be deterministic.                                                   |
| Role/status readiness   | Confirm `UserRole` supports `OWNER` and `STAFF`, and `UserStatus` supports `ACTIVE` and `INACTIVE`.                            |
| Seed query readiness    | Confirm development owner/staff users can be created and queried locally after seed execution.                                 |
| Hash safety             | Confirm seeded users store password hashes, not plaintext passwords.                                                           |
| M2 alignment            | Confirm M2 backend auth service logic uses the same lookup, role, status, and safe response assumptions.                       |

## Product and Inventory Data Planning Support

| Area                            | Support Note                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product backend data planning   | Continue product Prisma data access planning after authentication database readiness is validated. Product module implementation is outside this M3 documentation task.           |
| Inventory backend data planning | Continue inventory Prisma and stock data assumptions after authentication database readiness is validated. Inventory module implementation is outside this M3 documentation task. |
| M2 coordination                 | Coordinate model assumptions, service boundaries, validation needs, and auth-protected access patterns with m2 backend auth/service planning.                                     |
| Sprint boundary                 | Do not implement product or inventory modules as part of this planning update.                                                                                                    |

## Risks / Notes

| Risk or Note                           | Mitigation                                                  |
| -------------------------------------- | ----------------------------------------------------------- |
| Seed credentials treated as production | Mark seed users development-only and document overrides     |
| Migration status is unclear            | Record migration validation before sprint close             |
| Backend assumptions mismatch schema    | Coordinate product/inventory planning with m2               |
| Username login assumed without schema  | Use email lookup unless a unique username field is approved |
| Password hash exposed in API response  | Keep `passwordHash` out of session/current-user payloads    |

## Status

| Item           | Status                                |
| -------------- | ------------------------------------- |
| Sprint 2 role  | Planned                               |
| Implementation | Not started in this planning document |
