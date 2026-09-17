from __future__ import annotations

from datetime import UTC, datetime

from .contracts import ProductSeries


def expected_periods(start_year: int = 2024, years: int = 2) -> list[str]:
    return [
        f"{year}-{month:02d}"
        for year in range(start_year, start_year + years)
        for month in range(1, 13)
    ]


def forecast_periods(year: int = 2026, horizon: int = 12) -> list[str]:
    return [f"{year}-{month:02d}" for month in range(1, horizon + 1)]


def parse_month_key(month_key: str) -> tuple[int, int]:
    try:
        year_text, month_text = month_key.split("-")
        year = int(year_text)
        month = int(month_text)
    except (AttributeError, ValueError) as exc:
        raise ValueError(f"Invalid month key: {month_key}") from exc

    if month < 1 or month > 12:
        raise ValueError(f"Invalid month key: {month_key}")

    return year, month


def add_months(month_key: str, months_to_add: int) -> str:
    year, month = parse_month_key(month_key)
    month_index = year * 12 + (month - 1) + months_to_add
    next_year = month_index // 12
    next_month = (month_index % 12) + 1

    return f"{next_year}-{next_month:02d}"


def month_start_iso(month_key: str) -> str:
    parse_month_key(month_key)
    return f"{month_key}-01"


def months_between(start_month: str, end_month: str) -> int:
    start_year, start_month_number = parse_month_key(start_month)
    end_year, end_month_number = parse_month_key(end_month)

    return (end_year - start_year) * 12 + (end_month_number - start_month_number)


def visible_forecast_periods(start_month: str, horizon: int = 12) -> list[str]:
    return [add_months(start_month, index) for index in range(horizon)]


def validate_product_series(product: ProductSeries) -> tuple[list[float], list[str]]:
    warnings: list[str] = []
    points = product.get("historical", [])

    if not points:
        raise ValueError("Historical series requires at least one completed monthly observation.")

    periods = [point.get("period") for point in points]
    for period in periods:
        if not isinstance(period, str):
            raise ValueError("Historical period must use YYYY-MM format.")
        parse_month_key(period)

    expected = [add_months(periods[0], index) for index in range(len(periods))]
    if periods != expected:
        raise ValueError("Historical series must be chronological, unique, and continuous by month.")

    values: list[float] = []
    for point in points:
        value = point.get("quantitySold")

        if not isinstance(value, (int, float)) or value != value or value < 0:
            raise ValueError("Historical quantity must be finite and non-negative.")

        values.append(float(value))

    if len(values) < 12:
        warnings.append(
            f"Only {len(values)} completed monthly observation(s) are available; a moving-average fallback is required."
        )
    elif len(values) < 24:
        warnings.append(
            f"Only {len(values)} completed monthly observations are available; a seasonal fallback is required until 24 are available."
        )
    elif len(values) == 24:
        warnings.append("Only two seasonal cycles are represented; SARIMA confidence is limited.")

    return values, warnings


def now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
