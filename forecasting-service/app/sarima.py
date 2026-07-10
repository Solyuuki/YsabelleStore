from __future__ import annotations

import warnings
from dataclasses import dataclass
from math import isfinite

import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX


@dataclass
class SarimaResult:
    forecast: list[float]
    lower: list[float | None]
    upper: list[float | None]
    fitted: list[float]
    order: tuple[int, int, int]
    seasonal_order: tuple[int, int, int, int]
    aic: float
    converged: bool
    warnings: list[str]


CANDIDATES: tuple[tuple[tuple[int, int, int], tuple[int, int, int]], ...] = (
    ((0, 1, 1), (0, 1, 1)),
    ((1, 1, 0), (0, 1, 1)),
    ((1, 0, 0), (1, 0, 0)),
)


def _clean_interval(values: np.ndarray) -> list[float | None]:
    cleaned: list[float | None] = []

    for value in values:
        numeric = float(value)
        cleaned.append(round(max(0.0, numeric), 4) if isfinite(numeric) else None)

    return cleaned


def fit_sarima(values: list[float], horizon: int, seasonal_period: int) -> SarimaResult:
    if len(values) < 24:
        raise ValueError("SARIMA requires 24 observations for this Sprint 3 foundation.")

    series = pd.Series(
        values,
        index=pd.period_range(start="2024-01", periods=len(values), freq="M").to_timestamp(),
        dtype="float64",
    )
    best: SarimaResult | None = None
    failures: list[str] = []

    for order, seasonal in CANDIDATES:
        seasonal_order = (seasonal[0], seasonal[1], seasonal[2], seasonal_period)

        try:
            with warnings.catch_warnings(record=True) as captured:
                warnings.simplefilter("always")
                model = SARIMAX(
                    series,
                    order=order,
                    seasonal_order=seasonal_order,
                    enforce_stationarity=False,
                    enforce_invertibility=False,
                )
                fitted = model.fit(disp=False, maxiter=40)
                predicted = fitted.get_forecast(steps=horizon)
                mean_values = [float(value) for value in predicted.predicted_mean.to_numpy()]

                if not all(isfinite(value) for value in mean_values):
                    raise ValueError("SARIMA produced a non-finite forecast.")

                interval = predicted.conf_int(alpha=0.2).to_numpy()
                candidate = SarimaResult(
                    forecast=[round(max(0.0, value), 4) for value in mean_values],
                    lower=_clean_interval(interval[:, 0]),
                    upper=_clean_interval(interval[:, 1]),
                    fitted=[float(value) for value in fitted.fittedvalues.to_numpy()],
                    order=order,
                    seasonal_order=seasonal_order,
                    aic=round(float(fitted.aic), 4),
                    converged=bool(fitted.mle_retvals.get("converged", False)),
                    warnings=[
                        str(item.message)
                        for item in captured
                        if "Too few observations" not in str(item.message)
                    ],
                )

                if best is None or candidate.aic < best.aic:
                    best = candidate
        except Exception as exc:  # noqa: BLE001 - translated to deterministic fallback by caller.
            failures.append(f"{order}{seasonal_order}: {exc}")

    if best is None:
        raise ValueError("; ".join(failures[-3:]) or "No SARIMA candidate converged.")

    return best
