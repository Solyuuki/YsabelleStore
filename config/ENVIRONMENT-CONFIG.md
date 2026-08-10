# Environment Configuration

## Purpose

This document defines the repository environment strategy for development, testing, and production.

## Scope

- Environment variable categories
- Layer-specific variable ownership
- Example-only documentation
- Validation expectations

## Environment Strategy

| Environment | Purpose                       | Notes                                        |
| ----------- | ----------------------------- | -------------------------------------------- |
| Development | Local developer setup         | Uses safe example values and local services  |
| Testing     | Automated and local test runs | Uses test-safe values and isolated resources |
| Production  | Release-ready runtime         | Uses validated, non-secret production values |

## Documented Variables

| Variable                    | Purpose                                   | Layer                         |
| --------------------------- | ----------------------------------------- | ----------------------------- |
| `NODE_ENV`                  | Runtime mode                              | Backend                       |
| `PORT`                      | Service port                              | Backend                       |
| `FRONTEND_URL`              | Canonical browser development URL         | Development orchestration     |
| `VITE_API_BASE_URL`         | Public shared backend endpoint            | Browser and Electron renderer |
| `CORS_ORIGINS`              | Comma-separated renderer origin allowlist | Backend                       |
| `DATABASE_URL`              | Prisma/MySQL connection string            | Backend, database             |
| `JWT_SECRET`                | Token signing secret                      | Backend                       |
| `ELECTRON_RENDERER_DEV_URL` | Optional Electron renderer override       | Electron                      |
| `PYTHON_EXECUTABLE`         | Python executable path                    | Backend forecasting runner    |

## Layer Example Files

| File                    | Role                                                       |
| ----------------------- | ---------------------------------------------------------- |
| `.env.example`          | Canonical template for backend, frontend, and Electron dev |
| `frontend/.env.example` | Pointer to the root template; not a second configuration   |
| `backend/.env.example`  | Pointer to the root template; not a second configuration   |
| `electron/.env.example` | Optional standalone Electron override example              |

Vite loads environment values from the repository root and exposes only `VITE_*` values to the
renderer bundle. `DATABASE_URL`, `JWT_SECRET`, and other backend-only variables remain server-side.
The Electron renderer is the same frontend bundle, so it resolves the same API base and never
connects to Prisma directly.

The local CORS allowlist contains the canonical `localhost` renderer, the supported `127.0.0.1`
loopback spelling, and the packaged Electron `file://` origin (`null`). It is an explicit allowlist,
not wildcard CORS.

The repository-root `scripts/dev.mjs` is the single development process owner. It derives the Web
and backend ports from `FRONTEND_URL`, `VITE_API_BASE_URL`, and `PORT`, validates that the backend
URL and port agree, performs readiness checks, and passes the resolved renderer URL to Electron.
`npm run dev:web` invokes the same owner in web-only mode rather than nesting another dev command.

## Decision Matrix

| Rule                     | Development | Testing  | Production |
| ------------------------ | ----------- | -------- | ---------- |
| Secrets committed        | Never       | Never    | Never      |
| Example files committed  | Yes         | Yes      | Yes        |
| Runtime validation       | Required    | Required | Required   |
| Real credentials in docs | Never       | Never    | Never      |

## Runtime Audit

Run `npm run runtime:report` to print the resolved browser URL, Electron renderer URL, shared API
base, CORS origins, sanitized database provider/target, and live backend health. The command never
prints database credentials or signing secrets.

## Validation Checklist

- [x] Development, testing, and production are separated
- [x] Documented variables are listed
- [x] Example file ownership is clear
- [x] No secrets are exposed
