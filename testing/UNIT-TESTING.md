# Unit Testing

## Purpose

This document defines the future unit testing strategy for YsabelleStore.

## Scope

- Frontend
- Backend
- Forecast Service
- Electron

## Strategy

| Layer            | Unit Test Focus                                               |
| ---------------- | ------------------------------------------------------------- |
| Frontend         | Components, hooks, state helpers, and validation helpers      |
| Backend          | Controllers, utilities, validators, and response helpers      |
| Forecast Service | Service boundaries, validation helpers, and output formatting |
| Electron         | Preload helpers, config helpers, and window setup helpers     |

## Naming Philosophy

- Unit tests should stay close to the code they protect.
- Test names should describe one behavior.
- Prefer clear, behavior-focused names over implementation details.

## Future Implementation Notes

- Keep unit tests small and deterministic.
- Use unit tests for fast feedback on isolated logic.
- Separate unit coverage from integration and E2E coverage.

## Validation Checklist

- [x] Frontend unit scope is documented
- [x] Backend unit scope is documented
- [x] Forecast service unit scope is documented
- [x] Electron unit scope is documented
- [x] No unit tests are implemented
