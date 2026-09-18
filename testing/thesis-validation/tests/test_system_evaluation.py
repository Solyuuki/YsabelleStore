import importlib.util
from pathlib import Path

import pandas as pd
import pytest

MODULE_PATH = Path(__file__).resolve().parents[1] / "system_evaluation.py"
SPEC = importlib.util.spec_from_file_location("system_evaluation", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def test_compute_results_uses_actual_ratings_and_threshold():
    df = pd.DataFrame(
        [
            {"respondent_id": "R1", "criterion": "Criterion A", "item": "A1", "rating": 5},
            {"respondent_id": "R1", "criterion": "Criterion B", "item": "B1", "rating": 4},
            {"respondent_id": "R2", "criterion": "Criterion A", "item": "A1", "rating": 4},
            {"respondent_id": "R2", "criterion": "Criterion B", "item": "B1", "rating": 3},
        ]
    )
    bands = [
        MODULE.Band(1.0, 2.99, "Low"),
        MODULE.Band(3.0, 5.0, "Acceptable"),
    ]

    criterion, overall, respondent = MODULE.compute_results(\n        df, bands, 3.0, \"mean_of_criterion_means\"\n    )

    assert float(overall.iloc[0]["mean"]) == pytest.approx(4.0)
    assert overall.iloc[0]["interpretation"] == "Acceptable"
    assert overall.iloc[0]["acceptance_status"] == "PASS"
    assert set(criterion["acceptance_status"]) == {"PASS"}
    assert len(respondent) == 2


def test_load_responses_rejects_out_of_range_rating(tmp_path):
    source = tmp_path / "responses.csv"
    source.write_text(
        "respondent_id,criterion,item,rating\nR1,A,A1,6\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="outside configured scale"):
        MODULE.load_responses(source, 1.0, 5.0)


def test_load_responses_rejects_duplicate_item_response(tmp_path):
    source = tmp_path / "responses.csv"
    source.write_text(
        "respondent_id,criterion,item,rating\n"
        "R1,A,A1,4\n"
        "R1,A,A1,5\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Duplicate"):
        MODULE.load_responses(source, 1.0, 5.0)


def test_table5_summary_reports_criterion_and_overall_status():
    criterion = pd.DataFrame(
        [
            {"criterion": "A", "mean": 4.5, "acceptance_status": "PASS"},
            {"criterion": "B", "mean": 4.0, "acceptance_status": "PASS"},
        ]
    )
    overall = pd.DataFrame(
        [
            {
                "mean": 4.25,
                "interpretation": "Acceptable",
                "acceptance_status": "PASS",
            }
        ]
    )

    table5 = MODULE.build_table5_summary(criterion, overall, 3.0)

    assert table5.iloc[0]["Result"] == "PASS (2/2 criteria met threshold)"
    assert table5.iloc[1]["Result"] == "4.2500 - Acceptable - PASS"
