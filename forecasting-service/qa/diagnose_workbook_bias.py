"""Read-only diagnostics: compare seasonal, moving-average and growth-aware benchmarks.

Reads ONLY the canonical 2024/2025 historical workbook exporter JSON from stdin.
No database/API connections and no persisted model, inventory, or order writes.
Never trains on the held-out month. Alternative forecasts are QA candidates ONLY.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from math import isfinite
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.preprocessing import add_months  # noqa: E402


def benchmark(train: list[float]) -> dict[str, float]:
    if len(train) < 15:
        raise ValueError("Insufficient historical data for paired annual growth comparison.")
    seasonal = float(train[-12])
    recent_mean = sum(train[-3:]) / 3
    previous_year_same_3mo = sum(train[-15:-12])
    current_year_same_3mo = sum(train[-3:])
    # Conservative bounded factor purely for comparison; NOT a release/procurement policy.
    if previous_year_same_3mo == 0:
        growth_factor = 1.0
    else:
        growth_factor = max(0.75, min(1.25, current_year_same_3mo / previous_year_same_3mo))
    return {
        "seasonalNaive": seasonal,
        "recent3MonthMean": recent_mean,
        "growthAdjustedSeasonal": seasonal * growth_factor,
    }


def metrics(rows: list[dict], key: str) -> dict:
    if not rows:
        return {"count": 0, "wapePercent": None, "biasPercent": None, "maeUnits": None}
    total_actual = sum(row["actual"] for row in rows)
    differences = [row[key] - row["actual"] for row in rows]
    count = len(rows)
    return {
        "count": count,
        "wapePercent": round(100 * sum(abs(d) for d in differences) / total_actual, 2)
        if total_actual else None,
        "biasPercent": round(100 * sum(differences) / total_actual, 2)
        if total_actual else None,
        "maeUnits": round(sum(abs(d) for d in differences) / count, 4),
        "underForecastSharePercent": round(
            100 * sum(1 for d in differences if d < 0) / count, 2
        ),
        "overForecastSharePercent": round(
            100 * sum(1 for d in differences if d > 0) / count, 2
        ),
    }


def diagnose(payload: dict, months: int = 6, max_products: int = 10000) -> dict:
    if payload.get("source") != "CANONICAL_2024_2025_WORKBOOKS":
        raise ValueError("Refusing noncanonical or reconstructed history input")
    products = payload.get("products")
    if not isinstance(products, list) or not products:
        raise ValueError("No historical workbook products supplied")

    rows: list[dict] = []
    invalid: list[dict] = []
    for product in products[:max_products]:
        points = product.get("historical", [])
        expected = [add_months("2024-01", i) for i in range(24)]
        if len(points) != 24 or [point.get("period") for point in points] != expected:
            invalid.append({"productId": product.get("productId"), "problem": "Invalid 2024–2025 monthly continuity"})
            continue
        values = [point.get("quantitySold") for point in points]
        if any(
            not isinstance(value, (int, float)) or not isfinite(float(value)) or value < 0
            for value in values
        ):
            invalid.append({"productId": product.get("productId"), "problem": "Invalid historical sales quantity"})
            continue
        for idx in range(24 - months, 24):
            train = [float(value) for value in values[:idx]]
            target = points[idx]
            # The target is never included in train. All candidates use train-only data.
            predicted = benchmark(train)
            rows.append({
                "productId": product["productId"],
                "period": target["period"],
                "actual": float(target["quantitySold"]),
                **predicted,
            })

    if not rows or invalid:
        raise ValueError(f"Cannot complete diagnostics: {len(rows)} valid folds, {len(invalid)} invalid products")

    methods = ("seasonalNaive", "recent3MonthMean", "growthAdjustedSeasonal")
    month_rows: dict[str, list[dict]] = defaultdict(list)
    product_rows: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        month_rows[row["period"]].append(row)
        product_rows[row["productId"]].append(row)

    monthly = [
        {"period": period, "seasonalNaive": metrics(group, "seasonalNaive"),
         "recent3MonthMean": metrics(group, "recent3MonthMean"),
         "growthAdjustedSeasonal": metrics(group, "growthAdjustedSeasonal")}
        for period, group in sorted(month_rows.items())
    ]
    worst_products = sorted(
        (
            {
                "productId": product_id,
                "seasonalNaive": metrics(group, "seasonalNaive"),
                "recent3MonthMean": metrics(group, "recent3MonthMean"),
                "growthAdjustedSeasonal": metrics(group, "growthAdjustedSeasonal"),
            }
            for product_id, group in product_rows.items()
        ),
        key=lambda item: -(item["seasonalNaive"]["maeUnits"] or 0),
    )[:15]

    return {
        "kind": "YSABELLE_QA_BIAS_DIAGNOSTICS",
        "source": payload["source"],
        "dataProvenance": "Workbook values NOT independently verified against POS",
        "products": len(product_rows),
        "folds": len(rows),
        "periods": sorted(month_rows),
        "aggregate": {name: metrics(rows, name) for name in methods},
        "monthly": monthly,
        "worstProductsBySeasonalNaiveMAE": worst_products,
        "recommendation": (
            "Do not change production demand formula from this report alone. "
            "Compare historical workbook values with verified transactional sales, "
            "obtain actual held-out 2026 months for SARIMA, and enforce procurement risk limits."
        ),
        "releaseStatus": "NOT_CERTIFIED",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--months", type=int, default=6)
    parser.add_argument("--max-products", type=int, default=10000)
    args = parser.parse_args()
    if not 1 <= args.months <= 9:
        parser.error("--months must be 1..9 so matched growth history is available")
    if not 1 <= args.max_products <= 10000:
        parser.error("--max-products must be 1..10000")

    report = diagnose(json.load(sys.stdin), args.months, args.max_products)
    json.dump(report, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
