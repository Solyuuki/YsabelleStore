from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

from ciqe.normalize import normalize_image_path
from ciqe.quality import analyze_image_path


def diagnostic_codes(result: dict) -> set[str]:
    return {item["code"] for item in result["diagnostics"]}


class RepresentativeCatalogImageCorpusTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def save(self, name: str, image: Image.Image) -> Path:
        path = self.root / name
        image.save(path)
        return path

    def assert_variant_integrity(self, path: Path) -> dict:
        output = self.root / f"{path.stem}-output"
        result = normalize_image_path(path, output)

        for file_name in ("processed.webp", "card.webp", "pdp.webp"):
            variant_path = output / file_name
            self.assertTrue(variant_path.is_file(), file_name)
            with Image.open(variant_path) as variant:
                self.assertGreater(variant.width, 0)
                self.assertGreater(variant.height, 0)

        self.assertLessEqual(result["upscaleFactor"]["card"], 1.25)
        self.assertLessEqual(result["upscaleFactor"]["pdp"], 1.25)
        return result

    def test_can_like_product_on_clean_background_is_processable(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle(
            (260, 180, 640, 720),
            radius=55,
            fill=(190, 30, 35),
            outline=(30, 30, 30),
            width=5,
        )
        for y in range(250, 650, 28):
            draw.line((300, y, 600, y), fill=(245, 245, 245), width=4)
        path = self.save("can.png", image)

        result = analyze_image_path(path)

        self.assertNotEqual(result["status"], "REJECTED")
        self.assertNotIn("BACKGROUND_COMPLEXITY_RISK", diagnostic_codes(result))
        self.assert_variant_integrity(path)

    def test_bottle_like_product_uses_detected_subject_bounds(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((370, 120, 530, 230), fill=(50, 120, 210))
        draw.rounded_rectangle((300, 220, 600, 780), radius=110, fill=(50, 120, 210))
        path = self.save("bottle.png", image)

        result = self.assert_variant_integrity(path)

        self.assertEqual(result["subjectDetection"], "detected")

    def test_sachet_like_landscape_product_uses_detected_subject_bounds(self) -> None:
        image = Image.new("RGB", (1000, 700), "white")
        draw = ImageDraw.Draw(image)
        draw.rounded_rectangle((130, 220, 870, 500), radius=25, fill=(165, 45, 180))
        draw.text((430, 330), "SKU", fill="white")
        path = self.save("sachet.png", image)

        result = self.assert_variant_integrity(path)

        self.assertEqual(result["subjectDetection"], "detected")

    def test_box_like_product_uses_detected_subject_bounds(self) -> None:
        image = Image.new("RGB", (800, 1000), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle(
            (220, 180, 580, 820), fill=(240, 170, 40), outline=(60, 60, 60), width=5
        )
        path = self.save("box.png", image)

        result = self.assert_variant_integrity(path)

        self.assertEqual(result["subjectDetection"], "detected")

    def test_low_resolution_product_is_rejected(self) -> None:
        image = Image.new("RGB", (90, 160), "white")
        ImageDraw.Draw(image).rectangle((20, 20, 70, 140), fill=(30, 80, 180))

        result = analyze_image_path(self.save("low-resolution.png", image))

        self.assertEqual(result["status"], "REJECTED")
        self.assertIn("RESOLUTION_TOO_LOW", diagnostic_codes(result))

    def test_blurred_product_is_not_approved(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        for x in range(220, 680, 10):
            draw.line((x, 160, x, 740), fill="black", width=4)
        blurred = image.filter(ImageFilter.GaussianBlur(12))

        result = analyze_image_path(self.save("blurred.png", blurred))

        self.assertNotEqual(result["status"], "APPROVED")
        self.assertIn("BLUR_RISK", diagnostic_codes(result))

    def test_excess_whitespace_is_flagged(self) -> None:
        image = Image.new("RGB", (1200, 1200), "white")
        ImageDraw.Draw(image).rectangle((555, 510, 645, 690), fill=(20, 70, 170))

        result = analyze_image_path(self.save("excess-whitespace.png", image))

        self.assertIn("PRODUCT_TOO_SMALL_IN_FRAME", diagnostic_codes(result))

    def test_edge_clipped_product_is_flagged_and_full_frame_is_preserved(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        ImageDraw.Draw(image).rectangle((0, 160, 500, 740), fill=(20, 70, 170))
        path = self.save("edge-clipped.png", image)

        quality = analyze_image_path(path)
        normalized = self.assert_variant_integrity(path)

        self.assertIn("LIKELY_CROP_RISK", diagnostic_codes(quality))
        self.assertEqual(normalized["subjectDetection"], "preserved-full-frame")

    def test_complex_background_requires_review_and_preserves_full_frame(self) -> None:
        image = Image.new("RGB", (900, 900), "white")
        draw = ImageDraw.Draw(image)
        for index in range(0, 900, 20):
            color = (40, 90, 170) if (index // 20) % 2 == 0 else (230, 180, 60)
            draw.rectangle((index, 0, min(index + 19, 899), 899), fill=color)
        draw.rectangle((300, 180, 600, 720), fill=(20, 20, 20))
        path = self.save("complex-background.png", image)

        quality = analyze_image_path(path)
        normalized = self.assert_variant_integrity(path)

        self.assertEqual(quality["status"], "NEEDS_REVIEW")
        self.assertIn("BACKGROUND_COMPLEXITY_RISK", diagnostic_codes(quality))
        self.assertEqual(normalized["subjectDetection"], "preserved-full-frame")

    def test_transparent_packshot_uses_alpha_bounds(self) -> None:
        image = Image.new("RGBA", (900, 900), (0, 0, 0, 0))
        ImageDraw.Draw(image).rounded_rectangle(
            (250, 160, 650, 740), radius=40, fill=(30, 120, 190, 255)
        )
        path = self.save("transparent.png", image)

        result = self.assert_variant_integrity(path)

        self.assertEqual(result["subjectDetection"], "alpha-bounds")

    def test_already_normalized_input_remains_approved(self) -> None:
        image = Image.new("RGB", (800, 800), "white")
        draw = ImageDraw.Draw(image)
        draw.rectangle((180, 100, 620, 700), fill=(40, 130, 70))
        for y in range(160, 660, 30):
            draw.line((220, y, 580, y), fill=(245, 245, 245), width=4)
        path = self.save("already-normalized.png", image)

        quality = analyze_image_path(path)

        self.assertEqual(quality["status"], "APPROVED")
        self.assert_variant_integrity(path)


if __name__ == "__main__":
    unittest.main()
