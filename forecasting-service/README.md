# Forecasting Service

## Purpose

This service is the dedicated Python home for future demand forecasting in YsabelleStore. It exists to keep forecasting concerns separate from the Electron shell, Express backend, and database layer.

## Scope

This foundation covers service architecture, documentation, folder boundaries, and future validation expectations only. It does not implement SARIMA, preprocessing, recommendation logic, database access, or API integration.

## Responsibilities

| Area                  | Responsibility                                                         |
| --------------------- | ---------------------------------------------------------------------- |
| Demand forecasting    | Host future demand forecasting modules and their support files         |
| Validation            | Define input checks for forecast-ready data before any model runs      |
| Contracts             | Describe request and response shapes for forecasting workflows         |
| Outputs               | Define file naming and output formats for generated forecast artifacts |
| Integration readiness | Provide a stable boundary for future backend and Prisma integration    |

## Folder Map

| Folder        | Purpose                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `app/`        | Service entry boundary for the forecasting application package                  |
| `config/`     | Runtime and dependency policy documentation                                     |
| `contracts/`  | Forecast input and output contract documentation                                |
| `data/`       | Local input datasets, fixtures, or sample files used by future forecasting work |
| `docs/`       | Architecture notes and service foundation guidance                              |
| `models/`     | Future model artifacts and model-related documentation                          |
| `outputs/`    | Generated forecast artifacts and output naming conventions                      |
| `services/`   | Future service-layer orchestration responsibilities                             |
| `validators/` | Forecast input validation rules and boundary checks                             |
| `tests/`      | Future test strategy and quality gates                                          |

## Future Workflow

1. Validate incoming sales history and request metadata.
2. Prepare forecasting-ready data structures.
3. Run the selected forecast engine in the service layer.
4. Package forecast output and metadata.
5. Export results for downstream backend and reporting use.

## Future Integration

| Integration target | Planned relationship                                                                   |
| ------------------ | -------------------------------------------------------------------------------------- |
| Express backend    | Backend will submit approved forecast requests and consume exported results            |
| Prisma             | Prisma remains outside this service; database access will stay in the backend layer    |
| Electron           | Electron may surface generated forecast outputs, but it must not own forecasting logic |

## Build Philosophy

- Keep the service isolated and easy to reason about.
- Prefer small modules with a single responsibility.
- Treat forecasting output as data products, not UI state.
- Keep recommendation logic in a separate layer.
- Avoid coupling the service to transport, database, or desktop concerns.

## Validation Workflow

| Check                          | Expected outcome                           |
| ------------------------------ | ------------------------------------------ |
| `npm run lint`                 | Passes without new lint issues             |
| `npm run build`                | Passes workspace build validation          |
| `npm audit --audit-level=high` | Returns no unresolved high vulnerabilities |

## Future Implementation Notes

- All forecasting code should stay inside `forecasting-service/`.
- Contracts and validation should be finalized before any model implementation.
- Recommendation support must remain separate from demand forecasting.

## Validation Checklist

- [x] Purpose is defined
- [x] Scope is restricted to forecasting foundation work
- [x] Responsibilities are separated by concern
- [x] Future integration points are documented
- [x] Validation workflow is stated
- [x] No forecasting logic is implemented
