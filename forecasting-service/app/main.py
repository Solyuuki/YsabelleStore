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
from app.preprocessing import (
    add_months,
    month_start_iso,
    months_between,
    now_iso,
    validate_product_series,
    visible_forecast_periods,
)
from app.sarima import fit_sarima


LAST_HISTORICAL_MONTH = "2025-12"
FIRST_GENERATED_MONTH = "2026-01"


def _same_month_latest_historical(values: list[float], period: str) -> float | None:
    month = int(period[5:7])
    source_index = 12 + month - 1

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
    forecast_start_period: str,
) -> list[dict[str, Any]]:
    periods = visible_forecast_periods(forecast_start_period, horizon)
    points: list[dict[str, Any]] = []

    for index, period in enumerate(periods):
        prediction = forecast_values[index]
        safe_prediction = round(max(0.0, prediction), 4) if isfinite(prediction) else 0.0
        recommended = max(0, ceil(safe_prediction))
        previous = _same_month_latest_historical(values, period)
        variance = _percentage_change(safe_prediction, previous)

        points.append(
            {
                "period": month_start_iso(period),
                "predictedQuantity": safe_prediction,
                "recommendedQuantity": recommended,
                "lowerConfidence": lower[index] if index < len(lower) else None,
                "upperConfidence": upper[index] if index < len(upper) else None,
                "sameMonthLastYear": previous,
                "comparisonSalesQuantity": previous,
                "differenceVersus2025": round(safe_prediction - previous, 4)
                if previous is not None
                else None,
                "percentageChangeVersus2025": variance,
                "forecastVariancePercentage": variance,
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
    forecast_start_period: str,
) -> dict[str, Any]:
    if len(values) >= seasonal_period:
        model = "SEASONAL_NAIVE"
        total_horizon, visible_offset = _required_generation_window(forecast_start_period, horizon)
        all_forecast_values = seasonal_naive(values, total_horizon, seasonal_period)
        forecast_values = all_forecast_values[visible_offset : visible_offset + horizon]
        validation_prediction = values[:12]
        validation_actual = values[12:24]
        validation_strategy = "2025 backtest using matching 2024 month."
    else:
        model = "MOVING_AVERAGE"
        total_horizon, visible_offset = _required_generation_window(forecast_start_period, horizon)
        all_forecast_values = moving_average(values, total_horizon)
        forecast_values = all_forecast_values[visible_offset : visible_offset + horizon]
        validation_prediction = [sum(values) / len(values) for _ in values] if values else []
        validation_actual = values
        validation_strategy = "Historical mean in-sample baseline."

    return {
        "productId": product["productId"],
        "sku": product["productId"],
        "barcode": None,
        "productCode": product["productId"],
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
            forecast_start_period,
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


def _required_generation_window(forecast_start_period: str, visible_horizon: int) -> tuple[int, int]:
    visible_offset = max(0, months_between(FIRST_GENERATED_MONTH, forecast_start_period))
    last_visible_month = add_months(forecast_start_period, visible_horizon - 1)
    total_horizon = months_between(FIRST_GENERATED_MONTH, last_visible_month) + 1

    return max(visible_horizon, total_horizon), visible_offset


def _visible_slice(values: list[float], visible_offset: int, horizon: int) -> list[float]:
    return values[visible_offset : visible_offset + horizon]


def forecast_product(
    product: ProductSeries,
    horizon: int,
    seasonal_period: int,
    forecast_start_period: str,
) -> dict[str, Any]:
    try:
        values, product_warnings = validate_product_series(product)
    except Exception as exc:  # noqa: BLE001 - safe API error contract.
        return {
            "productId": product.get("productId", ""),
            "sku": product.get("productId", ""),
            "barcode": None,
            "productCode": product.get("productId", ""),
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
        total_horizon, visible_offset = _required_generation_window(forecast_start_period, horizon)
        result = fit_sarima(values, total_horizon, seasonal_period)
        status = "WARNING" if result.warnings or not result.converged else "READY"
        forecast_values = _visible_slice(result.forecast, visible_offset, horizon)
        lower_values = _visible_slice(result.lower, visible_offset, horizon)
        upper_values = _visible_slice(result.upper, visible_offset, horizon)

        return {
            "productId": product["productId"],
            "sku": product["productId"],
            "barcode": None,
            "productCode": product["productId"],
            "productName": product["productName"],
            "category": product["category"],
            "productPrice": product["productPrice"],
            "status": status,
            "model": "SARIMA",
            "generatedAt": now_iso(),
            "historical": product["historical"],
            "forecast": _forecast_points(
                values,
                forecast_values,
                lower_values,
                upper_values,
                horizon,
                forecast_start_period,
            ),
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
        return _fallback_product(
            product,
            values,
            product_warnings,
            str(exc),
            horizon,
            seasonal_period,
            forecast_start_period,
        )


def main() -> int:
    try:
        request: ForecastRequest = json.loads(sys.stdin.read())
        horizon = int(request.get("horizon", 12))
        seasonal_period = int(request.get("seasonalPeriod", 12))
        forecast_start_period = str(request.get("forecastStartPeriod", add_months(LAST_HISTORICAL_MONTH, 1)))
        products = request.get("products", [])

        response = {
            "products": [
                forecast_product(product, horizon, seasonal_period, forecast_start_period)
                for product in products
            ]
        }
        sys.stdout.write(json.dumps(response, separators=(",", ":")))
        return 0
    except Exception as exc:  # noqa: BLE001 - stderr is for backend diagnostics only.
        sys.stderr.write(str(exc))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
