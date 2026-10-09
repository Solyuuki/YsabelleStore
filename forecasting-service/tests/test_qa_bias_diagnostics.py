"""Tests for read-only bias diagnostics; QA branch only."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.preprocessing import add_months  # noqa: E402
from qa.diagnose_workbook_bias import benchmark, diagnose, metrics  # noqa: E402


def sample() -> dict:
    values = [10] * 12 + [15] * 12
    return {
        "source": "CANONICAL_2024_2025_WORKBOOKS",
        "products": [{
            "productId": "P-TEST",
            "historical": [
                {"period": add_months("2024-01", i), "quantitySold": value}
                for i, value in enumerate(values)
            ],
        }],
    }


def test_growth_candidate_uses_only_past_same_calendar_month_pairs() -> None:
    data = sample()
    report = diagnose(data, months=1, max_products=1)
    assert report["products"] == 1
    assert report["folds"] == 1
    assert report["periods"] == ["2025-12"]
    assert report["aggregate"]["seasonalNaive"]["maeUnits"] == 5
    # Oct/Nov 2025 sales are used; Dec 2025 actual is held out.
    assert report["aggregate"]["growthAdjustedSeasonal"]["maeUnits"] == 2.5
    assert report["releaseStatus"] == "NOT_CERTIFIED"


def test_unsafe_or_unverified_history_is_rejected() -> None:
    data = sample()
    data["source"] = "RECONSTRUCTED_2026"
    with pytest.raises(ValueError, match="noncanonical"):
        diagnose(data)
    data = sample()
    data["products"][0]["historical"][3]["period"] = "2024-07"
    with pytest.raises(ValueError, match="invalid products"):
        diagnose(data)


def test_benchmarks_are_finite_and_conservative_on_zero_and_extreme_growth() -> None:
    zero = benchmark([0.0] * 12 + [10.0] * 6)
    assert zero["growthAdjustedSeasonal"] == 0
    huge_growth = benchmark([2.0] * 12 + [1000.0] * 6)
    assert huge_growth["growthAdjustedSeasonal"] == 2.5
    assert metrics([{"actual": 0, "seasonalNaive": 5}], "seasonalNaive")["wapePercent"] is None
