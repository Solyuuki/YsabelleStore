from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.evaluation import calculate_metrics  # noqa: E402
from app.fallback import moving_average, seasonal_naive  # noqa: E402
from app.main import forecast_product  # noqa: E402


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


def test_forecast_product_returns_twelve_chronological_points() -> None:
    result = forecast_product(_product([10 + (index % 12) for index in range(24)]), 12, 12)

    assert result["forecast"][0]["period"] == "2026-01"
    assert result["forecast"][-1]["period"] == "2026-12"
    assert len(result["forecast"]) == 12
    assert all(point["recommendedQuantity"] >= 0 for point in result["forecast"])
