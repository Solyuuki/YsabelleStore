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

| Variable                | Purpose                        | Layer                       |
| ----------------------- | ------------------------------ | --------------------------- |
| `NODE_ENV`              | Runtime mode                   | Backend, frontend, Electron |
| `PORT`                  | Service port                   | Backend                     |
| `DATABASE_URL`          | Prisma/MySQL connection string | Backend, database           |
| `JWT_SECRET`            | Token signing secret           | Backend                     |
| `VITE_API_URL`          | Frontend API endpoint          | Frontend                    |
| `ELECTRON_RENDERER_URL` | Electron renderer URL          | Electron                    |
| `PYTHON_PATH`           | Python executable path         | Forecasting service         |

## Layer Example Files

| File                    | Role                                  |
| ----------------------- | ------------------------------------- |
| `frontend/.env.example` | Frontend Vite environment template    |
| `backend/.env.example`  | Backend runtime environment template  |
| `database/.env.example` | Database connection template          |
| `electron/.env.example` | Electron runtime environment template |

## Decision Matrix

| Rule                     | Development | Testing  | Production |
| ------------------------ | ----------- | -------- | ---------- |
| Secrets committed        | Never       | Never    | Never      |
| Example files committed  | Yes         | Yes      | Yes        |
| Runtime validation       | Required    | Required | Required   |
| Real credentials in docs | Never       | Never    | Never      |

## Future Implementation Notes

- Keep variable names uppercase and descriptive.
- Keep example values safe and local.
- Update the matching `.env.example` when a variable becomes required.

## Validation Checklist

- [x] Development, testing, and production are separated
- [x] Documented variables are listed
- [x] Example file ownership is clear
- [x] No secrets are exposed
