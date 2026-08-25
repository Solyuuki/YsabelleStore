from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


class CatalogImageAutoReviewTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.script = Path(__file__).resolve().parents[1] / "app" / "main.py"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def run_engine(self, source: Path) -> dict:
        output = self.root / f"output-{source.stem}"
        completed = subprocess.run(
            [sys.executable, str(self.script)],
            input=json.dumps({"sourcePath": str(source), "outputDirectory": str(output)}),
            capture_output=True,
            check=False,
            text=True,
        )
        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        result["_output"] = output
        return result

    def test_repairable_source_framing_is_auto_approved_after_normalization(self) -> None:
        source = self.root / "small-in-frame.png"
        image = Image.new("RGB", (1800, 1800), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((650, 280, 1150, 1520), fill=(25, 55, 120))
        for y in range(360, 1460, 44):
            draw.line((700, y, 1100, y), fill=(245, 245, 245), width=10)
        image.save(source)

        result = self.run_engine(source)

        self.assertEqual(result["status"], "APPROVED")
        self.assertNotIn(
            "PRODUCT_TOO_SMALL_IN_FRAME",
            {item["code"] for item in result["diagnostics"]},
        )
        self.assertTrue((result["_output"] / "processed.webp").is_file())

    def test_unresolved_post_optimization_warning_is_auto_rejected(self) -> None:
        source = self.root / "medium-resolution.png"
        image = Image.new("RGB", (300, 420), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((80, 60, 220, 360), fill=(30, 80, 180))
        for y in range(100, 340, 24):
            draw.line((95, y, 205, y), fill=(245, 245, 245), width=5)
        image.save(source)

        result = self.run_engine(source)

        self.assertEqual(result["status"], "REJECTED")
        self.assertNotEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn(
            "PDP_RESOLUTION_LOW",
            {item["code"] for item in result["diagnostics"]},
        )
        self.assertTrue((result["_output"] / "processed.webp").is_file())


if __name__ == "__main__":
    unittest.main()
