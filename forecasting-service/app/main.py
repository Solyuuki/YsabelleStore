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


def _historical_by_period(product: ProductSeries) -> dict[str, float]:
    return {
        str(point["period"]): float(point["quantitySold"])
        for point in product.get("historical", [])
    }


def _same_month_previous_year(product: ProductSeries, period: str) -> float | None:
    comparison_period = add_months(period, -12)
    return _historical_by_period(product).get(comparison_period)


def _percentage_change(current: float, previous: float | None) -> float | None:
    if previous is None or previous == 0:
        return None

    return round(((current - previous) / previous) * 100, 4)


def _accuracy_feedback(
    period: str,
    actual: float | None,
    predicted: float | None,
    strategy: str,
) -> dict[str, Any] | None:
    if actual is None or predicted is None or not isfinite(actual) or not isfinite(predicted):
        return None

    error = predicted - actual
    return {
        "evaluatedPeriod": month_start_iso(period),
        "actualQuantity": round(actual, 4),
        "predictedQuantity": round(max(0.0, predicted), 4),
        "signedError": round(error, 4),
        "absoluteError": round(abs(error), 4),
        "absolutePercentageError": round(abs(error / actual) * 100, 4) if actual != 0 else None,
        "strategy": strategy,
    }


def _forecast_points(
    product: ProductSeries,
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
        previous = _same_month_previous_year(product, period)
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
                # Legacy response keys are retained for frontend compatibility. The comparison
                # now means the exact same month one year earlier, not a hard-coded 2025 row.
                "differenceVersus2025": round(safe_prediction - previous, 4)
                if previous is not None
                else None,
                "percentageChangeVersus2025": variance,
                "forecastVariancePercentage": variance,
            }
        )

    return points


def _required_generation_window(
    last_historical_period: str,
    forecast_start_period: str,
    visible_horizon: int,
) -> tuple[int, int]:
    months_ahead = months_between(last_historical_period, forecast_start_period)
    if months_ahead < 1:
        raise ValueError(
            "Forecast start period must be after the latest completed historical month."
        )

    visible_offset = months_ahead - 1
    return visible_offset + visible_horizon, visible_offset


def _visible_slice(values: list[float], visible_offset: int, horizon: int) -> list[float]:
    return values[visible_offset : visible_offset + horizon]


def _fallback_validation(
    values: list[float],
    seasonal_period: int,
) -> tuple[list[float], list[float], str]:
    if len(values) > seasonal_period:
        return (
            [values[-1]],
            [values[-1 - seasonal_period]],
            "One-step realized fallback feedback using the same month one year earlier.",
        )

    if len(values) > 1:
        prediction = moving_average(values[:-1], 1)[0]
        return (
            [values[-1]],
            [prediction],
            "One-step realized fallback feedback using the prior completed-month moving average.",
        )

    return (
        values,
        values,
        "Single completed observation; accuracy feedback becomes meaningful after another month closes.",
    )


def _fallback_product(
    product: ProductSeries,
    values: list[float],
    warnings: list[str],
    reason: str,
    horizon: int,
    seasonal_period: int,
    forecast_start_period: str,
    last_historical_period: str,
) -> dict[str, Any]:
    total_horizon, visible_offset = _required_generation_window(
        last_historical_period, forecast_start_period, horizon
    )

    if len(values) >= seasonal_period:
        model = "SEASONAL_NAIVE"
        all_forecast_values = seasonal_naive(values, total_horizon, seasonal_period)
    else:
        model = "MOVING_AVERAGE"
        all_forecast_values = moving_average(values, total_horizon)

    forecast_values = all_forecast_values[visible_offset : visible_offset + horizon]
    validation_actual, validation_prediction, validation_strategy = _fallback_validation(
        values, seasonal_period
    )
    latest_period = str(product["historical"][-1]["period"])
    feedback = _accuracy_feedback(
        latest_period,
        validation_actual[-1] if validation_actual else None,
        validation_prediction[-1] if validation_prediction else None,
        validation_strategy,
    )

    return {
        "productId": product["productId"],
        "productName": product["productName"],
        "category": product["category"],
        "sellingPrice": product["sellingPrice"],
        "status": "WARNING",
        "model": model,
        "generatedAt": now_iso(),
        "historical": product["historical"],
        "forecast": _forecast_points(
            product,
            forecast_values,
            [None for _ in range(horizon)],
            [None for _ in range(horizon)],
            horizon,
            forecast_start_period,
        ),
        "metrics": calculate_metrics(validation_actual, validation_prediction, validation_strategy),
        "accuracyFeedback": feedback,
        "modelDetails": {
            "model": model,
            "order": None,
            "seasonalOrder": None,
            "aic": None,
            "converged": None,
        },
        "warnings": [
            *warnings,
            f"SARIMA fallback used: {reason}",
            "Confidence interval unavailable for fallback model.",
        ],
        "error": None,
    }


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
            "productName": product.get("productName", ""),
            "category": product.get("category", ""),
            "sellingPrice": product.get("sellingPrice", 0),
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
            "accuracyFeedback": None,
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

    first_historical_period = str(product["historical"][0]["period"])
    last_historical_period = str(product["historical"][-1]["period"])
    effective_forecast_start = forecast_start_period or add_months(last_historical_period, 1)

    try:
        total_horizon, visible_offset = _required_generation_window(
            last_historical_period, effective_forecast_start, horizon
        )
        result = fit_sarima(
            values,
            total_horizon,
            seasonal_period,
            start_period=first_historical_period,
        )
        status = "WARNING" if result.warnings or not result.converged else "READY"
        forecast_values = _visible_slice(result.forecast, visible_offset, horizon)
        lower_values = _visible_slice(result.lower, visible_offset, horizon)
        upper_values = _visible_slice(result.upper, visible_offset, horizon)
        feedback_strategy = (
            "Latest completed-month fitted-value feedback; recalculated whenever completed actual history changes."
        )
        feedback = _accuracy_feedback(
            last_historical_period,
            values[-1],
            result.fitted[-1] if result.fitted else None,
            feedback_strategy,
        )

        return {
            "productId": product["productId"],
            "productName": product["productName"],
            "category": product["category"],
            "sellingPrice": product["sellingPrice"],
            "status": status,
            "model": "SARIMA",
            "generatedAt": now_iso(),
            "historical": product["historical"],
            "forecast": _forecast_points(
                product,
                forecast_values,
                lower_values,
                upper_values,
                horizon,
                effective_forecast_start,
            ),
            "metrics": calculate_metrics(
                values[-12:],
                result.fitted[-12:],
                "Latest completed-month fitted-value diagnostics; refreshed as actual history advances.",
            ),
            "accuracyFeedback": feedback,
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
            effective_forecast_start,
            last_historical_period,
        )


def main() -> int:
    try:
        request: ForecastRequest = json.loads(sys.stdin.read())
        horizon = int(request.get("horizon", 12))
        seasonal_period = int(request.get("seasonalPeriod", 12))
        forecast_start_period = str(request.get("forecastStartPeriod") or "")
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
