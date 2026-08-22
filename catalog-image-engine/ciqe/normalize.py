from __future__ import annotations

import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps

from ciqe.subject import EdgeConnectedBackgroundDetector

SAFE_PADDING_RATIO = 0.04
MIN_SAFE_PADDING = 8
CARD_MAX_SIDE = 480
PDP_MAX_SIDE = 1000
PROCESSED_MAX_SIDE = 1600
NORMALIZATION_INPUT_MAX_SIDE = 1480
MAX_UPSCALE_FACTOR = 1.25
WEBP_QUALITY = 90

_SUBJECT_DETECTOR = EdgeConnectedBackgroundDetector()


def _enhance_bounded(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A") if image.mode == "RGBA" else None
    rgb = ImageEnhance.Contrast(image.convert("RGB")).enhance(1.03)
    rgb = ImageEnhance.Sharpness(rgb).enhance(1.08)
    if alpha is None:
        return rgb

    rgba = rgb.convert("RGBA")
    rgba.putalpha(alpha)
    return rgba


def _normalization_working_copy(oriented: Image.Image) -> Image.Image:
    if max(oriented.size) > NORMALIZATION_INPUT_MAX_SIDE:
        oriented.thumbnail(
            (NORMALIZATION_INPUT_MAX_SIDE, NORMALIZATION_INPUT_MAX_SIDE),
            Image.Resampling.LANCZOS,
        )
    return oriented


def _normalized_master(oriented: Image.Image) -> tuple[Image.Image, str]:
    rgba = oriented.convert("RGBA")
    has_transparency = rgba.getchannel("A").getextrema()[0] < 250

    if has_transparency:
        bounding_box = rgba.getchannel("A").point(
            lambda value: 255 if value >= 24 else 0
        ).getbbox()
        background_rgba = (255, 255, 255, 0)
        detection_state = "alpha-bounds" if bounding_box is not None else "preserved-full-frame"
    else:
        detection = _SUBJECT_DETECTOR.detect(rgba)
        if detection is None:
            bounding_box = None
            background_rgba = (255, 255, 255, 255)
            detection_state = "preserved-full-frame"
        else:
            bounding_box = detection.bounding_box
            background_rgba = (*detection.background_rgb, 255)
            detection_state = "detected"

    subject = rgba.crop(bounding_box) if bounding_box is not None else rgba
    subject = _enhance_bounded(subject).convert("RGBA")
    padding = max(MIN_SAFE_PADDING, math.ceil(max(subject.size) * SAFE_PADDING_RATIO))
    side = max(subject.width, subject.height) + 2 * padding
    canvas = Image.new("RGBA", (side, side), background_rgba)
    x = (side - subject.width) // 2
    y = (side - subject.height) // 2
    canvas.alpha_composite(subject, (x, y))

    master = canvas if background_rgba[3] < 255 else canvas.convert("RGB")
    return master, detection_state


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
        working = _normalization_working_copy(oriented)
        master, subject_detection = _normalized_master(working)

    if max(master.size) > PROCESSED_MAX_SIDE:
        raise RuntimeError("Normalized catalog image exceeded the processed master size limit.")

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
        "subjectDetection": subject_detection,
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
