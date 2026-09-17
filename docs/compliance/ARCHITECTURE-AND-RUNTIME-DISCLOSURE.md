# Architecture and Runtime Disclosure

> **Baseline:** `sprint/v0.10/sprint-10`

## 1. Purpose

This document provides a production-style disclosure of the current YsabelleStore runtime topology, ownership boundaries, major APIs, data flow, reliability controls, test gates and deployment model.

## 2. Top-Level Architecture

```text
React/Vite UI
   |
   | HTTP/JSON
   v
Express/TypeScript Backend
   |           \
   | Prisma     \ JSON stdin/stdout process boundary
   v             v
MySQL        Python Forecasting Service
                 |
                 v
          pandas / NumPy / statsmodels

Electron Desktop Shell
   -> packages/hosts the built frontend
   -> integrates local application runtime
```

Repository responsibilities are separated across `frontend/`, `backend/`, `electron/`, `database/`, `forecasting-service/`, `testing/`, `deployment/`, `scripts/` and supporting documentation/tooling.

## 3. Boundary Rules

- Frontend presentation code does not directly access MySQL or Prisma.
- Database access is mediated through backend/database boundaries.
- Express routes should delegate business rules to controllers/services/domain modules rather than embedding all logic in route declarations.
- Python forecasting logic remains outside Express route handlers.
- The backend owns authorization, import validation, process timeout handling and API serialization around the forecasting process.
- Python owns series validation, bounded SARIMA fitting, fallback forecast generation and forecast metrics.
- Electron preload/IPC/main-process responsibilities remain isolated from ordinary frontend application code.

## 4. Core Runtime Services

| Runtime     | Responsibility                                                              | Current Technology                        |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------- |
| Frontend    | Storefront, internal dashboards, POS/inventory/forecast UI                  | React 19, TypeScript, Vite, Tailwind      |
| Backend     | Authentication, API, domain orchestration, validation, persistence boundary | Node.js, TypeScript, Express              |
| Database    | Persistent system source of truth                                           | MySQL through Prisma                      |
| Forecasting | Product-level monthly demand forecasts                                      | Python, pandas, NumPy, statsmodels SARIMA |
| Desktop     | Local Windows desktop shell                                                 | Electron                                  |

## 5. API Architecture

The application mounts project-authored routers for internal auth, customer auth/account, dashboard, forecasts, historical sales, health, products/POS, catalog products/categories, inventory, restock orders, sales, search and storefront.

The route registry explicitly marks some generic route groups as `implemented` and others as `planned`. The implementation registry and mounted source must be read together; planned entries are not presented as production-complete merely because a related model exists.

## 6. Health and Reliability Contract

| Endpoint                | Purpose                              |
| ----------------------- | ------------------------------------ |
| `GET /api/health`       | Aggregated health summary            |
| `GET /api/health/live`  | Process liveness                     |
| `GET /api/health/ready` | Readiness/critical dependency checks |

Current reliability work also includes canonical HTTP status behavior, sanitized server errors, request correlation IDs, structured safe logging and frontend degraded/offline/timeout states.

## 7. Forecasting Runtime

The forecasting service communicates with the backend using normalized JSON over standard input/output:

```text
Express backend
  -> normalized JSON stdin
  -> forecasting-service/app/main.py
  -> product loop / preprocessing
  -> bounded SARIMA candidates
  -> fallback where required
  -> metrics + structured JSON stdout
  -> backend persistence/delivery
```

Candidate set:

1. `SARIMA(0,1,1)(0,1,1,12)`
2. `SARIMA(1,1,0)(0,1,1,12)`
3. `SARIMA(1,0,0)(1,0,0,12)`

Selection uses the lowest finite AIC among successful candidates. Fallbacks are seasonal naive followed by moving average where needed. SARIMA predicts demand, not expiration dates.

## 8. Persistent Data Domains

MySQL/Prisma persist identity/access, catalog, barcodes, inventory/batches/movements, sales, customer orders, reviews/images, historical sales, forecast outputs, recommendations, restocking and related audit/state records.

## 9. Authentication and Security Boundaries

- OWNER/STAFF access is separated from customer identity flows.
- JWT support is present for protected internal operations.
- Trusted-device persistence supports internal authentication workflows.
- Customer authentication includes session/account and OTP/recovery/social-auth related persistence.
- Google and Meta OAuth credentials are deployment secrets.
- Production email/recovery can use Resend; Gmail SMTP is documented as development-only QA delivery.
- CORS allows configured browser origins and the packaged Electron `null` renderer origin according to environment configuration.
- Security tests cover authentication, account/recovery concurrency and rate-limit behavior, CORS, error safety and request traceability among other backend contracts.

## 10. Quality Gates

The main CI workflow uses Ubuntu with MySQL 8.0, Node 22 and Python 3.12, then executes:

1. `npm ci`
2. Python forecasting dependency installation
3. Prisma client generation and schema validation
4. Disposable CI database creation
5. Guardrail preflight
6. Prettier format check
7. ESLint
8. TypeScript typecheck
9. Guardrail tests
10. Workspace tests
11. Forecast `pytest` suite
12. Full repository build
13. Production dependency reachability/security audit
14. Version consistency check
15. Sprint/artifact status verification
16. Separate frontend/backend/electron workspace builds

## 11. Deployment Model

The current deployment foundation is Windows-focused and local/offline-first. Electron Builder targets NSIS. Current planning explicitly excludes cloud hosting, release publishing and auto-update logic from the active deployment foundation.

Expected release progression:

```text
Development
  -> Validation
  -> Build
  -> Packaging
  -> Installer
  -> Release Candidate
  -> Final Release
```

## 12. Documentation Precedence

When documentation conflicts with current behavior, use this order for implemented-state claims: current executable source/configuration/tests/schema/migrations first, current scope/architecture next, then sprint planning, with historical plans retained only as historical evidence.
