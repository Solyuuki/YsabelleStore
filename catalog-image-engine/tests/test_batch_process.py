from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


class CatalogImageBatchProcessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.script = Path(__file__).resolve().parents[1] / "app" / "batch.py"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def _clean_product(self, name: str) -> Path:
        source = self.root / name
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((250, 130, 650, 770), fill=(30, 80, 180))
        for y in range(180, 720, 24):
            draw.line((290, y, 610, y), fill=(245, 245, 245), width=5)
        image.save(source)
        return source

    def test_processes_exact_match_jobs_into_isolated_product_directories(self) -> None:
        source = self._clean_product("product.png")
        manifest = self.root / "jobs.json"
        output = self.root / "output"
        summary = self.root / "summary.json"
        manifest.write_text(
            json.dumps(
                [
                    {
                        "productCode": "P001",
                        "fileId": "drive-1",
                        "sourcePath": str(source),
                        "reconciliationStatus": "EXACT_MATCH",
                    }
                ]
            ),
            encoding="utf-8",
        )

        completed = subprocess.run(
            [sys.executable, str(self.script), str(manifest), str(output), str(summary)],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = json.loads(summary.read_text(encoding="utf-8"))
        self.assertEqual(payload["counts"], {"APPROVED": 1, "REJECTED": 0, "PROCESS_ERROR": 0})
        self.assertEqual(payload["results"][0]["productCode"], "P001")
        self.assertEqual(payload["results"][0]["fileId"], "drive-1")
        self.assertEqual(payload["results"][0]["status"], "APPROVED")
        self.assertTrue((output / "P001" / "processed.webp").is_file())
        self.assertTrue((output / "P001" / "card.webp").is_file())
        self.assertTrue((output / "P001" / "pdp.webp").is_file())

    def test_rejects_non_exact_reconciliation_jobs_before_processing(self) -> None:
        source = self._clean_product("review.png")
        manifest = self.root / "jobs.json"
        output = self.root / "output"
        summary = self.root / "summary.json"
        manifest.write_text(
            json.dumps(
                [
                    {
                        "productCode": "P003",
                        "fileId": "drive-review",
                        "sourcePath": str(source),
                        "reconciliationStatus": "NEEDS_REVIEW",
                    }
                ]
            ),
            encoding="utf-8",
        )

        completed = subprocess.run(
            [sys.executable, str(self.script), str(manifest), str(output), str(summary)],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertNotEqual(completed.returncode, 0)
        self.assertFalse(summary.exists())
        self.assertFalse((output / "P003").exists())
        self.assertIn("EXACT_MATCH", completed.stderr)

    def test_records_a_bad_source_as_process_error_without_aborting_other_jobs(self) -> None:
        good = self._clean_product("good.png")
        manifest = self.root / "jobs.json"
        output = self.root / "output"
        summary = self.root / "summary.json"
        manifest.write_text(
            json.dumps(
                [
                    {
                        "productCode": "P001",
                        "fileId": "good-id",
                        "sourcePath": str(good),
                        "reconciliationStatus": "EXACT_MATCH",
                    },
                    {
                        "productCode": "P002",
                        "fileId": "missing-id",
                        "sourcePath": str(self.root / "missing.png"),
                        "reconciliationStatus": "EXACT_MATCH",
                    },
                ]
            ),
            encoding="utf-8",
        )

        completed = subprocess.run(
            [sys.executable, str(self.script), str(manifest), str(output), str(summary)],
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        payload = json.loads(summary.read_text(encoding="utf-8"))
        self.assertEqual(payload["counts"]["APPROVED"], 1)
        self.assertEqual(payload["counts"]["PROCESS_ERROR"], 1)
        by_code = {item["productCode"]: item for item in payload["results"]}
        self.assertEqual(by_code["P002"]["status"], "PROCESS_ERROR")
        self.assertIn("existing file", by_code["P002"]["error"])


if __name__ == "__main__":
    unittest.main()
