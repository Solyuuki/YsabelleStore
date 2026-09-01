from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from ciqe.normalize import normalize_image_path
from ciqe.quality import analyze_image_path


BLOCKING_DIAGNOSTICS = {"DECODE_FAILED", "PIXEL_LIMIT_EXCEEDED"}
VALID_RESULT_STATUSES = {"APPROVED", "REJECTED", "PROCESS_ERROR"}


def invalid_request(message: str) -> int:
    print(f"INVALID_REQUEST: {message}", file=sys.stderr)
    return 2


def load_jobs(manifest_path: Path) -> list[dict[str, str]]:
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError(f"batch manifest could not be read: {error}") from error

    if not isinstance(payload, list):
        raise ValueError("batch manifest must contain a JSON array")

    jobs: list[dict[str, str]] = []
    seen_product_codes: set[str] = set()
    for index, raw in enumerate(payload):
        if not isinstance(raw, dict):
            raise ValueError(f"batch job {index} must be a JSON object")

        required = ("productCode", "fileId", "sourcePath", "reconciliationStatus")
        values: dict[str, str] = {}
        for field in required:
            value = raw.get(field)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"batch job {index} requires non-empty {field}")
            values[field] = value.strip()

        if values["reconciliationStatus"] != "EXACT_MATCH":
            raise ValueError(
                f"batch job {values['productCode']} must be EXACT_MATCH before image processing"
            )
        if values["productCode"] in seen_product_codes:
            raise ValueError(f"duplicate productCode in batch manifest: {values['productCode']}")
        seen_product_codes.add(values["productCode"])
        jobs.append(values)

    return jobs


def process_source(source: Path, output_directory: Path) -> dict[str, Any]:
    if not source.is_file():
        raise FileNotFoundError("sourcePath must reference an existing file")

    source_result = analyze_image_path(source)
    diagnostic_codes = {item["code"] for item in source_result["diagnostics"]}
    if diagnostic_codes.intersection(BLOCKING_DIAGNOSTICS):
        return source_result

    normalized = normalize_image_path(source, output_directory)
    post_optimization = analyze_image_path(output_directory / "processed.webp")
    result: dict[str, Any] = {
        "status": "APPROVED" if post_optimization["status"] == "APPROVED" else "REJECTED",
        "source": source_result["source"],
        "diagnostics": post_optimization["diagnostics"],
        "metrics": post_optimization["metrics"],
    }
    result.update(normalized)
    return result


def run_batch(jobs: list[dict[str, str]], output_root: Path) -> dict[str, Any]:
    counts = {"APPROVED": 0, "REJECTED": 0, "PROCESS_ERROR": 0}
    results: list[dict[str, Any]] = []

    for job in jobs:
        product_code = job["productCode"]
        product_output = output_root / product_code
        try:
            result = process_source(Path(job["sourcePath"]), product_output)
            status = result.get("status")
            if status not in VALID_RESULT_STATUSES - {"PROCESS_ERROR"}:
                raise RuntimeError(f"unexpected image engine status: {status}")
            counts[status] += 1
            results.append(
                {
                    "productCode": product_code,
                    "fileId": job["fileId"],
                    "sourcePath": job["sourcePath"],
                    "status": status,
                    "diagnostics": result.get("diagnostics", []),
                    "metrics": result.get("metrics"),
                    "variants": result.get("variants"),
                    "subjectDetection": result.get("subjectDetection"),
                    "orientedSource": result.get("orientedSource"),
                    "upscaleFactor": result.get("upscaleFactor"),
                }
            )
        except Exception as error:
            counts["PROCESS_ERROR"] += 1
            results.append(
                {
                    "productCode": product_code,
                    "fileId": job["fileId"],
                    "sourcePath": job["sourcePath"],
                    "status": "PROCESS_ERROR",
                    "error": str(error),
                }
            )

    return {"counts": counts, "results": results}


def main() -> int:
    if len(sys.argv) != 4:
        return invalid_request("usage: batch.py <jobs.json> <output-directory> <summary.json>")

    manifest_path = Path(sys.argv[1])
    output_root = Path(sys.argv[2])
    summary_path = Path(sys.argv[3])

    try:
        jobs = load_jobs(manifest_path)
    except ValueError as error:
        return invalid_request(str(error))

    summary = run_batch(jobs, output_root)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary["counts"], separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
