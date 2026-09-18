from __future__ import annotations

import os
import warnings
from dataclasses import dataclass
from math import isfinite
from time import monotonic
from typing import Callable

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
    # Seasonal-naive-equivalent SARIMA baseline. This is especially important
    # when only a little more than one annual cycle is available for fitting.
    ((0, 0, 0), (0, 1, 0)),
    # Low-complexity annual-seasonal alternatives.
    ((1, 0, 0), (0, 1, 0)),
    ((0, 0, 1), (0, 1, 0)),
    ((1, 0, 1), (0, 1, 0)),
    ((0, 1, 0), (0, 1, 0)),
    # Original production candidate family retained for continuity.
    ((0, 1, 1), (0, 1, 1)),
    ((1, 1, 0), (0, 1, 1)),
    ((1, 0, 0), (1, 0, 0)),
)
DEFAULT_FIT_TIMEOUT_SECONDS = 8.0
MIN_FIT_TIMEOUT_SECONDS = 0.5
MAX_FIT_TIMEOUT_SECONDS = 60.0


def _fit_timeout_seconds() -> float:
    raw = os.getenv("SARIMA_FIT_TIMEOUT_SECONDS", str(DEFAULT_FIT_TIMEOUT_SECONDS))
    try:
        timeout = float(raw)
    except ValueError:
        timeout = DEFAULT_FIT_TIMEOUT_SECONDS

    return max(MIN_FIT_TIMEOUT_SECONDS, min(timeout, MAX_FIT_TIMEOUT_SECONDS))


def _deadline_callback(deadline: float) -> Callable[[np.ndarray], None]:
    def callback(_parameters: np.ndarray) -> None:
        if monotonic() >= deadline:
            raise TimeoutError("SARIMA fitting exceeded the per-product time budget.")

    return callback


def _clean_interval(values: np.ndarray) -> list[float | None]:
    cleaned: list[float | None] = []

    for value in values:
        numeric = float(value)
        cleaned.append(round(max(0.0, numeric), 4) if isfinite(numeric) else None)

    return cleaned


def _fit_candidate(
    series: pd.Series,
    horizon: int,
    order: tuple[int, int, int],
    seasonal_order: tuple[int, int, int, int],
    deadline: float,
) -> SarimaResult:
    if monotonic() >= deadline:
        raise TimeoutError("SARIMA fitting exceeded the per-product time budget.")

    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        model = SARIMAX(
            series,
            order=order,
            seasonal_order=seasonal_order,
            enforce_stationarity=False,
            enforce_invertibility=False,
        )
        fitted = model.fit(
            disp=False,
            maxiter=40,
            callback=_deadline_callback(deadline),
        )

        if monotonic() >= deadline:
            raise TimeoutError("SARIMA fitting exceeded the per-product time budget.")

        predicted = fitted.get_forecast(steps=horizon)
        mean_values = [float(value) for value in predicted.predicted_mean.to_numpy()]

        if not all(isfinite(value) for value in mean_values):
            raise ValueError("SARIMA produced a non-finite forecast.")

        interval = predicted.conf_int(alpha=0.2).to_numpy()
        return SarimaResult(
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


def fit_sarima(
    values: list[float],
    horizon: int,
    seasonal_period: int,
    start_period: str = "2024-01",
    preferred_order: tuple[int, int, int] | None = None,
    preferred_seasonal_order: tuple[int, int, int, int] | None = None,
) -> SarimaResult:
    if len(values) < 24:
        raise ValueError("SARIMA requires at least 24 completed monthly observations.")

    series = pd.Series(
        values,
        index=pd.period_range(start=start_period, periods=len(values), freq="M").to_timestamp(),
        dtype="float64",
    )
    best: SarimaResult | None = None
    failures: list[str] = []
    attempted_preferred: tuple[tuple[int, int, int], tuple[int, int, int, int]] | None = None
    deadline = monotonic() + _fit_timeout_seconds()

    if (
        preferred_order is not None
        and preferred_seasonal_order is not None
        and preferred_seasonal_order[3] == seasonal_period
    ):
        attempted_preferred = (preferred_order, preferred_seasonal_order)
        try:
            preferred = _fit_candidate(
                series,
                horizon,
                preferred_order,
                preferred_seasonal_order,
                deadline,
            )
            if preferred.converged:
                return preferred
            best = preferred
        except Exception as exc:  # noqa: BLE001 - fall through to candidate search.
            failures.append(f"{preferred_order}{preferred_seasonal_order}: {exc}")

    for order, seasonal in CANDIDATES:
        seasonal_order = (seasonal[0], seasonal[1], seasonal[2], seasonal_period)

        if attempted_preferred == (order, seasonal_order):
            continue

        try:
            candidate = _fit_candidate(series, horizon, order, seasonal_order, deadline)
            if best is None or candidate.aic < best.aic:
                best = candidate
        except Exception as exc:  # noqa: BLE001 - translated to deterministic fallback by caller.
            failures.append(f"{order}{seasonal_order}: {exc}")

    if best is None:
        raise ValueError("; ".join(failures[-3:]) or "No SARIMA candidate converged.")

    return best
