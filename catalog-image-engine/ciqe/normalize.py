from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps

SAFE_PADDING_RATIO = 0.04
MIN_SAFE_PADDING = 8
CARD_MAX_SIDE = 480
PDP_MAX_SIDE = 1000
MAX_UPSCALE_FACTOR = 1.25
WEBP_QUALITY = 90


def _median(values: list[int]) -> int:
    ordered = sorted(values)
    count = len(ordered)
    if not count:
        return 255
    midpoint = count // 2
    return ordered[midpoint] if count % 2 else (ordered[midpoint - 1] + ordered[midpoint]) // 2


def _edge_samples(rgb: Image.Image) -> list[tuple[int, int, int]]:
    width, height = rgb.size
    pixels = rgb.load()
    step = max(1, min(width, height) // 96)
    samples: list[tuple[int, int, int]] = []

    for x in range(0, width, step):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, height - 1])
    for y in range(0, height, step):
        samples.append(pixels[0, y])
        samples.append(pixels[width - 1, y])

    return samples


def _background_and_bbox(
    image: Image.Image,
) -> tuple[tuple[int, int, int], tuple[int, int, int, int] | None, bool]:
    rgb = image.convert("RGB")
    samples = _edge_samples(rgb)
    background = tuple(
        _median([sample[channel] for sample in samples]) for channel in range(3)
    )
    edge_deviations = [
        max(abs(sample[channel] - background[channel]) for channel in range(3))
        for sample in samples
    ]
    confident = _median(edge_deviations) <= 14
    if not confident:
        return background, None, False

    difference = ImageChops.difference(
        rgb, Image.new("RGB", rgb.size, background)
    ).convert("L")
    mask = difference.point(lambda value: 255 if value >= 18 else 0)
    mask = mask.filter(ImageFilter.MaxFilter(3))
    bounding_box = mask.getbbox()

    if bounding_box is None:
        return background, None, True

    left, top, right, bottom = bounding_box
    if left <= 0 or top <= 0 or right >= image.width or bottom >= image.height:
        # Edge contact is a crop-risk signal. Preserve the full source instead of
        # trimming further because missing packaging cannot be reconstructed safely.
        return background, None, True

    return background, bounding_box, True


def _enhance_bounded(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A") if image.mode == "RGBA" else None
    rgb = ImageEnhance.Contrast(image.convert("RGB")).enhance(1.03)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.08)
    if alpha is None:
        return rgb

    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


def _normalized_master(oriented: Image.Image) -> Image.Image:
    rgba = oriented.convert("RGBA")
    has_transparency = rgba.getchannel("A").getextrema()[0] < 250

    if has_transparency:
        bounding_box = rgba.getchannel("A").point(
            lambda value: 255 if value >= 24 else 0
        ).getbbox()
        background_rgba = (255, 255, 255, 0)
    else:
        background, bounding_box, _ = _background_and_bbox(rgba)
        background_rgba = (*background, 255)

    subject = rgba.crop(bounding_box) if bounding_box is not None else rgba
    subject = _enhance_bounded(subject).convert("RGBA")
    padding = max(MIN_SAFE_PADDING, math.ceil(max(subject.size) * SAFE_PADDING_RATIO))
    side = max(subject.width, subject.height) + 2 * padding
    canvas = Image.new("RGBA", (side, side), background_rgba)
    x = (side - subject.width) // 2
    y = (side - subject.height) // 2
    canvas.alpha_composite(subject, (x, y))

    return canvas if background_rgba[3] < 255 else canvas.convert("RGB")


def _variant(master: Image.Image, max_side: int) -> tuple[Image.Image, float]:
    current_max = max(master.size)
    scale = min(max_side / current_max, MAX_UPSCALE_FACTOR)

    if 0.999999 <= scale <= 1.000001:
        return master.copy(), 1.0

    target_size = (
        max(1, round(master.width * scale)),
        max(1, round(master.height * scale)),
    )
    return master.resize(target_size, Image.Resampling.LANCZOS), scale


def _save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", quality=WEBP_QUALITY, method=6)


def normalize_image_path(
    source_path: str | Path, output_directory: str | Path
) -> dict[str, Any]:
    source = Path(source_path)
    output = Path(output_directory)
    output.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as opened:
        opened.load()
        oriented = ImageOps.exif_transpose(opened)
        oriented_size = oriented.size
        master = _normalized_master(oriented)

    processed_path = output / "processed.webp"
    card_path = output / "card.webp"
    pdp_path = output / "pdp.webp"

    _save_webp(master, processed_path)
    card, card_scale = _variant(master, CARD_MAX_SIDE)
    pdp, pdp_scale = _variant(master, PDP_MAX_SIDE)
    _save_webp(card, card_path)
    _save_webp(pdp, pdp_path)

    return {
        "orientedSource": {"width": oriented_size[0], "height": oriented_size[1]},
        "upscaleFactor": {
            "card": round(card_scale, 6),
            "pdp": round(pdp_scale, 6),
        },
        "variants": {
            "processed": {
                "fileName": processed_path.name,
                "width": master.width,
                "height": master.height,
            },
            "card": {
                "fileName": card_path.name,
                "width": card.width,
                "height": card.height,
            },
            "pdp": {
                "fileName": pdp_path.name,
                "width": pdp.width,
                "height": pdp.height,
            },
        },
    }
