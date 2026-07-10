# Forecasting Service

## Purpose

This Python service generates product-level monthly demand forecasts for YsabelleStore. It receives normalized JSON from
the Express backend, fits constrained SARIMA candidates with `statsmodels`, and emits a structured JSON response for the
owner Forecast and Reports pages.

## Runtime Boundary

The backend owns Excel parsing, validation, authorization, process timeout handling, and API serialization. Python owns
series validation, SARIMA fitting, fallback forecasts, confidence intervals when available, and metrics.

```text
Express backend
-> JSON over stdin
-> forecasting-service/app/main.py
-> JSON over stdout
```

Diagnostics and failures go to stderr and are translated by the backend.

## Main Modules

| File                   | Responsibility                                  |
| ---------------------- | ----------------------------------------------- |
| `app/main.py`          | CLI entry, product loop, output serialization   |
| `app/contracts.py`     | Typed request structures                        |
| `app/preprocessing.py` | Period validation and forecast month generation |
| `app/sarima.py`        | Bounded SARIMA candidate fitting                |
| `app/fallback.py`      | Seasonal naive and moving-average fallback      |
| `app/evaluation.py`    | MAE, RMSE, MAPE, WAPE metrics                   |
| `tests/`               | Python unit tests                               |

## Dependencies

Install from the repository root:

```bash
python -m pip install -r forecasting-service/requirements.txt
```

Required packages:

- `pandas`
- `numpy`
- `statsmodels`
- `python-dotenv`
- `pytest`

## SARIMA Strategy

The service uses monthly SARIMA notation `SARIMA(p,d,q)(P,D,Q,12)`.

Curated candidates:

- `(0,1,1)(0,1,1,12)`
- `(1,1,0)(0,1,1,12)`
- `(1,0,0)(1,0,0,12)`

The lowest finite AIC candidate is selected. If no candidate produces finite output, the service falls back to seasonal
naive, then moving average when seasonal history is unavailable.

## Commands

```bash
python -m pytest forecasting-service/tests
npm run forecast:validate-data
npm run forecast:generate
npm run forecast:smoke
```

## Limitations

- Only 24 monthly observations are available per product.
- Only two seasonal cycles are represented.
- Low-volume products can produce unstable SARIMA estimates.
- Confidence intervals may be wide or unavailable for fallback models.
- Forecasts do not account for promotions, price changes, stockouts, supplier disruptions, lost demand, or economic
  shocks.
