from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


class CatalogImageProcessContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)
        self.script = Path(__file__).resolve().parents[1] / "app" / "main.py"

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def test_decode_failure_is_a_normal_quality_result_not_process_failure(self) -> None:
        source = self.root / "broken.png"
        source.write_bytes(b"not-an-image")
        output = self.root / "output"

        completed = subprocess.run(
            [sys.executable, str(self.script)],
            input=json.dumps({"sourcePath": str(source), "outputDirectory": str(output)}),
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("DECODE_FAILED", {item["code"] for item in result["diagnostics"]})
        self.assertNotIn("variants", result)

    def test_decodeable_source_generates_processed_card_and_pdp_variants(self) -> None:
        source = self.root / "product.png"
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((250, 130, 650, 770), fill=(30, 80, 180))
        for y in range(180, 720, 24):
            draw.line((290, y, 610, y), fill=(245, 245, 245), width=5)
        image.save(source)
        output = self.root / "output"

        completed = subprocess.run(
            [sys.executable, str(self.script)],
            input=json.dumps({"sourcePath": str(source), "outputDirectory": str(output)}),
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertEqual(completed.returncode, 0, completed.stderr)
        result = json.loads(completed.stdout)
        self.assertEqual(result["status"], "APPROVED")
        self.assertEqual(result["variants"]["card"]["fileName"], "card.webp")
        self.assertEqual(result["variants"]["pdp"]["fileName"], "pdp.webp")
        self.assertTrue((output / "processed.webp").is_file())
        self.assertTrue((output / "card.webp").is_file())
        self.assertTrue((output / "pdp.webp").is_file())

    def test_invalid_process_request_fails_without_emitting_fake_result(self) -> None:
        completed = subprocess.run(
            [sys.executable, str(self.script)],
            input=json.dumps({"outputDirectory": str(self.root / "output")}),
            capture_output=True,
            check=False,
            text=True,
        )

        self.assertNotEqual(completed.returncode, 0)
        self.assertEqual(completed.stdout.strip(), "")
        self.assertIn("INVALID_REQUEST", completed.stderr)


if __name__ == "__main__":
    unittest.main()
