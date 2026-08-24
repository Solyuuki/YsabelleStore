from __future__ import annotations

import math
import warnings
from pathlib import Path
from typing import Any

from PIL import Image, ImageChops, ImageFilter, ImageOps, ImageStat, UnidentifiedImageError

MAX_DECODED_PIXELS = 24_000_000
MAX_DIMENSION_PIXELS = 8_000
MIN_SOURCE_SHORT_SIDE = 96
PDP_REVIEW_SHORT_SIDE = 480
SAFE_MARGIN_RATIO = 0.015
ANALYSIS_MAX_SIDE = 512
MAX_COMPLEX_EDGE_OUTLIER_RATIO = 0.25


def _diagnostic(code: str, message: str, severity: str = "warning") -> dict[str, str]:
    return {"code": code, "message": message, "severity": severity}


def _decode_failure_result() -> dict[str, Any]:
    return {
        "status": "REJECTED",
        "source": {"width": None, "height": None, "mode": None},
        "diagnostics": [
            _diagnostic("DECODE_FAILED", "Image could not be decoded safely.", "error")
        ],
        "metrics": {
            "luminance": None,
            "contrastStdDev": None,
            "sharpnessRms": None,
            "foregroundOccupancy": None,
            "touchesSafeMargin": None,
        },
    }


def _analysis_image(image: Image.Image) -> Image.Image:
    analysis = ImageOps.exif_transpose(image).convert("RGBA")
    if max(analysis.size) > ANALYSIS_MAX_SIDE:
        analysis.thumbnail((ANALYSIS_MAX_SIDE, ANALYSIS_MAX_SIDE), Image.Resampling.LANCZOS)
    return analysis


