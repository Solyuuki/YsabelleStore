from __future__ import annotations

from statistics import mean


def seasonal_naive(values: list[float], horizon: int, seasonal_period: int) -> list[float]:
    if len(values) >= seasonal_period:
        last_season = values[-seasonal_period:]
        return [float(last_season[index % seasonal_period]) for index in range(horizon)]

    return moving_average(values, horizon)


def moving_average(values: list[float], horizon: int, window: int = 3) -> list[float]:
    if not values:
        return [0.0 for _ in range(horizon)]

    source = values[-window:] if len(values) >= window else values
    value = float(mean(source))

    return [value for _ in range(horizon)]
