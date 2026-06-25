# API Contract Foundation

## Purpose

This folder defines the official API contract standard for YsabelleStore. It gives the frontend, backend, forecasting service, Prisma layer, and database work a shared communication model without implementing endpoints.

## Scope

- Request format
- Response format
- Error format
- DTO naming and responsibilities
- Route naming and versioning
- Forecasting communication contract
- Status code usage

## Responsibilities

| Area                 | Responsibility                                          |
| -------------------- | ------------------------------------------------------- |
| Request standard     | Define how inputs should be shaped and validated        |
| Response standard    | Define the shared success response structure            |
| Error standard       | Define consistent failure payloads                      |
| DTO standard         | Define future data transfer object naming and ownership |
| Route naming         | Define REST path conventions and versioning             |
| Forecasting contract | Define backend-to-forecast-service communication        |

## Architecture

```text
React
  -> Express API
  -> Forecasting Service
  -> Prisma
  -> MySQL
```

## Communication Flow

| Flow                           | Contract Type                                     |
| ------------------------------ | ------------------------------------------------- |
| React to Express               | Request and response standards                    |
| Express to Forecasting Service | Forecasting contract                              |
| Express to Prisma              | DTO and validation discipline                     |
| Prisma to MySQL                | Schema and persistence layer, not an API contract |

## Layer Boundaries

- React should consume documented API responses only.
- Express should expose versioned REST endpoints.
- Forecasting communication should use explicit request and response payloads.
- Prisma and MySQL remain behind backend implementation boundaries.

## Future Maintainability

- Keep one contract source for all endpoint groups.
- Update docs before endpoint behavior changes.
- Keep versioning and error semantics stable across modules.

## Validation Checklist

- [x] Purpose is defined
- [x] Responsibilities are clear
- [x] Communication flow is documented
- [x] Layer boundaries are explicit
- [x] No implementation code is included