def _edge_samples(rgb: Image.Image) -> list[tuple[int, int, int]]:
    width, height = rgb.size
    pixels = rgb.load()
    step = max(1, min(width, height) // 64)
    samples: list[tuple[int, int, int]] = []

    for x in range(0, width, step):
        samples.append(pixels[x, 0])
        if height > 1:
            samples.append(pixels[x, height - 1])
    for y in range(0, height, step):
        samples.append(pixels[0, y])
        if width > 1:
            samples.append(pixels[width - 1, y])

    return samples


def _median(values: list[int]) -> int:
    ordered = sorted(values)
    count = len(ordered)
    if not count:
        return 0
    midpoint = count // 2
    return ordered[midpoint] if count % 2 else (ordered[midpoint - 1] + ordered[midpoint]) // 2


def _foreground_metrics(rgba: Image.Image) -> tuple[float | None, bool | None]:
    alpha = rgba.getchannel("A")
    width, height = rgba.size

    if alpha.getextrema()[0] < 250:
        mask = alpha.point(lambda value: 255 if value >= 24 else 0)
    else:
        rgb = rgba.convert("RGB")
        samples = _edge_samples(rgb)
        if not samples:
            return None, None

        background = tuple(
            _median([sample[channel] for sample in samples]) for channel in range(3)
        )
        edge_deviations = [
            max(abs(sample[channel] - background[channel]) for channel in range(3))
            for sample in samples
        ]
        edge_outlier_ratio = (
            sum(deviation > 14 for deviation in edge_deviations) / len(edge_deviations)
        )
        if (
            _median(edge_deviations) > 14
            or edge_outlier_ratio > MAX_COMPLEX_EDGE_OUTLIER_RATIO
        ):
            return None, None

        difference = ImageChops.difference(
            rgb, Image.new("RGB", rgb.size, background)
        ).convert("L")
        mask = difference.point(lambda value: 255 if value >= 18 else 0)
        mask = mask.filter(ImageFilter.MaxFilter(3))

    bounding_box = mask.getbbox()
    if bounding_box is None:
        return 0.0, False

    occupancy = float(ImageStat.Stat(mask).mean[0] / 255.0)
    left, top, right, bottom = bounding_box
    margin_x = max(1, math.ceil(width * SAFE_MARGIN_RATIO))
    margin_y = max(1, math.ceil(height * SAFE_MARGIN_RATIO))
    touches_safe_margin = (
        left <= margin_x
        or top <= margin_y
        or right >= width - margin_x
        or bottom >= height - margin_y
    )
    return occupancy, touches_safe_margin


def _sharpness_rms(gray: Image.Image) -> float:
    low_pass = gray.filter(ImageFilter.GaussianBlur(radius=2.0))
    residual = ImageChops.difference(gray, low_pass)
    return float(ImageStat.Stat(residual).rms[0])


def analyze_image_path(path: str | Path) -> dict[str, Any]:
    source_path = Path(path)

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            previous_max_pixels = Image.MAX_IMAGE_PIXELS
            Image.MAX_IMAGE_PIXELS = MAX_DECODED_PIXELS
            try:
                image = Image.open(source_path)
                width, height = image.size
                if (
                    width > MAX_DIMENSION_PIXELS
                    or height > MAX_DIMENSION_PIXELS
                    or width * height > MAX_DECODED_PIXELS
                ):
                    return {
                        "status": "REJECTED",
                        "source": {"width": width, "height": height, "mode": image.mode},
                        "diagnostics": [
                            _diagnostic(
                                "PIXEL_LIMIT_EXCEEDED",
                                "Image dimensions exceed the safe decode budget.",
                                "error",
                            )
                        ],
                        "metrics": {
                            "luminance": None,
                            "contrastStdDev": None,
                            "sharpnessRms": None,
                            "foregroundOccupancy": None,
                            "touchesSafeMargin": None,
                        },
                    }

                image.load()
                analysis = _analysis_image(image)
            finally:
                Image.MAX_IMAGE_PIXELS = previous_max_pixels
    except (
        UnidentifiedImageError,
        OSError,
        SyntaxError,
        Image.DecompressionBombWarning,
        Image.DecompressionBombError,
    ):
        return _decode_failure_result()

    diagnostics: list[dict[str, str]] = []
    short_side = min(width, height)
    if short_side < MIN_SOURCE_SHORT_SIDE:
        diagnostics.append(
            _diagnostic(
                "RESOLUTION_TOO_LOW",
                "Source resolution is too low for trustworthy catalog use.",
                "error",
            )
        )
    elif short_side < PDP_REVIEW_SHORT_SIDE:
        diagnostics.append(
            _diagnostic(
                "PDP_RESOLUTION_LOW",
                "Source resolution is below the preferred product-detail threshold.",
            )
        )

    composited = Image.new("RGB", analysis.size, "white")
    composited.paste(analysis.convert("RGB"), mask=analysis.getchannel("A"))
    gray = ImageOps.grayscale(composited)
    statistics = ImageStat.Stat(gray)
    luminance = float(statistics.mean[0])
    contrast = float(statistics.stddev[0])
    sharpness = _sharpness_rms(gray)
    occupancy, touches_safe_margin = _foreground_metrics(analysis)
    source_is_opaque = analysis.getchannel("A").getextrema()[0] >= 250

    if luminance < 35 or luminance > 235:
        diagnostics.append(
            _diagnostic("EXPOSURE_RISK", "Image exposure is outside the preferred catalog range.")
        )
    if contrast < 15:
        diagnostics.append(_diagnostic("LOW_CONTRAST", "Image has very low tonal contrast."))
    if sharpness < 8:
        diagnostics.append(
            _diagnostic("BLUR_RISK", "Image appears soft or blurred at catalog scale.")
        )
    if occupancy is None and source_is_opaque:
        diagnostics.append(
            _diagnostic(
                "BACKGROUND_COMPLEXITY_RISK",
                "Background is too complex for trustworthy automatic product isolation.",
            )
        )
    elif occupancy is not None:
        if occupancy < 0.20:
            diagnostics.append(
                _diagnostic(
                    "PRODUCT_TOO_SMALL_IN_FRAME",
                    "Visible product occupies too little of the image canvas.",
                )
            )
        elif occupancy > 0.92:
            diagnostics.append(
                _diagnostic(
                    "PRODUCT_TOO_LARGE_IN_FRAME",
                    "Visible product occupies almost the entire image canvas.",
                )
            )
    if touches_safe_margin is True:
        diagnostics.append(
            _diagnostic(
                "LIKELY_CROP_RISK",
                "Visible foreground reaches the safe frame margin and may be cropped.",
            )
        )

    if any(item["severity"] == "error" for item in diagnostics):
        status = "REJECTED"
    elif diagnostics:
        status = "NEEDS_REVIEW"
    else:
        status = "APPROVED"

    return {
        "status": status,
        "source": {"width": width, "height": height, "mode": analysis.mode},
        "diagnostics": diagnostics,
        "metrics": {
            "luminance": round(luminance, 3),
            "contrastStdDev": round(contrast, 3),
            "sharpnessRms": round(sharpness, 3),
            "foregroundOccupancy": None if occupancy is None else round(occupancy, 6),
            "touchesSafeMargin": touches_safe_margin,
        },
    }
