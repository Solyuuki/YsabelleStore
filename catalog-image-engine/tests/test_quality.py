from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageFilter, ImageDraw

from ciqe.quality import analyze_image_path


class CatalogImageQualityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def save(self, name: str, image: Image.Image) -> Path:
        path = self.root / name
        image.save(path)
        return path

    def test_rejects_undecodable_image_without_crashing_the_contract(self) -> None:
        path = self.root / "broken.png"
        path.write_bytes(b"not-an-image")

        result = analyze_image_path(path)

        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("DECODE_FAILED", diagnostic_codes(result))

    def test_rejects_tiny_source_that_cannot_support_catalog_use(self) -> None:
        path = self.save("tiny.png", Image.new("RGB", (80, 140), "white"))

        result = analyze_image_path(path)

        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("RESOLUTION_TOO_LOW", diagnostic_codes(result))

    def test_marks_medium_resolution_source_for_review_instead_of_fake_upscaling(self) -> None:
        image = Image.new("RGB", (300, 420), "white")
        ImageDraw.Draw(image).rectangle((80, 60, 220, 360), fill=(30, 80, 180))
        path = self.save("medium.png", image)

        result = analyze_image_path(path)

        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn("PDP_RESOLUTION_LOW", diagnostic_codes(result))

    def test_flags_product_that_is_too_small_inside_large_blank_canvas(self) -> None:
        image = Image.new("RGB", (700, 700), "white")
        ImageDraw.Draw(image).rectangle((315, 270, 385, 430), fill=(25, 55, 120))
        path = self.save("small-product.png", image)

        result = analyze_image_path(path)

        self.assertIn("PRODUCT_TOO_SMALL_IN_FRAME", diagnostic_codes(result))
        self.assertLess(result["metrics"]["foregroundOccupancy"], 0.20)

    def test_flags_likely_crop_when_foreground_touches_safe_frame_margin(self) -> None:
        image = Image.new("RGB", (700, 700), "white")
        ImageDraw.Draw(image).rectangle((0, 100, 360, 600), fill=(30, 70, 150))
        path = self.save("edge-touching.png", image)

        result = analyze_image_path(path)

        self.assertIn("LIKELY_CROP_RISK", diagnostic_codes(result))
        self.assertTrue(result["metrics"]["touchesSafeMargin"])

    def test_flags_blurred_source_using_deterministic_sharpness_proxy(self) -> None:
        image = Image.new("RGB", (700, 700), "white")
        draw = ImageDraw.Draw(image)
        for x in range(120, 580, 12):
            draw.line((x, 100, x, 600), fill="black", width=5)
        blurred = image.filter(ImageFilter.GaussianBlur(radius=10))
        path = self.save("blurred.png", blurred)

        result = analyze_image_path(path)

        self.assertIn("BLUR_RISK", diagnostic_codes(result))

    def test_flags_busy_background_when_subject_bounds_are_not_trustworthy(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        for index in range(0, 900, 24):
            color = (45, 90, 165) if (index // 24) % 2 == 0 else (225, 175, 65)
            draw.rectangle((index, 0, min(index + 23, 899), 899), fill=color)
        draw.rectangle((280, 150, 620, 750), fill=(30, 30, 30))
        path = self.save("busy-background.png", image)

        result = analyze_image_path(path)

        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn("BACKGROUND_COMPLEXITY_RISK", diagnostic_codes(result))
        self.assertIsNone(result["metrics"]["foregroundOccupancy"])

    def test_flags_periodic_busy_edges_even_when_one_edge_color_dominates_the_median(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        for index in range(0, 900, 20):
            color = (40, 90, 170) if (index // 20) % 2 == 0 else (230, 180, 60)
            draw.rectangle((index, 0, min(index + 19, 899), 899), fill=color)
        draw.rectangle((300, 180, 600, 720), fill=(20, 20, 20))
        path = self.save("aliased-busy-background.png", image)

        result = analyze_image_path(path)

        self.assertEqual(result["status"], "NEEDS_REVIEW")
        self.assertIn("BACKGROUND_COMPLEXITY_RISK", diagnostic_codes(result))
        self.assertIsNone(result["metrics"]["foregroundOccupancy"])

    def test_clean_well_framed_source_can_be_approved(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((250, 130, 650, 770), fill=(30, 80, 180))
        for y in range(180, 720, 24):
            draw.line((290, y, 610, y), fill=(245, 245, 245), width=5)
        path = self.save("clean.png", image)

        result = analyze_image_path(path)

        self.assertEqual(result["status"], "APPROVED")
        self.assertEqual(result["source"]["width"], 900)
        self.assertEqual(result["source"]["height"], 900)


def diagnostic_codes(result: dict) -> set[str]:
    return {diagnostic["code"] for diagnostic in result["diagnostics"]}


if __name__ == "__main__":
    unittest.main()
