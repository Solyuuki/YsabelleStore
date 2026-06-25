# API Versioning

## Purpose

This document defines the API versioning strategy for YsabelleStore.

## Scope

- `v1` strategy
- Future `v2` handling
- Deprecation policy
- Backward compatibility

## Versioning Policy

| Version | Meaning                                  |
| ------- | ---------------------------------------- |
| `v1`    | Current stable API contract              |
| `v2`    | Future breaking or major contract update |

## Versioning Rules

- Keep public APIs under `/api/v1`.
- Introduce `v2` only when a contract break is necessary.
- Preserve backward compatibility for approved clients where practical.
- Document breaking changes before release.

## Deprecation Strategy

| Step       | Action                                                    |
| ---------- | --------------------------------------------------------- |
| Announce   | Document the old and new behaviors                        |
| Transition | Allow time for consumers to move                          |
| Support    | Keep the older version stable during the agreed period    |
| Retire     | Remove deprecated behavior only after the approved window |

## Future Implementation Notes

- Version changes should be deliberate and documented.
- Avoid breaking changes inside a stable version unless a new version is introduced.
- Keep the version policy consistent across frontend, backend, and forecasting integration.

## Validation Checklist

- [x] v1 strategy is documented
- [x] Future v2 handling is documented
- [x] Deprecation strategy is clear
- [x] Backward compatibility is addressed
