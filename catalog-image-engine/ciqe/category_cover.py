from __future__ import annotations

from pathlib import Path
from typing import Any

from PIL import Image, ImageEnhance, ImageOps

from ciqe.quality import analyze_image_path

PROCESSED_MAX_SIDE = 1920
COVER_MAX_WIDTH = 1600
COVER_MAX_HEIGHT = 1000
THUMBNAIL_SIZE = (480, 270)
WEBP_QUALITY = 90
CATEGORY_MIN_WIDTH = 640
CATEGORY_MIN_HEIGHT = 360
CATEGORY_PREFERRED_WIDTH = 960
CATEGORY_PREFERRED_HEIGHT = 540

_PRODUCT_ONLY_DIAGNOSTICS = {
    "PDP_RESOLUTION_LOW",
    "BACKGROUND_COMPLEXITY_RISK",
    "PRODUCT_TOO_SMALL_IN_FRAME",
    "PRODUCT_TOO_LARGE_IN_FRAME",
    "LIKELY_CROP_RISK",
}


def _diagnostic(code: str, message: str, severity: str = "warning") -> dict[str, str]:
    return {"code": code, "message": message, "severity": severity}


def analyze_category_cover_path(path: str | Path) -> dict[str, Any]:
    base = analyze_image_path(path)
    source = base["source"]

    diagnostics = [
        item for item in base["diagnostics"] if item["code"] not in _PRODUCT_ONLY_DIAGNOSTICS
    ]

    width = source["width"]
    height = source["height"]
    if isinstance(width, int) and isinstance(height, int) and width > 0 and height > 0:
        if width < CATEGORY_MIN_WIDTH or height < CATEGORY_MIN_HEIGHT:
            diagnostics.append(
                _diagnostic(
                    "CATEGORY_RESOLUTION_TOO_LOW",
                    "Category cover resolution is too low for storefront use.",
                    "error",
                )
            )
        elif width < CATEGORY_PREFERRED_WIDTH or height < CATEGORY_PREFERRED_HEIGHT:
            diagnostics.append(
                _diagnostic(
                    "CATEGORY_RESOLUTION_LOW",
                    "A larger landscape image is recommended for a premium category cover.",
                )
            )

        aspect_ratio = width / height
        if aspect_ratio < 1.2:
            diagnostics.append(
                _diagnostic(
                    "CATEGORY_PORTRAIT_SOURCE",
                    "This source is portrait-oriented and may crop heavily in category cards.",
                )
            )
        elif aspect_ratio > 2.6:
            diagnostics.append(
                _diagnostic(
                    "CATEGORY_ULTRAWIDE_SOURCE",
                    "This source is very wide and may crop on smaller category cards.",
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
        "source": source,
        "diagnostics": diagnostics,
        "metrics": base["metrics"],
    }


def _enhance(image: Image.Image) -> Image.Image:
    rgb = image.convert("RGB")
    rgb = ImageEnhance.Contrast(rgb).enhance(1.02)
    return ImageEnhance.Sharpness(rgb).enhance(1.05)


def _fit_within(image: Image.Image, max_width: int, max_height: int) -> Image.Image:
    if image.width <= max_width and image.height <= max_height:
        return image.copy()

    scale = min(max_width / image.width, max_height / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def _save_webp(image: Image.Image, path: Path) -> None:
    image.save(path, "WEBP", quality=WEBP_QUALITY, method=6)


def normalize_category_cover_path(
    source_path: str | Path,
    output_directory: str | Path,
) -> dict[str, Any]:
    source = Path(source_path)
    output = Path(output_directory)
    output.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as opened:
        opened.load()
        oriented = ImageOps.exif_transpose(opened)
        oriented_size = oriented.size
        master = _enhance(oriented)

    processed = _fit_within(master, PROCESSED_MAX_SIDE, PROCESSED_MAX_SIDE)
    cover = _fit_within(processed, COVER_MAX_WIDTH, COVER_MAX_HEIGHT)
    thumbnail = ImageOps.fit(
        processed,
        THUMBNAIL_SIZE,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )

    processed_path = output / "processed.webp"
    cover_path = output / "cover.webp"
    thumbnail_path = output / "thumbnail.webp"

    _save_webp(processed, processed_path)
    _save_webp(cover, cover_path)
    _save_webp(thumbnail, thumbnail_path)

    return {
        "orientedSource": {"width": oriented_size[0], "height": oriented_size[1]},
        "variants": {
            "processed": {
                "fileName": processed_path.name,
                "width": processed.width,
                "height": processed.height,
            },
            "cover": {
                "fileName": cover_path.name,
                "width": cover.width,
                "height": cover.height,
            },
            "thumbnail": {
                "fileName": thumbnail_path.name,
                "width": thumbnail.width,
                "height": thumbnail.height,
            },
        },
    }
