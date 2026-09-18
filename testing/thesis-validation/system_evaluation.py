#!/usr/bin/env python3
"""Compute thesis System Evaluation results from evaluator responses.

This script intentionally does not invent criteria, rating scales, interpretation
bands, or pass thresholds. Those values must come from the approved System
Evaluation Tool and its scoring guide.

Input CSV columns:
    respondent_id, criterion, item, rating

Config JSON fields:
    configured: true
    scale_min: number
    scale_max: number
    acceptance_threshold: number | null
    overall_method: "mean_of_criterion_means" | "mean_of_all_responses"
    interpretation_bands: [
        {"min": number, "max": number, "label": string}
    ]

Outputs:
    criterion_results.csv
    overall_result.csv
    respondent_summary.csv
    table5_summary.csv
    validation_metadata.json
    system_evaluation_report.txt
    figure16_system_evaluation.png
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import pandas as pd

REQUIRED_COLUMNS = ["respondent_id", "criterion", "item", "rating"]


@dataclass(frozen=True)
class Band:
    minimum: float
    maximum: float
    label: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compute criterion-level and overall System Evaluation results."
    )
    parser.add_argument("--input", required=True, help="Evaluator response CSV")
    parser.add_argument("--config", required=True, help="Approved scoring configuration JSON")
    parser.add_argument("--output", required=True, help="Output evidence directory")
    return parser.parse_args()


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(
            f"Configuration file not found: {path}\n"
            "Create it from system_evaluation_config.template.json and copy the exact "
            "rating scale / interpretation guide from the approved evaluation instrument."
        )

    config = json.loads(path.read_text(encoding="utf-8"))
    if config.get("configured") is not True:
        raise ValueError(
            "System evaluation configuration is not finalized. Set configured=true only "
            "after copying the exact approved scale and interpretation rules."
        )

    scale_min = config.get("scale_min")
    scale_max = config.get("scale_max")
    if not isinstance(scale_min, (int, float)) or not isinstance(scale_max, (int, float)):
        raise ValueError("scale_min and scale_max must be numeric.")
    if scale_min >= scale_max:
        raise ValueError("scale_min must be less than scale_max.")

    overall_method = config.get("overall_method")
    if overall_method not in {"mean_of_criterion_means", "mean_of_all_responses"}:
        raise ValueError(
            "overall_method must be 'mean_of_criterion_means' or "
            "'mean_of_all_responses', matching the approved evaluation method."
        )

    threshold = config.get("acceptance_threshold")
    if threshold is not None:
        if not isinstance(threshold, (int, float)):
            raise ValueError("acceptance_threshold must be numeric or null.")
        if not scale_min <= threshold <= scale_max:
            raise ValueError("acceptance_threshold must fall inside the configured scale.")

    bands_raw = config.get("interpretation_bands", [])
    if not isinstance(bands_raw, list) or not bands_raw:
        raise ValueError(
            "interpretation_bands must contain the approved verbal-interpretation ranges."
        )

    for row in bands_raw:
        if not all(k in row for k in ("min", "max", "label")):
            raise ValueError("Each interpretation band requires min, max, and label.")
        if not isinstance(row["min"], (int, float)) or not isinstance(row["max"], (int, float)):
            raise ValueError("Interpretation band min/max values must be numeric.")
        if row["min"] > row["max"]:
            raise ValueError("Interpretation band min cannot exceed max.")
        if not str(row["label"]).strip():
            raise ValueError("Interpretation band label cannot be blank.")

    return config


def load_responses(path: Path, scale_min: float, scale_max: float) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Response file not found: {path}\n"
            "Create it from system_evaluation_responses.template.csv."
        )

    df = pd.read_csv(path)
    missing = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required CSV columns: {', '.join(missing)}")

    df = df[REQUIRED_COLUMNS].copy()
    for col in ("respondent_id", "criterion", "item"):
        df[col] = df[col].astype(str).str.strip()
        if (df[col] == "").any():
            raise ValueError(f"Blank values found in required column: {col}")

    df["rating"] = pd.to_numeric(df["rating"], errors="coerce")
    if df["rating"].isna().any():
        bad_rows = (df.index[df["rating"].isna()] + 2).tolist()
        raise ValueError(f"Non-numeric or missing rating at CSV row(s): {bad_rows}")

    invalid = df[(df["rating"] < scale_min) | (df["rating"] > scale_max)]
    if not invalid.empty:
        rows = (invalid.index + 2).tolist()
        raise ValueError(
            f"Rating outside configured scale [{scale_min}, {scale_max}] "
            f"at CSV row(s): {rows}"
        )

    duplicate_mask = df.duplicated(
        subset=["respondent_id", "criterion", "item"], keep=False
    )
    if duplicate_mask.any():
        rows = (df.index[duplicate_mask] + 2).tolist()
        raise ValueError(
            "Duplicate respondent/criterion/item response detected at CSV row(s): "
            f"{rows}"
        )

    return df


def parse_bands(config: dict[str, Any]) -> list[Band]:
    return [
        Band(float(row["min"]), float(row["max"]), str(row["label"]).strip())
        for row in config["interpretation_bands"]
    ]


def interpret(value: float, bands: list[Band]) -> str:
    ordered = sorted(bands, key=lambda b: (b.minimum, b.maximum))
    for index, band in enumerate(ordered):
        is_last = index == len(ordered) - 1
        if is_last:
            matches = band.minimum <= value <= band.maximum
        else:
            # Adjacent interpretation bands share a boundary. The lower band uses an
            # exclusive upper bound and the next band owns the shared boundary.
            matches = band.minimum <= value < band.maximum
        if matches:
            return band.label

    raise ValueError(
        f"Score {value:.6f} did not match any interpretation band. "
        "Check the approved configuration for gaps or an out-of-range value."
    )


def validate_band_coverage(scale_min: float, scale_max: float, bands: list[Band]) -> None:
    ordered = sorted(bands, key=lambda b: (b.minimum, b.maximum))
    if not ordered:
        raise ValueError("At least one interpretation band is required.")

    tolerance = 1e-9
    if abs(ordered[0].minimum - scale_min) > tolerance:
        raise ValueError("The first interpretation band must start at scale_min.")
    if abs(ordered[-1].maximum - scale_max) > tolerance:
        raise ValueError("The last interpretation band must end at scale_max.")

    for band in ordered:
        if band.minimum < scale_min - tolerance or band.maximum > scale_max + tolerance:
            raise ValueError("Interpretation bands must stay inside the configured rating scale.")

    for previous, current in zip(ordered, ordered[1:]):
        if current.minimum > previous.maximum + tolerance:
            raise ValueError(
                "Interpretation bands contain a gap: "
                f"{previous.label} ends at {previous.maximum} but "
                f"{current.label} starts at {current.minimum}."
            )
        if current.minimum < previous.maximum - tolerance:
            raise ValueError(
                "Interpretation bands overlap: "
                f"{previous.label} [{previous.minimum}, {previous.maximum}) and "
                f"{current.label} [{current.minimum}, {current.maximum})."
            )


def compute_results(
    df: pd.DataFrame,
    bands: list[Band],
    threshold: float | None,
    overall_method: str,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    criterion = (
        df.groupby("criterion", sort=False)["rating"]
        .agg(response_count="count", mean="mean", std_dev="std")
        .reset_index()
    )
    criterion["std_dev"] = criterion["std_dev"].fillna(0.0)
    criterion["interpretation"] = criterion["mean"].map(lambda x: interpret(float(x), bands))
    if threshold is None:
        criterion["acceptance_status"] = "NOT EVALUATED"
    else:
        criterion["acceptance_status"] = criterion["mean"].map(
            lambda x: "PASS" if float(x) >= threshold else "FAIL"
        )

    if overall_method == "mean_of_criterion_means":
        overall_mean = float(criterion["mean"].mean())
    elif overall_method == "mean_of_all_responses":
        overall_mean = float(df["rating"].mean())
    else:
        raise ValueError(f"Unsupported overall_method: {overall_method}")

    overall = pd.DataFrame(
        [
            {
                "respondents": int(df["respondent_id"].nunique()),
                "criteria": int(df["criterion"].nunique()),
                "items": int(df[["criterion", "item"]].drop_duplicates().shape[0]),
                "responses": int(len(df)),
                "overall_method": overall_method,
                "mean": overall_mean,
                "interpretation": interpret(overall_mean, bands),
                "acceptance_status": (
                    "NOT EVALUATED"
                    if threshold is None
                    else ("PASS" if overall_mean >= threshold else "FAIL")
                ),
            }
        ]
    )

    respondent = (
        df.groupby("respondent_id", sort=False)["rating"]
        .agg(response_count="count", mean="mean")
        .reset_index()
    )
    respondent["interpretation"] = respondent["mean"].map(
        lambda x: interpret(float(x), bands)
    )

    return criterion, overall, respondent


def build_table5_summary(
    criterion: pd.DataFrame,
    overall: pd.DataFrame,
    threshold: float | None,
) -> pd.DataFrame:
    if threshold is None:
        criteria_result = "NOT EVALUATED - no approved acceptance threshold configured"
    else:
        passed = int((criterion["acceptance_status"] == "PASS").sum())
        total = int(len(criterion))
        criteria_result = (
            f"PASS ({passed}/{total} criteria met threshold)"
            if passed == total
            else f"FAIL ({passed}/{total} criteria met threshold)"
        )

    overall_row = overall.iloc[0]
    overall_result = (
        f"{float(overall_row['mean']):.4f} - "
        f"{overall_row['interpretation']} - "
        f"{overall_row['acceptance_status']}"
    )

    return pd.DataFrame(
        [
            {
                "Evaluation Item": "Evaluation criteria",
                "Basis": "System Evaluation Tool criteria",
                "Result": criteria_result,
            },
            {
                "Evaluation Item": "Overall system evaluation",
                "Basis": "Combined criterion-level evaluation",
                "Result": overall_result,
            },
        ]
    )


def save_figure(criterion: pd.DataFrame, overall: pd.DataFrame, output: Path) -> None:
    labels = criterion["criterion"].tolist() + ["Overall"]
    values = criterion["mean"].tolist() + [float(overall.iloc[0]["mean"])]

    fig, ax = plt.subplots(figsize=(max(8.0, len(labels) * 1.45), 5.2))
    bars = ax.bar(labels, values)
    ax.set_title("Summary of System Evaluation Results")
    ax.set_ylabel("Mean rating")
    ax.tick_params(axis="x", rotation=25)

    for bar, value in zip(bars, values):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height(),
            f"{value:.4f}",
            ha="center",
            va="bottom",
        )

    fig.tight_layout()
    fig.savefig(output / "figure16_system_evaluation.png", dpi=180)
    plt.close(fig)


def save_report(
    criterion: pd.DataFrame,
    overall: pd.DataFrame,
    config: dict[str, Any],
    output: Path,
) -> None:
    threshold = config.get("acceptance_threshold")
    evaluation_source = config.get("evaluation_source")
    reviewer_id = config.get("reviewer_id")
    independence_status = config.get("independence_status")
    lines = [
        "YSABELLE STORE - SYSTEM EVALUATION",
        "===================================",
        "",
    ]
    if evaluation_source:
        lines.append(f"Evaluation source: {evaluation_source}")
    if reviewer_id:
        lines.append(f"Reviewer ID: {reviewer_id}")
    if independence_status:
        lines.append(f"Independence status: {independence_status}")
    if evaluation_source or reviewer_id or independence_status:
        lines.append("")
    lines += [
        f"Respondents: {int(overall.iloc[0]['respondents'])}",
        f"Evaluation criteria: {int(overall.iloc[0]['criteria'])}",
        f"Evaluation items: {int(overall.iloc[0]['items'])}",
        f"Recorded responses: {int(overall.iloc[0]['responses'])}",
        "",
        "CRITERION-LEVEL RESULTS",
    ]

    for row in criterion.itertuples(index=False):
        lines.append(
            f"- {row.criterion}: mean={row.mean:.4f}; "
            f"interpretation={row.interpretation}; "
            f"status={row.acceptance_status}"
        )

    lines += [
        "",
        "OVERALL SYSTEM EVALUATION",
        f"Mean: {float(overall.iloc[0]['mean']):.4f}",
        f"Interpretation: {overall.iloc[0]['interpretation']}",
        f"Acceptance status: {overall.iloc[0]['acceptance_status']}",
        "",
    ]

    if threshold is None:
        lines += [
            "NOTE:",
            "No acceptance threshold was configured. PASS/FAIL was intentionally not inferred.",
        ]
    else:
        lines += [
            f"Configured acceptance threshold: {float(threshold):.4f}",
            "PASS/FAIL is based only on the threshold supplied from the approved evaluation tool.",
        ]

    (output / "system_evaluation_report.txt").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def run_evaluation(args: argparse.Namespace) -> int:
    input_path = Path(args.input).resolve()
    config_path = Path(args.config).resolve()
    output = Path(args.output).resolve()
    output.mkdir(parents=True, exist_ok=True)

    config = load_config(config_path)
    scale_min = float(config["scale_min"])
    scale_max = float(config["scale_max"])
    bands = parse_bands(config)
    validate_band_coverage(scale_min, scale_max, bands)

    responses = load_responses(input_path, scale_min, scale_max)
    threshold = config.get("acceptance_threshold")
    threshold = float(threshold) if threshold is not None else None

    overall_method = str(config["overall_method"])
    criterion, overall, respondent = compute_results(
        responses, bands, threshold, overall_method
    )
    table5 = build_table5_summary(criterion, overall, threshold)

    criterion.to_csv(output / "criterion_results.csv", index=False, float_format="%.4f")
    overall.to_csv(output / "overall_result.csv", index=False, float_format="%.4f")
    respondent.to_csv(output / "respondent_summary.csv", index=False, float_format="%.4f")
    table5.to_csv(output / "table5_summary.csv", index=False)
    save_figure(criterion, overall, output)
    save_report(criterion, overall, config, output)

    metadata = {
        "status": "COMPLETE",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input": str(input_path),
        "config": str(config_path),
        "scale_min": scale_min,
        "scale_max": scale_max,
        "acceptance_threshold": threshold,
        "overall_method": overall_method,
        "evaluation_source": config.get("evaluation_source"),
        "reviewer_id": config.get("reviewer_id"),
        "independence_status": config.get("independence_status"),
        "respondents": int(overall.iloc[0]["respondents"]),
        "criteria": int(overall.iloc[0]["criteria"]),
        "items": int(overall.iloc[0]["items"]),
        "responses": int(overall.iloc[0]["responses"]),
        "overall_mean": round(float(overall.iloc[0]["mean"]), 4),
        "overall_interpretation": str(overall.iloc[0]["interpretation"]),
        "overall_acceptance_status": str(overall.iloc[0]["acceptance_status"]),
    }
    (output / "validation_metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )

    print("YSABELLE STORE - SYSTEM EVALUATION")
    print("===================================")
    print("Status: COMPLETE")
    if metadata.get("evaluation_source"):
        print(f"Evaluation source: {metadata['evaluation_source']}")
    if metadata.get("reviewer_id"):
        print(f"Reviewer ID: {metadata['reviewer_id']}")
    if metadata.get("independence_status"):
        print(f"Independence status: {metadata['independence_status']}")
    print(f"Respondents: {metadata['respondents']}")
    print(f"Criteria: {metadata['criteria']}")
    print(f"Items: {metadata['items']}")
    print(f"Responses: {metadata['responses']}")
    print(f"Overall mean: {metadata['overall_mean']:.4f}")
    print(f"Interpretation: {metadata['overall_interpretation']}")
    print(f"Acceptance status: {metadata['overall_acceptance_status']}")
    print(f"Evidence directory: {output}")

    if threshold is not None and metadata["overall_acceptance_status"] == "FAIL":
        # Preserve genuine failures. A failing evaluation must never be converted
        # into a passing result by the validation tooling.
        return 2

    return 0


def print_blocked(message: str, args: argparse.Namespace) -> None:
    print("YSABELLE STORE - SYSTEM EVALUATION")
    print("===================================")
    print("Status: BLOCKED - evaluation data/configuration incomplete")
    print("")
    print(message)
    print("")
    print("Required before an actual evaluation can be computed:")
    print("1. Copy the exact approved rating scale and interpretation bands into:")
    print(f"   {Path(args.config)}")
    print("2. Set configured=true only after those rules are complete.")
    print("3. Replace the placeholder row with the actual evaluator responses in:")
    print(f"   {Path(args.input)}")
    print("")
    print("No evaluation score was generated and no PASS/FAIL result was invented.")


def main() -> int:
    args = parse_args()
    try:
        return run_evaluation(args)
    except (
        FileNotFoundError,
        ValueError,
        json.JSONDecodeError,
        pd.errors.EmptyDataError,
        pd.errors.ParserError,
    ) as exc:
        # Configuration/data problems are expected setup states, not Python crashes.
        # Keep the command explicit and readable while returning non-zero so CI or
        # thesis evidence cannot mistake an incomplete evaluation for a pass.
        print_blocked(str(exc), args)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
