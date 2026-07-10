from __future__ import annotations

import json
import sys
from math import ceil, isfinite
from pathlib import Path
from typing import Any

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.contracts import ForecastRequest, ProductSeries
from app.evaluation import calculate_metrics
from app.fallback import moving_average, seasonal_naive
from app.preprocessing import forecast_periods, now_iso, validate_product_series
from app.sarima import fit_sarima


def _same_month_2025(values: list[float], month_index: int) -> float | None:
    source_index = 12 + month_index
    return values[source_index] if source_index < len(values) else None


def _percentage_change(current: float, previous: float | None) -> float | None:
    if previous is None or previous == 0:
        return None

    return round(((current - previous) / previous) * 100, 4)


def _forecast_points(
    values: list[float],
    forecast_values: list[float],
    lower: list[float | None],
    upper: list[float | None],
    horizon: int,
) -> list[dict[str, Any]]:
    periods = forecast_periods(horizon=horizon)
    points: list[dict[str, Any]] = []

    for index, period in enumerate(periods):
        prediction = forecast_values[index]
        safe_prediction = round(max(0.0, prediction), 4) if isfinite(prediction) else 0.0
        recommended = max(0, ceil(safe_prediction))
        previous = _same_month_2025(values, index)

        points.append(
            {
                "period": period,
                "predictedQuantity": safe_prediction,
                "recommendedQuantity": recommended,
                "lowerConfidence": lower[index] if index < len(lower) else None,
                "upperConfidence": upper[index] if index < len(upper) else None,
                "sameMonthLastYear": previous,
                "differenceVersus2025": round(safe_prediction - previous, 4)
                if previous is not None
                else None,
                "percentageChangeVersus2025": _percentage_change(safe_prediction, previous),
            }
        )

    return points


def _fallback_product(
    product: ProductSeries,
    values: list[float],
    warnings: list[str],
    reason: str,
    horizon: int,
    seasonal_period: int,
) -> dict[str, Any]:
    if len(values) >= seasonal_period:
        model = "SEASONAL_NAIVE"
        forecast_values = seasonal_naive(values, horizon, seasonal_period)
        validation_prediction = values[:12]
        validation_actual = values[12:24]
        validation_strategy = "2025 backtest using matching 2024 month."
    else:
        model = "MOVING_AVERAGE"
        forecast_values = moving_average(values, horizon)
        validation_prediction = [sum(values) / len(values) for _ in values] if values else []
        validation_actual = values
        validation_strategy = "Historical mean in-sample baseline."

    return {
        "productId": product["productId"],
        "productName": product["productName"],
        "category": product["category"],
        "productPrice": product["productPrice"],
        "status": "WARNING",
        "model": model,
        "generatedAt": now_iso(),
        "historical": product["historical"],
        "forecast": _forecast_points(
            values,
            forecast_values,
            [None for _ in range(horizon)],
            [None for _ in range(horizon)],
            horizon,
        ),
        "metrics": calculate_metrics(validation_actual, validation_prediction, validation_strategy),
        "modelDetails": {
            "model": model,
            "order": None,
            "seasonalOrder": None,
            "aic": None,
            "converged": None,
        },
        "warnings": [*warnings, f"SARIMA fallback used: {reason}", "Confidence interval unavailable for fallback model."],
        "error": None,
    }


def forecast_product(product: ProductSeries, horizon: int, seasonal_period: int) -> dict[str, Any]:
    try:
        values, product_warnings = validate_product_series(product)
    except Exception as exc:  # noqa: BLE001 - safe API error contract.
        return {
            "productId": product.get("productId", ""),
            "productName": product.get("productName", ""),
            "category": product.get("category", ""),
            "productPrice": product.get("productPrice", 0),
            "status": "FAILED",
            "model": None,
            "generatedAt": now_iso(),
            "historical": product.get("historical", []),
            "forecast": [],
            "metrics": {
                "mae": None,
                "rmse": None,
                "mape": None,
                "wape": None,
                "validationStrategy": "Unavailable because the historical series is invalid.",
            },
            "modelDetails": {
                "model": None,
                "order": None,
                "seasonalOrder": None,
                "aic": None,
                "converged": None,
            },
            "warnings": [],
            "error": str(exc),
        }

    try:
        result = fit_sarima(values, horizon, seasonal_period)
        status = "WARNING" if result.warnings or not result.converged else "READY"

        return {
            "productId": product["productId"],
            "productName": product["productName"],
            "category": product["category"],
            "productPrice": product["productPrice"],
            "status": status,
            "model": "SARIMA",
            "generatedAt": now_iso(),
            "historical": product["historical"],
            "forecast": _forecast_points(values, result.forecast, result.lower, result.upper, horizon),
            "metrics": calculate_metrics(
                values[-12:],
                result.fitted[-12:],
                "In-sample fitted-value diagnostics on the latest 12 months.",
            ),
            "modelDetails": {
                "model": "SARIMA",
                "order": list(result.order),
                "seasonalOrder": list(result.seasonal_order),
                "aic": result.aic,
                "converged": result.converged,
            },
            "warnings": [*product_warnings, *result.warnings],
            "error": None,
        }
    except Exception as exc:  # noqa: BLE001 - fallback is required behavior.
        return _fallback_product(product, values, product_warnings, str(exc), horizon, seasonal_period)


def main() -> int:
    try:
        request: ForecastRequest = json.loads(sys.stdin.read())
        horizon = int(request.get("horizon", 12))
        seasonal_period = int(request.get("seasonalPeriod", 12))
        products = request.get("products", [])

        response = {
            "products": [
                forecast_product(product, horizon, seasonal_period) for product in products
            ]
        }
        sys.stdout.write(json.dumps(response, separators=(",", ":")))
        return 0
    except Exception as exc:  # noqa: BLE001 - stderr is for backend diagnostics only.
        sys.stderr.write(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
