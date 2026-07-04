# M3 - James

## Role

Database Seed/User Foundation Lead.

## Sprint Focus

Prepare and verify the Prisma user foundation needed for owner/staff authentication and role-based access.

## Assigned Scope

| Area                       | Scope                                                                            |
| -------------------------- | -------------------------------------------------------------------------------- |
| Prisma user integration    | Verify user lookup, role, status, and password hash support                      |
| Seed users                 | Maintain development owner and staff accounts                                    |
| Password hash seed support | Ensure seeded users store hashed passwords, not plaintext                        |
| Database verification      | Confirm seed user existence, active status, role correctness, and hash readiness |
| Migration validation       | Confirm Prisma schema remains valid after auth work                              |
| Seed documentation         | Document safe development-only credentials and seed workflow                     |

## Assigned Tasks

| Task | Description                                                             |
| ---- | ----------------------------------------------------------------------- |
| 1    | Verify the `User` model supports login, role, status, and password hash |
| 2    | Add or maintain owner/staff development seed users                      |
| 3    | Ensure seeded passwords are hashed                                      |
| 4    | Verify owner/staff records without exposing password hashes             |
| 5    | Run Prisma validation after authentication changes                      |
| 6    | Keep seed documentation development-only and non-production             |

## Validation Responsibility

| Validation Area | Responsibility                                                |
| --------------- | ------------------------------------------------------------- |
| Prisma          | Prisma validation and user model readiness                    |
| Seed users      | Owner/staff development accounts and credential safety review |
| Database        | Verify roles, statuses, and password hash existence           |

## Risks / Notes

| Risk or Note                           | Mitigation                                                   |
| -------------------------------------- | ------------------------------------------------------------ |
| Seed credentials treated as production | Mark accounts as development-only                            |
| JWT secret missing locally             | Document environment requirement without exposing values     |
| Database unavailable                   | Treat auth integration as blocked until local MySQL is ready |

## Status

| Item           | Status      |
| -------------- | ----------- |
| Sprint 2 role  | Active      |
| Implementation | In progress |
