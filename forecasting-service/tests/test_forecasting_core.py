from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.evaluation import calculate_metrics  # noqa: E402
from app.fallback import moving_average, seasonal_naive  # noqa: E402
from app.main import _sarima_hint, _worker_count, forecast_product  # noqa: E402
from app.preprocessing import add_months, visible_forecast_periods  # noqa: E402


def _product_from_start(values: list[int], start_period: str = "2024-01") -> dict:
    periods = [add_months(start_period, index) for index in range(len(values))]

    return {
        "productId": "P001",
        "productName": "Sample",
        "category": "Sample",
        "sellingPrice": 10,
        "historical": [
            {
                "productId": "P001",
                "productName": "Sample",
                "category": "Sample",
                "sellingPrice": 10,
                "period": period,
                "quantitySold": value,
            }
            for period, value in zip(periods, values)
        ],
    }


def _product(values: list[int]) -> dict:
    return _product_from_start(values)


def test_seasonal_naive_maps_2026_to_2025_months() -> None:
    values = list(range(1, 25))

    assert seasonal_naive(values, 12, 12) == [float(value) for value in range(13, 25)]


def test_moving_average_uses_recent_window() -> None:
    assert moving_average([2, 4, 10], 3) == [16 / 3, 16 / 3, 16 / 3]


def test_metrics_handle_zero_actual_mape() -> None:
    metrics = calculate_metrics([0, 10], [5, 12], "test")

    assert metrics["mape"] == 20
    assert metrics["rmse"] is not None
    assert metrics["wape"] == 70


def test_visible_window_starts_with_current_month() -> None:
    assert visible_forecast_periods("2026-07", 12) == [
        "2026-07",
        "2026-08",
        "2026-09",
        "2026-10",
        "2026-11",
        "2026-12",
        "2027-01",
        "2027-02",
        "2027-03",
        "2027-04",
        "2027-05",
        "2027-06",
    ]


def test_visible_window_handles_january_and_december_boundaries() -> None:
    january_window = visible_forecast_periods("2026-01", 12)
    december_window = visible_forecast_periods("2026-12", 12)

    assert january_window[0] == "2026-01"
    assert january_window[-1] == "2026-12"
    assert december_window[0] == "2026-12"
    assert december_window[-1] == "2027-11"
    assert len(set(december_window)) == 12


def test_add_months_preserves_chronological_year_boundary() -> None:
    assert add_months("2026-12", 1) == "2027-01"
    assert add_months("2026-07", 11) == "2027-06"


def test_forecast_product_returns_twelve_chronological_points() -> None:
    result = forecast_product(
        _product([10 + (index % 12) for index in range(24)]), 12, 12, "2026-07"
    )

    assert result["forecast"][0]["period"] == "2026-07-01"
    assert result["forecast"][-1]["period"] == "2027-06-01"
    assert len(result["forecast"]) == 12
    assert len({point["period"] for point in result["forecast"]}) == 12
    assert all(point["recommendedQuantity"] >= 0 for point in result["forecast"])


def test_forecast_variance_uses_exact_previous_year_month() -> None:
    values = [10 + (index % 7) for index in range(32)]
    result = forecast_product(_product_from_start(values, "2024-01"), 12, 12, "2026-09")
    first_point = result["forecast"][0]

    assert first_point["comparisonSalesQuantity"] == values[20]
    assert first_point["forecastVariancePercentage"] is not None


def test_dynamic_history_ending_august_forecasts_september_without_fixed_2026_anchor() -> None:
    values = [12 + (index % 12) for index in range(32)]
    result = forecast_product(_product_from_start(values, "2024-01"), 12, 12, "2026-09")

    assert result["historical"][-1]["period"] == "2026-08"
    assert result["forecast"][0]["period"] == "2026-09-01"
    assert result["forecast"][-1]["period"] == "2027-08-01"


def test_short_clean_database_history_uses_fallback_instead_of_failing() -> None:
    values = [5, 7, 6, 9, 8, 10]
    result = forecast_product(_product_from_start(values, "2026-01"), 12, 12, "2026-07")

    assert result["status"] == "WARNING"
    assert result["model"] == "MOVING_AVERAGE"
    assert result["forecast"][0]["period"] == "2026-07-01"
    assert len(result["forecast"]) == 12


def test_accuracy_feedback_tracks_latest_completed_observation() -> None:
    values = [10 + (index % 12) for index in range(24)]
    result = forecast_product(_product(values), 12, 12, "2026-01")
    feedback = result["accuracyFeedback"]

    assert feedback is not None
    assert feedback["evaluatedPeriod"] == "2025-12-01"
    assert feedback["actualQuantity"] == values[-1]
    assert feedback["absoluteError"] >= 0


def test_previous_model_hint_is_validated_before_reuse() -> None:
    product = _product([10 + (index % 12) for index in range(24)])
    product["modelHint"] = {
        "order": [0, 1, 1],
        "seasonalOrder": [0, 1, 1, 12],
    }

    assert _sarima_hint(product, 12) == ((0, 1, 1), (0, 1, 1, 12))
    assert _sarima_hint(product, 6) == (None, None)


def test_parallel_worker_count_is_conservative(monkeypatch) -> None:
    monkeypatch.setenv("FORECAST_WORKERS", "99")

    assert _worker_count(1) == 1
    assert 1 <= _worker_count(472) <= 4
