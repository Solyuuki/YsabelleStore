# Build Validation

## Purpose

This document defines the validation expectations that should be satisfied before a release candidate is packaged or promoted.

## Scope

- Backend startup
- Frontend build output
- Electron launch behavior
- Forecast service readiness
- Console and lint cleanliness

## Validation Matrix

| Area             | Validation                            | Expected Result                       |
| ---------------- | ------------------------------------- | ------------------------------------- |
| Backend          | Backend starts locally                | No startup failure                    |
| Frontend         | Frontend builds successfully          | Build artifacts produced              |
| Electron         | Electron launches in development      | Window opens without fatal errors     |
| Forecast service | Forecast service is available locally | Service boundary responds as expected |
| Console          | No console errors during validation   | Clean execution                       |
| Lint             | No lint issues                        | Lint passes                           |
| Build            | No build failures                     | Build passes                          |

## Build Flow

```text
Source changes
  -> Local validation
  -> Workspace build
  -> Electron packaging review
  -> Release candidate review
```

## Future Implementation Notes

- Validation should be repeatable on a clean machine.
- Failures should be fixed before packaging.
- Build validation should stay separate from release publishing.

## Validation Checklist

- [x] Validation areas are listed
- [x] Expected results are defined
- [x] Flow is documented
- [x] No execution code is included
