from __future__ import annotations

from dataclasses import dataclass
from statistics import median
from typing import Protocol

from PIL import Image, ImageChops, ImageFilter


@dataclass(frozen=True)
class SubjectDetection:
    bounding_box: tuple[int, int, int, int]
    background_rgb: tuple[int, int, int]
    confidence: float


class SubjectDetector(Protocol):
    def detect(self, image: Image.Image) -> SubjectDetection | None: ...


class EdgeConnectedBackgroundDetector:
    """Conservative deterministic subject framing for clean, light catalog backgrounds.

    It intentionally returns None when the edge matte is complex, dark, strongly colored,
    empty, or when foreground reaches the image boundary. Callers must preserve the full
    photograph when detection is uncertain.
    """

    def detect(self, image: Image.Image) -> SubjectDetection | None:
        rgb = image.convert("RGB")
        samples = _edge_samples(rgb)
        if not samples:
            return None

        background = tuple(
            round(median(sample[channel] for sample in samples)) for channel in range(3)
        )
        edge_deviations = [
            max(abs(sample[channel] - background[channel]) for channel in range(3))
            for sample in samples
        ]
        median_deviation = float(median(edge_deviations))
        background_spread = max(background) - min(background)

        if median_deviation > 14 or min(background) < 170 or background_spread > 48:
            return None

        difference = ImageChops.difference(
            rgb, Image.new("RGB", rgb.size, background)
        ).convert("L")
        mask = difference.point(lambda value: 255 if value >= 18 else 0)
        mask = mask.filter(ImageFilter.MaxFilter(3))
        bounding_box = mask.getbbox()
        if bounding_box is None:
            return None

        left, top, right, bottom = bounding_box
        if left <= 0 or top <= 0 or right >= rgb.width or bottom >= rgb.height:
            return None

        confidence = max(0.0, min(1.0, 1.0 - median_deviation / 70.0))
        if confidence < 0.8:
            return None

        return SubjectDetection(
            bounding_box=bounding_box,
            background_rgb=background,
            confidence=round(confidence, 4),
        )


def _edge_samples(image: Image.Image) -> list[tuple[int, int, int]]:
    width, height = image.size
    if width <= 0 or height <= 0:
        return []

    pixels = image.load()
    step = max(1, min(width, height) // 96)
    samples: list[tuple[int, int, int]] = []

    for x in range(0, width, step):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, height - 1])
    for y in range(0, height, step):
        samples.append(pixels[0, y])
        samples.append(pixels[width - 1, y])

    return samples
