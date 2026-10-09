"""Read-only rolling-origin accuracy QA using the production forecasting function.

Input: JSON piped from qaRecommenderExportHistory.ts (2024-2025 workbooks).
No MySQL connection, no fixture insertion, no forecast cache writes.
Only completed held-out months are compared to forecasts trained on prior months.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from math import isfinite
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import forecast_product  # noqa: E402
from app.preprocessing import add_months  # noqa: E402


def safe_metrics(rows: list[dict], prediction_key: str) -> dict:
    if not rows:
        return {"observations": 0, "mae": None, "wapePercent": None, "biasPercent": None}
    errors = [float(row[prediction_key]) - float(row["actual"]) for row in rows]
    total_actual = sum(float(row["actual"]) for row in rows)
    return {
        "observations": len(rows),
        "mae": round(mean(abs(error) for error in errors), 4),
        "wapePercent": round(100 * sum(abs(error) for error in errors) / total_actual, 2)
        if total_actual > 0
        else None,
        "biasPercent": round(100 * sum(errors) / total_actual, 2)
        if total_actual > 0
        else None,
    }


def evaluate(payload: dict, *, months: int, max_products: int) -> dict:
    if payload.get("source") != "CANONICAL_2024_2025_WORKBOOKS":
        raise ValueError("Refusing input without verified 2024/2025 workbook source marker.")
    products = payload.get("products")
    if not isinstance(products, list) or not products:
        raise ValueError("No historical products available for a meaningful backtest.")

    rows: list[dict] = []
    models: Counter[str] = Counter()
    errors: list[dict] = []
    evaluated = 0

    for product in products[:max_products]:
        points = product.get("historical", [])
        if len(points) != 24 or points[0]["period"] != "2024-01" or points[-1]["period"] != "2025-12":
            errors.append({"productId": product.get("productId"), "reason": "Expected 24 actual months: 2024-01..2025-12"})
            continue
        expected = [add_months("2024-01", index) for index in range(24)]
        if [point["period"] for point in points] != expected:
            errors.append({"productId": product.get("productId"), "reason": "Missing, duplicated, or unordered historical month"})
            continue

        for index in range(24 - months, 24):
            # Training data is exclusively earlier than the held-out target period.
            train = points[:index]
            target = points[index]
            if len(train) < 12:
                continue

            model_input = {
                "productId": product["productId"],
                "productName": product["productName"],
                "category": product["category"],
                "sellingPrice": product["sellingPrice"],
                "historical": train,
            }
            result = forecast_product(model_input, 1, 12, target["period"])
            forecast = result.get("forecast", [])
            if result.get("status") == "FAILED" or not forecast:
                errors.append({
                    "productId": product["productId"],
                    "period": target["period"],
                    "reason": result.get("error") or "No forecast output"
                })
                continue

            predicted = float(forecast[0]["predictedQuantity"])
            actual = float(target["quantitySold"])
            if not all(isfinite(value) and value >= 0 for value in (predicted, actual)):
                errors.append({"productId": product["productId"], "period": target["period"], "reason": "Non-finite or negative value"})
                continue

            # Historical seasonal-naive comparator; never looks at the target month.
            baseline = float(train[-12]["quantitySold"])
            models[result["model"]] += 1
            rows.append({
                "productId": product["productId"],
                "period": target["period"],
                "model": result["model"],
                "actual": actual,
                "forecast": predicted,
                "seasonalNaive": baseline,
                "absoluteError": round(abs(predicted - actual), 4),
            })

        evaluated += 1

    worst = sorted(rows, key=lambda r: r["absoluteError"], reverse=True)[:10]
    sarima_folds = sum(count for model, count in models.items() if model == "SARIMA")
    return {
        "kind": "YSABELLE_RECOMMENDER_READ_ONLY_BACKTEST",
        "source": payload["source"],
        "periods": [row["period"] for row in rows[:months]],
        "productsExamined": min(len(products), max_products),
        "productsWithValidHistory": evaluated,
        "foldsEvaluated": len(rows),
        "modelsUsed": dict(models),
        "forecastMetrics": safe_metrics(rows, "forecast"),
        "seasonalNaiveBaseline": safe_metrics(rows, "seasonalNaive"),
        "sarimaOutOfSampleValidated": sarima_folds > 0,
        "releaseStatus": "NOT_CERTIFIED",
        "caveat": (
            "2024-2025 provide only 24 months. All held-out 2025 folds train on fewer "
            "than 24 months and therefore test fallback behavior, NOT the SARIMA "
            "model on unseen completed 2026 actuals. These workbooks must also be "
            "reconciled against transactional sales before operational sign-off."
        ),
        "worstAbsoluteErrors": worst,
        "issues": errors[:20],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--months", type=int, default=6, help="Last N held-out 2025 months, 1..12")
    parser.add_argument("--max-products", type=int, default=50, help="Upper limit of products evaluated")
    args = parser.parse_args()
    if not 1 <= args.months <= 12 or not 1 <= args.max_products <= 10000:
        parser.error("--months must be 1..12 and --max-products must be 1..10000")
    payload = json.load(sys.stdin)
    report = evaluate(payload, months=args.months, max_products=args.max_products)
    print(json.dumps(report, indent=2))
    return 0 if report["foldsEvaluated"] > 0 and not report["issues"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
