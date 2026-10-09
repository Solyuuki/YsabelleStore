"""QA-only integrity tests; synthetic fixtures never enter the operational database."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.preprocessing import add_months  # noqa: E402
from qa import rolling_backtest  # noqa: E402


def sample_payload() -> dict:
    history = [
        {
            "productId": "P001",
            "productName": "QA ONLY",
            "category": "QA",
            "sellingPrice": 10,
            "period": add_months("2024-01", index),
            "quantitySold": 10 + index,
        }
        for index in range(24)
    ]
    return {
        "source": "CANONICAL_2024_2025_WORKBOOKS",
        "products": [{
            "productId": "P001",
            "productName": "QA ONLY",
            "category": "QA",
            "sellingPrice": 10,
            "historical": history
        }],
    }


def test_backtest_never_exposes_held_out_actual_to_model(monkeypatch) -> None:
    seen = []

    def fake_forecast(product, horizon, seasonal_period, forecast_start_period):
        assert horizon == 1
        assert seasonal_period == 12
        assert product["historical"][-1]["period"] == add_months(forecast_start_period, -1)
        assert all(row["period"] < forecast_start_period for row in product["historical"])
        seen.append(forecast_start_period)
        return {"status": "WARNING", "model": "SEASONAL_NAIVE", "forecast": [
            {"predictedQuantity": 20}
        ]}

    monkeypatch.setattr(rolling_backtest, "forecast_product", fake_forecast)
    result = rolling_backtest.evaluate(sample_payload(), months=2, max_products=1)
    assert seen == ["2025-11", "2025-12"]
    assert result["foldsEvaluated"] == 2
    assert result["modelsUsed"] == {"SEASONAL_NAIVE": 2}
    assert result["sarimaOutOfSampleValidated"] is False
    assert result["releaseStatus"] == "NOT_CERTIFIED"


def test_backtest_rejects_untrusted_history_and_gapped_months() -> None:
    payload = sample_payload()
    payload["source"] = "RECONSTRUCTED_2026"
    with pytest.raises(ValueError, match="Refusing input"):
        rolling_backtest.evaluate(payload, months=2, max_products=1)

    payload = sample_payload()
    payload["products"][0]["historical"][4]["period"] = "2024-07"
    result = rolling_backtest.evaluate(payload, months=2, max_products=1)
    assert result["foldsEvaluated"] == 0
    assert result["issues"][0]["reason"] == "Missing, duplicated, or unordered historical month"


def test_metrics_do_not_divide_by_zero_actual_sales() -> None:
    metrics = rolling_backtest.safe_metrics(
        [{"actual": 0, "forecast": 12, "seasonalNaive": 0}], "forecast"
    )
    assert metrics["mae"] == 12
    assert metrics["wapePercent"] is None
    assert metrics["biasPercent"] is None
