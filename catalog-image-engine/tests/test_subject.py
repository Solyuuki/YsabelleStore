from __future__ import annotations

import unittest

from PIL import Image, ImageDraw

from ciqe.subject import EdgeConnectedBackgroundDetector


class ProductSubjectDetectionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.detector = EdgeConnectedBackgroundDetector()

    def test_detects_subject_bounds_on_clean_light_background(self) -> None:
        image = Image.new("RGB", (800, 800), "white")
        ImageDraw.Draw(image).rectangle((260, 120, 540, 680), fill=(35, 80, 180))

        detection = self.detector.detect(image)

        self.assertIsNotNone(detection)
        assert detection is not None
        left, top, right, bottom = detection.bounding_box
        self.assertLessEqual(left, 260)
        self.assertLessEqual(top, 120)
        self.assertGreaterEqual(right, 541)
        self.assertGreaterEqual(bottom, 681)
        self.assertGreaterEqual(detection.confidence, 0.8)

    def test_returns_none_for_complex_edge_background_instead_of_destructive_crop(self) -> None:
        image = Image.new("RGB", (800, 800), "white")
        draw = ImageDraw.Draw(image)
        for index in range(0, 800, 20):
            color = (40, 80, 150) if (index // 20) % 2 == 0 else (220, 170, 70)
            draw.rectangle((index, 0, min(index + 19, 799), 799), fill=color)
        draw.rectangle((280, 140, 520, 660), fill=(30, 30, 30))

        self.assertIsNone(self.detector.detect(image))

    def test_returns_none_when_subject_touches_frame_edge(self) -> None:
        image = Image.new("RGB", (800, 800), "white")
        ImageDraw.Draw(image).rectangle((0, 140, 500, 660), fill=(35, 80, 180))

        self.assertIsNone(self.detector.detect(image))


if __name__ == "__main__":
    unittest.main()
