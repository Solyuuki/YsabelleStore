# Backend Foundation

The backend folder contains the Express and TypeScript foundation for YsabelleStore. It defines the application shell, route registry, response contract, environment validation, and error handling pattern that future API modules must follow.

## Purpose

| Area            | Purpose                                              | Current Scope                     |
| --------------- | ---------------------------------------------------- | --------------------------------- |
| Express app     | Hosts API middleware and route registration          | Active                            |
| API routes      | Provides health, auth, product, and inventory routes | Health, auth, products, inventory |
| Controllers     | Handles request and response coordination            | Health, auth, products, inventory |
| Services        | Coordinates business workflows and Prisma access     | Auth, products, inventory         |
| Validators      | Validates request bodies, params, and queries        | Auth, products, inventory         |
| Database access | Prisma client access boundary                        | Connected for current modules     |

## Folder Structure

```text
backend/
|-- src/
|   |-- app.ts
|   |-- server.ts
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- routes/
|   |-- services/
|   |-- types/
|   |-- utils/
|   `-- validators/
|-- .env.example
|-- package.json
`-- tsconfig.json
```

## Route Registry

| Route Group            | Status  | Purpose                                                                 |
| ---------------------- | ------- | ----------------------------------------------------------------------- |
| `GET /api/health`      | Active  | Confirms backend and environment configuration are loaded               |
| `/api/auth`            | Active  | Authentication and session workflows                                    |
| `/api/products`        | Active  | Product creation, updates, listing, status changes, and import workflow |
| `/api/inventory`       | Active  | Inventory summary, movement, lookup, and deduction routes               |
| `/api/sales`           | Planned | Future sales history APIs                                               |
| `/api/batches`         | Planned | Future batch and expiration APIs                                        |
| `/api/forecasts`       | Planned | Future forecasting APIs                                                 |
| `/api/recommendations` | Planned | Future recommendation APIs                                              |
| `/api/imports`         | Planned | Future data import APIs                                                 |
| `/api/reports`         | Planned | Future reporting APIs                                                   |

## Route-Controller-Service Pattern

```text
route
  -> controller
  -> validator
  -> service
  -> repository or Prisma client
```

| Layer       | Responsibility                                    | Foundation Rule                      |
| ----------- | ------------------------------------------------- | ------------------------------------ |
| Route       | Maps URLs and HTTP verbs to controllers           | Keep route files thin                |
| Controller  | Coordinates request input and API response output | Do not place business rules here     |
| Validator   | Validates request body, params, and query values  | Add only when a real endpoint exists |
| Service     | Owns business workflow decisions                  | Keep product/inventory logic here    |
| Data access | Uses Prisma Client calls                          | Keep database interaction isolated   |

## API Contract Reference

The canonical API contract lives in `docs/api/`. Backend implementations must follow the shared request, response, error, DTO, route, versioning, and status code standards defined there.

| Reference                       | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `docs/api/README.md`            | Central API contract entry point    |
| `docs/api/RESPONSE-STANDARD.md` | Shared success response structure   |
| `docs/api/ERROR-STANDARD.md`    | Shared error response structure     |
| `docs/api/DTO-STANDARDS.md`     | DTO naming and responsibility rules |

## Error Handling Standard

| Middleware        | Purpose                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `notFoundHandler` | Converts unknown routes into predictable JSON errors                     |
| `errorHandler`    | Centralizes final error responses and hides unexpected error details     |
| `HttpError`       | Represents expected HTTP errors with status codes and stable error codes |

## Environment Setup

Create the repository-root `.env` from `.env.example` for local development. The backend always
loads that root file so Prisma cannot accidentally resolve a workspace-specific database.

| Variable       | Required For                 | Example                                              |
| -------------- | ---------------------------- | ---------------------------------------------------- |
| `NODE_ENV`     | Runtime mode                 | `development`                                        |
| `PORT`         | Backend HTTP port            | `3001`                                               |
| `FRONTEND_URL` | Canonical frontend URL       | `http://localhost:5173`                              |
| `CORS_ORIGINS` | Explicit renderer origins    | `http://localhost:5173,http://127.0.0.1:5173,null`   |
| `DATABASE_URL` | Prisma and MySQL integration | `mysql://user:password@localhost:3306/ysabellestore` |
| `JWT_SECRET`   | Authentication signing       | `change_this_development_secret`                     |

`null` is allowed specifically for the packaged Electron `file://` renderer. Wildcard CORS is not
used. The root development owner starts exactly one backend. A second backend start on port 3001
probes `/api/health` to produce a specific error for an existing YsabelleStore service; it does not
reuse or silently replace a process owned by another development stack.

## Validation Pattern

| Validation Area | Current Standard                         |
| --------------- | ---------------------------------------- |
| Environment     | Validate with Zod in `src/config/env.ts` |
| Request body    | Zod schemas in `src/validators`          |
| Route params    | Route-specific validation helpers        |
| API responses   | Follow `docs/api/RESPONSE-STANDARD.md`   |
| Errors          | Follow `docs/api/ERROR-STANDARD.md`      |

## Future Module Roadmap

| Phase | Module                      | Entry Condition                                              |
| ----- | --------------------------- | ------------------------------------------------------------ |
| 1     | Authentication              | JWT strategy and user schema are approved                    |
| 2     | Products                    | Product schema and validation rules are approved             |
| 3     | Inventory and batches       | Inventory model and expiration rules are approved            |
| 4     | Sales and imports           | Sales schema and import validation are approved              |
| 5     | Forecasts                   | Forecasting service contract is approved                     |
| 6     | Recommendations and reports | Recommendation logic and reporting requirements are approved |

## Validation Commands

```bash
npm run lint
npm run build
npm audit --audit-level=high
```

Backend-only checks:

```bash
npm run lint --workspace backend
npm run build --workspace backend
npm run typecheck --workspace backend
```

## Product Import Workflow

The product routes now include an owner-only CSV and Excel import workflow:

- `GET /api/products/import/template`
- `POST /api/products/import/preview`
- `POST /api/products/import`

The canonical contract, validation rules, and sample files live in `docs/api/PRODUCT-IMPORT-CONTRACT.md`.

## Foundation Guardrails

- Keep route files thin and delegate business logic to services.
- Use Prisma client access only from the service layer.
- Keep product and inventory validation close to the request boundary.
- Keep not-yet-implemented route groups planned but inactive until their implementation phase.
