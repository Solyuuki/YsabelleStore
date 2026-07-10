from __future__ import annotations

from datetime import datetime

from .contracts import ProductSeries


def expected_periods(start_year: int = 2024, years: int = 2) -> list[str]:
    return [
        f"{year}-{month:02d}"
        for year in range(start_year, start_year + years)
        for month in range(1, 13)
    ]


def forecast_periods(year: int = 2026, horizon: int = 12) -> list[str]:
    return [f"{year}-{month:02d}" for month in range(1, horizon + 1)]


def validate_product_series(product: ProductSeries) -> tuple[list[float], list[str]]:
    warnings: list[str] = []
    points = product.get("historical", [])
    periods = [point.get("period") for point in points]

    if periods != expected_periods():
        raise ValueError("Historical series must be continuous from 2024-01 through 2025-12.")

    values: list[float] = []
    for point in points:
        value = point.get("quantitySold")

        if not isinstance(value, (int, float)) or value != value or value < 0:
            raise ValueError("Historical quantity must be finite and non-negative.")

        values.append(float(value))

    if len(values) != 24:
        raise ValueError("Exactly 24 monthly observations are required.")

    warnings.append("Only 24 monthly observations are available; forecasts use a limited-data model.")
    warnings.append("Only two seasonal cycles are represented.")

    return values, warnings


def now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
