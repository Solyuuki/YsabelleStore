from __future__ import annotations

import json
import sys
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parents[1]
if str(ENGINE_ROOT) not in sys.path:
    sys.path.insert(0, str(ENGINE_ROOT))

from ciqe.normalize import normalize_image_path
from ciqe.quality import analyze_image_path


def invalid_request(message: str) -> int:
    print(f"INVALID_REQUEST: {message}", file=sys.stderr)
    return 2


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return invalid_request("stdin must contain one JSON object")

    if not isinstance(payload, dict):
        return invalid_request("request must be a JSON object")

    source_path = payload.get("sourcePath")
    output_directory = payload.get("outputDirectory")

    if not isinstance(source_path, str) or not source_path.strip():
        return invalid_request("sourcePath is required")
    if not isinstance(output_directory, str) or not output_directory.strip():
        return invalid_request("outputDirectory is required")

    source = Path(source_path)
    if not source.is_file():
        return invalid_request("sourcePath must reference an existing file")

    result = analyze_image_path(source)
    diagnostic_codes = {item["code"] for item in result["diagnostics"]}
    blocking_codes = {"DECODE_FAILED", "PIXEL_LIMIT_EXCEEDED"}

    if not diagnostic_codes.intersection(blocking_codes):
        normalized = normalize_image_path(source, Path(output_directory))
        result.update(normalized)

    json.dump(result, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
