from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

from ciqe.normalize import normalize_image_path


class CatalogImageNormalizationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary_directory.name)

    def tearDown(self) -> None:
        self.temporary_directory.cleanup()

    def save(self, name: str, image: Image.Image, *, exif=None) -> Path:
        path = self.root / name
        image.save(path, exif=exif)
        return path

    def test_centers_complete_product_and_keeps_safe_padding(self) -> None:
        source = Image.new("RGB", (900, 700), "white")
        ImageDraw.Draw(source).rectangle((350, 100, 550, 600), fill=(30, 80, 180))
        path = self.save("whitespace.png", source)
        output = self.root / "out"

        result = normalize_image_path(path, output)
        processed = Image.open(output / "processed.webp").convert("RGB")
        bbox = foreground_bbox(processed)

        self.assertIsNotNone(bbox)
        left, top, right, bottom = bbox
        self.assertGreaterEqual(left, 8)
        self.assertGreaterEqual(top, 8)
        self.assertGreaterEqual(processed.width - right, 8)
        self.assertGreaterEqual(processed.height - bottom, 8)
        self.assertAlmostEqual((left + right) / 2, processed.width / 2, delta=3)
        self.assertAlmostEqual((top + bottom) / 2, processed.height / 2, delta=3)
        self.assertEqual(result["variants"]["processed"]["fileName"], "processed.webp")

    def test_preserves_product_aspect_ratio_instead_of_stretching(self) -> None:
        source = Image.new("RGB", (700, 700), "white")
        ImageDraw.Draw(source).rectangle((250, 100, 450, 600), fill=(20, 70, 170))
        source_bbox = foreground_bbox(source)
        path = self.save("aspect.png", source)
        output = self.root / "out"

        normalize_image_path(path, output)
        processed_bbox = foreground_bbox(Image.open(output / "processed.webp").convert("RGB"))

        self.assertIsNotNone(source_bbox)
        self.assertIsNotNone(processed_bbox)
        self.assertAlmostEqual(bbox_ratio(source_bbox), bbox_ratio(processed_bbox), delta=0.03)

    def test_card_and_pdp_variants_respect_size_and_upscale_caps(self) -> None:
        source = Image.new("RGB", (220, 320), "white")
        ImageDraw.Draw(source).rectangle((60, 30, 160, 290), fill=(20, 70, 170))
        path = self.save("small-source.png", source)
        output = self.root / "out"

        result = normalize_image_path(path, output)
        processed = Image.open(output / "processed.webp")
        card = Image.open(output / "card.webp")
        pdp = Image.open(output / "pdp.webp")

        self.assertLessEqual(max(card.size), 480)
        self.assertLessEqual(max(pdp.size), 1000)
        self.assertLessEqual(max(card.size), round(max(processed.size) * 1.25) + 1)
        self.assertLessEqual(max(pdp.size), round(max(processed.size) * 1.25) + 1)
        self.assertLessEqual(result["upscaleFactor"]["card"], 1.25)
        self.assertLessEqual(result["upscaleFactor"]["pdp"], 1.25)

    def test_applies_exif_orientation_before_normalization(self) -> None:
        source = Image.new("RGB", (240, 420), "white")
        ImageDraw.Draw(source).rectangle((40, 150, 200, 270), fill=(20, 70, 170))
        exif = source.getexif()
        exif[274] = 6
        path = self.save("oriented.jpg", source, exif=exif)
        output = self.root / "out"

        result = normalize_image_path(path, output)

        self.assertEqual(result["orientedSource"]["width"], 420)
        self.assertEqual(result["orientedSource"]["height"], 240)


def foreground_bbox(image: Image.Image):
    rgb = image.convert("RGB")
    background = Image.new("RGB", rgb.size, "white")
    difference = __import__("PIL.ImageChops", fromlist=["difference"]).difference(rgb, background).convert("L")
    return difference.point(lambda value: 255 if value >= 24 else 0).getbbox()


def bbox_ratio(bbox) -> float:
    left, top, right, bottom = bbox
    return (right - left) / (bottom - top)


if __name__ == "__main__":
    unittest.main()
