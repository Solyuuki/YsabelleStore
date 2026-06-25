# Constants

## Purpose

This document defines repository constants that should remain stable unless the project officially changes them.

## Scope

- Pagination defaults
- Forecast horizon defaults
- Supported file extensions
- Application limits
- Date formats
- Timezone policy
- Naming standards

## Repository Constants

| Constant                  | Purpose                         | Notes                                             |
| ------------------------- | ------------------------------- | ------------------------------------------------- |
| Pagination default        | Standard list size              | Use a consistent default across UI and API        |
| Forecast horizon default  | Forecast window length          | Keep consistent once approved by forecasting work |
| Supported file extensions | Import and export filters       | Document allowed file types                       |
| Application limits        | Usability and safety boundaries | Protect against oversized inputs                  |
| Date format               | Shared date representation      | Use one documented standard                       |
| Timezone policy           | Time handling consistency       | Define one project timezone policy                |
| Naming standards          | Consistent repo naming          | Match repository naming rules                     |

## Suggested Foundation Values

| Constant Type      | Suggested Value                            |
| ------------------ | ------------------------------------------ |
| Pagination default | 10 or 25 based on module needs             |
| Date format        | ISO 8601 for machine-readable data         |
| Timezone policy    | Documented project timezone only           |
| File extensions    | Restricted to approved business file types |

## Decision Matrix

| Rule                        | Benefit                                 |
| --------------------------- | --------------------------------------- |
| Keep constants centralized  | Reduces drift between modules           |
| Avoid magic values          | Makes code and docs easier to review    |
| Document changes before use | Keeps thesis defense explanations clear |

## Future Implementation Notes

- Use constants for values that should not change silently.
- Keep module-specific constants documented close to the module when needed.
- Update this file when the project adopts a new shared default.

## Validation Checklist

- [x] Shared constants are documented
- [x] Date and timezone rules are included
- [x] File extension expectations are noted
- [x] No code constants are implemented
