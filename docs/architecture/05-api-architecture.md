# API Architecture

This document defines the planned Express.js API structure for YsabelleStore. The API must support the local desktop application, database operations, forecasting requests, imports, reports, and recommendation workflows.

## Planned Route Groups

| Route Group            | Purpose                                                           | Owner Layer           |
| ---------------------- | ----------------------------------------------------------------- | --------------------- |
| `/api/auth`            | Login, session validation, JWT issuance, and user identity        | Backend               |
| `/api/products`        | Product creation, updates, listing, filtering, and status changes | Backend               |
| `/api/sales`           | Sales recording, sales history, and sales data for forecasting    | Backend               |
| `/api/inventory`       | Current stock monitoring and inventory summaries                  | Backend               |
| `/api/batches`         | Batch inventory, expiration dates, and remaining quantities       | Backend               |
| `/api/forecasts`       | Forecast generation requests and stored forecast retrieval        | Backend + Forecasting |
| `/api/recommendations` | Restock and risk recommendation outputs                           | Backend + Forecasting |
| `/api/imports`         | CSV and Excel import validation and processing                    | Backend               |
| `/api/reports`         | Dashboard and thesis reporting summaries                          | Backend               |

## Express Layer Structure

```text
backend/
  src/
    routes/
    controllers/
    services/
    validators/
    middleware/
```

## Responsibility Rules

| Layer       | Responsibility                                    | Not Allowed                                |
| ----------- | ------------------------------------------------- | ------------------------------------------ |
| Routes      | Define endpoint paths and attach middleware       | Business logic directly inside route files |
| Controllers | Translate HTTP requests into service calls        | Database schema decisions                  |
| Services    | Execute business rules and coordinate data access | Raw UI formatting logic                    |
| Validators  | Validate request body, params, query, and imports | Silent acceptance of invalid data          |
| Middleware  | Authentication, error handling, request logging   | Feature-specific business rules            |

## API Response Standard

| Response Type    | Expected Shape                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Success          | `{ "success": true, "data": {}, "message": "Action completed" }`                                           |
| Validation Error | `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": [] } }` |
| Server Error     | `{ "success": false, "error": { "code": "SERVER_ERROR", "message": "Unexpected server error" } }`          |

## Good vs Bad API Design

| Good                                                                  | Bad                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------- |
| `/api/products` delegates to product controller and service           | Product route directly writes all Prisma queries inline  |
| `/api/forecasts` validates request before calling forecasting service | Forecast endpoint runs Python with unchecked inputs      |
| `/api/imports` returns row-level validation errors                    | Import endpoint silently skips bad rows                  |
| `/api/recommendations` returns reasons and severity                   | Recommendation endpoint returns unexplained alert labels |

## API Validation Checklist

- [ ] Business logic is not placed directly in route files
- [ ] Every input path has validation
- [ ] API responses are predictable
- [ ] Forecasting calls are isolated behind a service boundary
- [ ] Authentication requirements are clear for protected routes
