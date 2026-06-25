# Feature Flags

## Purpose

This document defines the future optional configuration flags that can be used to enable or disable YsabelleStore capabilities.

## Scope

- Feature flag documentation
- Optional runtime switches
- Development and debug toggles

## Planned Feature Flags

| Flag                   | Purpose                                       | Notes                                      |
| ---------------------- | --------------------------------------------- | ------------------------------------------ |
| Enable Forecast Module | Turn forecasting workflows on or off          | Keep separate from recommendation logic    |
| Enable Reports         | Control report-related screens or exports     | Use only when reporting is implemented     |
| Enable Analytics       | Control advanced analytics visibility         | Keep optional for staged rollout           |
| Enable Debug Mode      | Expose extra diagnostics in development       | Never enable by default in production      |
| Enable Developer Tools | Allow Electron developer tools in development | Keep disabled in production release builds |

## Decision Matrix

| Rule                | Foundation Guidance                                        |
| ------------------- | ---------------------------------------------------------- |
| Default off         | Optional flags should be disabled unless explicitly needed |
| Document before use | Every new flag must be explained in docs first             |
| No hidden behavior  | Flags must not change behavior silently                    |

## Future Implementation Notes

- Feature flags should be used sparingly.
- Flags should not replace proper architecture decisions.
- Feature flags should be removed when they are no longer needed.

## Validation Checklist

- [x] Optional flags are documented
- [x] Debug and developer toggles are included
- [x] Default-off guidance is stated
- [x] No runtime feature-flag code is added
