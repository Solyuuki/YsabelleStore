# Backend Foundation

The backend folder contains the Express and TypeScript foundation for YsabelleStore. It defines the application shell, route registry, response contract, environment validation, and error handling pattern that future API modules must follow.

## Purpose

| Area            | Purpose                                                | Current Scope     |
| --------------- | ------------------------------------------------------ | ----------------- |
| Express app     | Hosts API middleware and route registration            | Active            |
| API routes      | Provides `/api/health` and planned future route groups | Health only       |
| Controllers     | Handles request and response coordination              | Health only       |
| Services        | Reserved for future business workflows                 | No implementation |
| Validators      | Reserved for future request validation schemas         | No implementation |
| Database access | Reserved for future Prisma integration                 | Not connected     |

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

| Route Group            | Status  | Purpose                                                   |
| ---------------------- | ------- | --------------------------------------------------------- |
| `GET /api/health`      | Active  | Confirms backend and environment configuration are loaded |
| `/api/auth`            | Planned | Future authentication and session workflows               |
| `/api/products`        | Planned | Future product management APIs                            |
| `/api/sales`           | Planned | Future sales history APIs                                 |
| `/api/inventory`       | Planned | Future inventory summary APIs                             |
| `/api/batches`         | Planned | Future batch and expiration APIs                          |
| `/api/forecasts`       | Planned | Future forecasting APIs                                   |
| `/api/recommendations` | Planned | Future recommendation APIs                                |
| `/api/imports`         | Planned | Future data import APIs                                   |
| `/api/reports`         | Planned | Future reporting APIs                                     |

## Route-Controller-Service Pattern

```text
route
  -> controller
  -> validator
  -> service
  -> repository or Prisma client
```

| Layer       | Responsibility                                    | Foundation Rule                       |
| ----------- | ------------------------------------------------- | ------------------------------------- |
| Route       | Maps URLs and HTTP verbs to controllers           | Keep route files thin                 |
| Controller  | Coordinates request input and API response output | Do not place business rules here      |
| Validator   | Validates request body, params, and query values  | Add only when a real endpoint exists  |
| Service     | Owns business workflow decisions                  | No service logic in this phase        |
| Data access | Uses future Prisma Client calls                   | No database integration in this phase |

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

Create `backend/.env` from `backend/.env.example` for local development.

| Variable       | Required For                        | Example                                              |
| -------------- | ----------------------------------- | ---------------------------------------------------- |
| `NODE_ENV`     | Runtime mode                        | `development`                                        |
| `PORT`         | Backend HTTP port                   | `3001`                                               |
| `CORS_ORIGIN`  | Frontend development origin         | `http://localhost:5173`                              |
| `DATABASE_URL` | Future Prisma and MySQL integration | `mysql://user:password@localhost:3306/ysabellestore` |
| `JWT_SECRET`   | Future authentication signing       | `change_this_development_secret`                     |

## Validation Pattern

| Validation Area | Current Standard                           |
| --------------- | ------------------------------------------ |
| Environment     | Validate with Zod in `src/config/env.ts`   |
| Request body    | Future Zod schemas in `src/validators`     |
| Route params    | Future route-specific validator middleware |
| API responses   | Follow `docs/api/RESPONSE-STANDARD.md`     |
| Errors          | Follow `docs/api/ERROR-STANDARD.md`        |

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

## Foundation Guardrails

- Do not implement business endpoints during foundation work.
- Do not add Prisma queries until database integration is approved.
- Do not hardcode secrets or database URLs in source files.
- Keep routes, controllers, services, validators, and utilities separated.
- Keep future route groups planned but inactive until their implementation phase.
