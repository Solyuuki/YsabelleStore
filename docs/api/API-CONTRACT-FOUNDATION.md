# API Contract Foundation

## Purpose

This document defines the repository-wide API contract model for YsabelleStore.

## Scope

- Request rules
- Response rules
- Error rules
- DTO rules
- Route naming
- Versioning
- Status code conventions
- Forecasting service communication

## Contract Principle

| Principle            | Meaning                                                         |
| -------------------- | --------------------------------------------------------------- |
| Centralized contract | Every endpoint should follow one shared standard                |
| Versioned paths      | API behavior should be stable and versioned                     |
| Predictable payloads | Responses and errors should be easy for the frontend to consume |
| Layer separation     | Contracts describe communication, not implementation            |

## Communication Architecture

```text
React
  -> /api/v1/*
  -> Express API
  -> Forecasting Service
  -> Prisma
  -> MySQL
```

## Responsibilities

| Layer               | Responsibility                                          |
| ------------------- | ------------------------------------------------------- |
| React               | Send documented requests and read documented responses  |
| Express             | Validate requests, route calls, and format responses    |
| Forecasting service | Accept forecast payloads and return forecast outputs    |
| Prisma              | Persist data through backend-owned logic                |
| MySQL               | Store data only; it is not part of the contract surface |

## Future Implementation Notes

- Use this folder as the canonical API documentation source.
- Keep future endpoint work aligned with the shared response and error shapes.
- Update contract docs before changing route behavior.

## Validation Checklist

- [x] API contract purpose is stated
- [x] Architecture boundaries are documented
- [x] Layer responsibilities are clear
- [x] No controllers or services are implemented
