from __future__ import annotations

from math import sqrt


def _finite_pairs(actual: list[float], predicted: list[float]) -> list[tuple[float, float]]:
    return [
        (float(left), float(right))
        for left, right in zip(actual, predicted)
        if left == left and right == right
    ]


def calculate_metrics(
    actual: list[float], predicted: list[float], validation_strategy: str
) -> dict[str, float | str | None]:
    pairs = _finite_pairs(actual, predicted)

    if not pairs:
        return {
            "mae": None,
            "rmse": None,
            "mape": None,
            "wape": None,
            "validationStrategy": validation_strategy,
        }

    errors = [predicted_value - actual_value for actual_value, predicted_value in pairs]
    absolute_errors = [abs(value) for value in errors]
    non_zero_percentage_errors = [
        abs(error / actual_value) * 100
        for (actual_value, _), error in zip(pairs, errors)
        if actual_value != 0
    ]
    actual_total = sum(abs(actual_value) for actual_value, _ in pairs)

    return {
        "mae": round(sum(absolute_errors) / len(absolute_errors), 4),
        "rmse": round(sqrt(sum(error * error for error in errors) / len(errors)), 4),
        "mape": round(sum(non_zero_percentage_errors) / len(non_zero_percentage_errors), 4)
        if non_zero_percentage_errors
        else None,
        "wape": round((sum(absolute_errors) / actual_total) * 100, 4)
        if actual_total > 0
        else None,
        "validationStrategy": validation_strategy,
    }
