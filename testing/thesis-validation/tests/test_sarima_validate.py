from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sarima_validate import metric_bundle  # noqa: E402


def test_metric_bundle_matches_known_values() -> None:
    actual = np.array([20.0, 25.0, 22.0, 30.0])
    forecast = np.array([18.0, 27.0, 21.0, 26.0])

    metrics = metric_bundle(actual, forecast)

    assert round(metrics["mae"], 4) == 2.25
    assert round(metrics["rmse"], 4) == 2.5
    assert round(metrics["mape"], 4) == 8.9697
    assert all(metrics["verification"].values())


def test_mape_excludes_zero_actual_without_removing_it_from_mae_rmse() -> None:
    actual = np.array([0.0, 10.0])
    forecast = np.array([5.0, 12.0])

    metrics = metric_bundle(actual, forecast)

    assert metrics["mape"] == 20.0
    assert metrics["mape_valid_observations"] == 1
    assert metrics["zero_actual_observations"] == 1
    assert metrics["mae"] == 3.5
    assert round(metrics["rmse"], 4) == 3.8079
    assert all(metrics["verification"].values())
