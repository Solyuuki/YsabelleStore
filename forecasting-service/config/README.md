# Configuration Foundation

## Purpose

This folder documents the configuration baseline for the forecasting service.

## Scope

This is documentation only. It defines runtime expectations, dependency policy, and environment-variable planning without adding runtime configuration code.

## Responsibilities

| Responsibility     | Description                                                         |
| ------------------ | ------------------------------------------------------------------- |
| Runtime baseline   | Document the Python runtime expected by the service                 |
| Library policy     | Record the core scientific packages used by future forecasting work |
| Environment policy | Describe environment variables without hardcoding secrets           |

## Runtime Baseline

| Component       | Planned baseline                                                     |
| --------------- | -------------------------------------------------------------------- |
| Python          | 3.12+                                                                |
| `numpy`         | Required scientific dependency, to be pinned during implementation   |
| `pandas`        | Required data-shaping dependency, to be pinned during implementation |
| `statsmodels`   | Required forecasting dependency, to be pinned during implementation  |
| `python-dotenv` | Required environment loader for local development                    |

## Environment Variables

| Variable                  | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `FORECASTING_SERVICE_ENV` | Declares the active service environment                         |
| `FORECASTING_DATA_DIR`    | Points to local input data used by future forecasting workflows |
| `FORECASTING_OUTPUT_DIR`  | Points to the folder used for generated forecast artifacts      |
| `PYTHONPATH`              | Supports explicit module resolution during development          |

## Future Implementation Notes

- Keep secrets out of source files.
- Pin exact package versions only when the forecasting implementation is approved.
- Resolve file paths through environment configuration instead of hardcoded paths where practical.

## Validation Checklist

- [x] Python runtime is documented
- [x] Scientific dependencies are documented
- [x] Environment variable policy is documented
- [x] No runtime config code is added
