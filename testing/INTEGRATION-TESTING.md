# Integration Testing

## Purpose

This document defines the future integration testing strategy for YsabelleStore.

## Scope

- Frontend to backend communication
- Backend to database communication
- Backend to forecasting service communication
- Electron to backend communication

## Strategy

| Integration Path            | What It Should Verify                                |
| --------------------------- | ---------------------------------------------------- |
| Frontend -> Backend         | API contract compatibility and request/response flow |
| Backend -> Database         | Prisma-backed data flow and persistence assumptions  |
| Backend -> Forecast Service | Forecast request and response contract compatibility |
| Electron -> Backend         | Desktop shell communication with local backend APIs  |

## Validation Philosophy

- Integration tests should prove that approved boundaries work together.
- Use real contract shapes and real service boundaries where appropriate.
- Keep failure reports focused on the interface that broke.

## Future Implementation Notes

- Add integration tests only after the related contract is approved.
- Keep integration coverage separate from unit and E2E coverage.
- Prefer stable fixtures only when a real interface requires them.

## Validation Checklist

- [x] Frontend-backend integration is documented
- [x] Backend-database integration is documented
- [x] Backend-forecast integration is documented
- [x] Electron-backend integration is documented
- [x] No integration tests are implemented
