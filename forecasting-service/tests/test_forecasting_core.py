from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.evaluation import calculate_metrics  # noqa: E402
from app.fallback import moving_average, seasonal_naive  # noqa: E402
from app.main import forecast_product  # noqa: E402
from app.preprocessing import add_months, visible_forecast_periods  # noqa: E402


def _product(values: list[int]) -> dict:
    periods = [f"2024-{month:02d}" for month in range(1, 13)] + [
        f"2025-{month:02d}" for month in range(1, 13)
    ]

    return {
        "productId": "P001",
        "productName": "Sample",
        "category": "Sample",
        "productPrice": 10,
        "historical": [
            {
                "productId": "P001",
                "productName": "Sample",
                "category": "Sample",
                "productPrice": 10,
                "period": period,
                "quantitySold": value,
            }
            for period, value in zip(periods, values)
        ],
    }


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
    result = forecast_product(_product([10 + (index % 12) for index in range(24)]), 12, 12, "2026-07")

    assert result["forecast"][0]["period"] == "2026-07-01"
    assert result["forecast"][-1]["period"] == "2027-06-01"
    assert len(result["forecast"]) == 12
    assert len({point["period"] for point in result["forecast"]}) == 12
    assert all(point["recommendedQuantity"] >= 0 for point in result["forecast"])


def test_forecast_variance_uses_same_month_latest_history() -> None:
    result = forecast_product(_product([10 for _ in range(12)] + [20 for _ in range(12)]), 12, 12, "2026-07")
    first_point = result["forecast"][0]

    assert first_point["comparisonSalesQuantity"] == 20
    assert first_point["forecastVariancePercentage"] is not None
