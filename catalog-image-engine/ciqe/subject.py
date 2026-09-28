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
            recovered_box = _dominant_internal_component_bbox(mask)
            if recovered_box is None:
                return None
            bounding_box = recovered_box

        confidence = max(0.0, min(1.0, 1.0 - median_deviation / 70.0))
        if confidence < 0.8:
            return None

        return SubjectDetection(
            bounding_box=bounding_box,
            background_rgb=background,
            confidence=round(confidence, 4),
        )


def _dominant_internal_component_bbox(
    mask: Image.Image, minimum_share: float = 0.995
) -> tuple[int, int, int, int] | None:
    """Recover a subject when a tiny disconnected speck alone touches the frame edge."""

    width, height = mask.size
    if width <= 0 or height <= 0:
        return None

    pixels = mask.load()
    visited = bytearray(width * height)
    components: list[tuple[int, tuple[int, int, int, int]]] = []

    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y] == 0:
                continue

            stack = [(x, y)]
            visited[index] = 1
            count = 0
            left = right = x
            top = bottom = y

            while stack:
                current_x, current_y = stack.pop()
                count += 1
                left = min(left, current_x)
                right = max(right, current_x)
                top = min(top, current_y)
                bottom = max(bottom, current_y)

                for next_y in range(max(0, current_y - 1), min(height, current_y + 2)):
                    for next_x in range(max(0, current_x - 1), min(width, current_x + 2)):
                        if next_x == current_x and next_y == current_y:
                            continue
                        next_index = next_y * width + next_x
                        if visited[next_index] or pixels[next_x, next_y] == 0:
                            continue
                        visited[next_index] = 1
                        stack.append((next_x, next_y))

            components.append((count, (left, top, right + 1, bottom + 1)))

    if not components:
        return None

    components.sort(key=lambda component: component[0], reverse=True)
    total_foreground = sum(component[0] for component in components)
    dominant_count, dominant_box = components[0]
    if dominant_count / total_foreground < minimum_share:
        return None

    left, top, right, bottom = dominant_box
    if left <= 0 or top <= 0 or right >= width or bottom >= height:
        return None

    return dominant_box


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
