# M2 - Solo

## Role

Backend Auth Core Lead.

## Sprint Focus

Implement and maintain the backend authentication foundation used by the Sprint 2 frontend flow.

## Assigned Scope

| Area             | Scope                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| Auth routes      | `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, and logout/session-related route      |
| Controller logic | Safe request handling for login, registration, current user, and logout                        |
| Auth service     | Password verification, safe user response, token/session generation                            |
| Validation       | Zod validation for login and registration payloads                                             |
| Middleware       | Token/session middleware for protected backend APIs                                            |
| Error handling   | Clear standardized auth errors for invalid credentials, missing accounts, and invalid sessions |

## Assigned Tasks

| Task | Description                                                   |
| ---- | ------------------------------------------------------------- |
| 1    | Implement auth controller/service/route structure             |
| 2    | Validate login and registration requests                      |
| 3    | Use secure password hashing and verification                  |
| 4    | Return safe user data without password hashes                 |
| 5    | Provide auth middleware for future protected APIs             |
| 6    | Keep backend responses consistent with frontend auth handling |

## Validation Responsibility

| Validation Area | Responsibility                                           |
| --------------- | -------------------------------------------------------- |
| Backend         | Auth API, middleware, validation, and error smoke review |
| API contract    | Standardized response and error behavior review          |
| Security        | Confirm password hashes are never exposed                |

## Status

| Item           | Status      |
| -------------- | ----------- |
| Sprint 2 role  | Active      |
| Implementation | In progress |
