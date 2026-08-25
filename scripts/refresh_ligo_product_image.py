"""Refresh the Ligo 155g storefront asset from a complete, front-facing retail packshot.

This script exists because the legacy Ligo source was a handheld photograph that required a
hard-coded silhouette. That silhouette clipped the can in storefront use. The replacement path
uses a complete light-background product packshot, removes only edge-connected background pixels,
and places the entire visible can on a fixed transparent canvas with a protected margin.

The script is deterministic after the source has been downloaded. `--download` replaces the
preserved Ligo source, while normal execution reprocesses the already-preserved local source.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import deque
from pathlib import Path
from statistics import median
from urllib.request import Request, urlopen

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PRODUCT_DIR = ROOT / "frontend" / "public" / "images" / "products"
SOURCE_DIR = PRODUCT_DIR / "originals"
MANIFEST_PATH = PRODUCT_DIR / "CUTOUT-MANIFEST.json"
ASSET_NAME = "ligo-sardines-tomato-sauce-chili-added-155g.webp"
SOURCE_PATH = SOURCE_DIR / ASSET_NAME
OUTPUT_PATH = PRODUCT_DIR / ASSET_NAME

SOURCE_PAGE = (
    "https://www.dmc.com.ph/shop/"
    "ligo-sardines-in-tomato-sauce-with-chili-red-155g-x-100-1099"
)
SOURCE_IMAGE_URL = (
    "https://www.dmc.com.ph/web/image/product.template/1099/image_1920?unique=765a0bd"
)
USER_AGENT = "YsabelleStore-Catalog-Asset-Refresh/1.0"
MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024
MIN_SOURCE_DIMENSION = 500
OUTPUT_CANVAS = 800
CONTENT_LIMIT = 700
MIN_MARGIN = (OUTPUT_CANVAS - CONTENT_LIMIT) // 2
BACKGROUND_DISTANCE = 92.0
MIN_BACKGROUND_CHANNEL = 145


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(64 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def color_distance(pixel: tuple[int, int, int], background: tuple[int, int, int]) -> float:
    return math.sqrt(sum((pixel[index] - background[index]) ** 2 for index in range(3)))


def estimate_background(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    edge_samples = (
        [pixels[x, 0] for x in range(width)]
        + [pixels[x, height - 1] for x in range(width)]
        + [pixels[0, y] for y in range(height)]
        + [pixels[width - 1, y] for y in range(height)]
    )
    light_samples = [
        pixel
        for pixel in edge_samples
        if min(pixel) >= 190 and max(pixel) - min(pixel) <= 55
    ]
    samples = light_samples or edge_samples
    return tuple(round(median(pixel[channel] for pixel in samples)) for channel in range(3))


def validate_light_background(image: Image.Image) -> None:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    step_x = max(1, width // 80)
    step_y = max(1, height // 80)
    samples: list[tuple[int, int, int]] = []
    for x in range(0, width, step_x):
        samples.append(pixels[x, 0])
        samples.append(pixels[x, height - 1])
    for y in range(0, height, step_y):
        samples.append(pixels[0, y])
        samples.append(pixels[width - 1, y])

    light = sum(
        1
        for pixel in samples
        if min(pixel) >= 185 and max(pixel) - min(pixel) <= 65
    )
    ratio = light / max(1, len(samples))
    if ratio < 0.6:
        raise ValueError(
            f"Ligo replacement source is not a safe light-background packshot (edge ratio={ratio:.3f})."
        )


def connected_background_mask(image: Image.Image) -> bytearray:
    rgb = image.convert("RGB")
    width, height = rgb.size
    pixels = rgb.load()
    background = estimate_background(rgb)
    mask = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if mask[index]:
            return
        pixel = pixels[x, y]
        if min(pixel) < MIN_BACKGROUND_CHANNEL:
            return
        if color_distance(pixel, background) > BACKGROUND_DISTANCE:
            return
        mask[index] = 1
        queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for nx, ny in (
            (x - 1, y),
            (x + 1, y),
            (x, y - 1),
            (x, y + 1),
            (x - 1, y - 1),
            (x + 1, y - 1),
            (x - 1, y + 1),
            (x + 1, y + 1),
        ):
            if 0 <= nx < width and 0 <= ny < height:
                enqueue(nx, ny)

    return mask


def isolate_full_can(image: Image.Image) -> Image.Image:
    validate_light_background(image)
    rgb = image.convert("RGB")
    width, height = rgb.size
    mask = connected_background_mask(rgb)
    rgba = Image.new("RGBA", rgb.size, (0, 0, 0, 0))
    source = rgb.load()
    target = rgba.load()

    for y in range(height):
        for x in range(width):
            if mask[y * width + x]:
                continue
            target[x, y] = (*source[x, y], 255)

    alpha = rgba.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Ligo background isolation removed the entire product.")

    visible = rgba.crop(bounds)
    scale = min(CONTENT_LIMIT / visible.width, CONTENT_LIMIT / visible.height, 1.0)
    resized = visible.resize(
        (max(1, round(visible.width * scale)), max(1, round(visible.height * scale))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (OUTPUT_CANVAS, OUTPUT_CANVAS), (0, 0, 0, 0))
    offset = (
        (OUTPUT_CANVAS - resized.width) // 2,
        (OUTPUT_CANVAS - resized.height) // 2,
    )
    canvas.alpha_composite(resized, offset)
    validate_full_can_margin(canvas)
    return canvas


def validate_full_can_margin(image: Image.Image) -> None:
    if image.size != (OUTPUT_CANVAS, OUTPUT_CANVAS):
        raise ValueError(f"Ligo derivative must be {OUTPUT_CANVAS}x{OUTPUT_CANVAS}.")
    alpha = image.getchannel("A")
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError("Ligo derivative contains no visible product pixels.")
    left, top, right, bottom = bounds
    margins = (left, top, OUTPUT_CANVAS - right, OUTPUT_CANVAS - bottom)
    if min(margins) < MIN_MARGIN:
        raise ValueError(f"Ligo derivative does not preserve the full-can safe margin: {margins}.")
    boundary = (
        [alpha.getpixel((x, 0)) for x in range(OUTPUT_CANVAS)]
        + [alpha.getpixel((x, OUTPUT_CANVAS - 1)) for x in range(OUTPUT_CANVAS)]
        + [alpha.getpixel((0, y)) for y in range(OUTPUT_CANVAS)]
        + [alpha.getpixel((OUTPUT_CANVAS - 1, y)) for y in range(OUTPUT_CANVAS)]
    )
    if max(boundary) != 0:
        raise ValueError("Ligo derivative has visible pixels touching the canvas boundary.")


def inspect_asset(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        image.load()
        width, height = image.size
        alpha = image.getchannel("A")
        transparent = sum(1 for value in alpha.getdata() if value == 0)
        translucent = sum(1 for value in alpha.getdata() if 0 < value < 255)
        return {
            "dimensions": [width, height],
            "format": image.format,
            "hasAlpha": True,
            "opaqueBounds": list(alpha.getbbox() or ()),
            "transparentPixelRatio": round(transparent / (width * height), 4),
            "translucentPixels": translucent,
        }


def download_source() -> None:
    request = Request(
        SOURCE_IMAGE_URL,
        headers={"User-Agent": USER_AGENT, "Referer": SOURCE_PAGE},
    )
    with urlopen(request, timeout=30) as response:
        payload = response.read(MAX_DOWNLOAD_BYTES + 1)
    if len(payload) > MAX_DOWNLOAD_BYTES:
        raise ValueError("Ligo source exceeds the configured download limit.")

    temporary = SOURCE_PATH.with_suffix(".download")
    temporary.parent.mkdir(parents=True, exist_ok=True)
    temporary.write_bytes(payload)
    try:
        with Image.open(temporary) as image:
            image.load()
            if min(image.size) < MIN_SOURCE_DIMENSION:
                raise ValueError(
                    f"Ligo replacement source is too small: {image.width}x{image.height}."
                )
            validate_light_background(image)
            image.convert("RGB").save(SOURCE_PATH, "WEBP", quality=95, method=6)
    finally:
        temporary.unlink(missing_ok=True)


def update_manifest(source_dimensions: list[int], derivative: Image.Image) -> None:
    if not MANIFEST_PATH.is_file():
        raise FileNotFoundError(f"Missing cutout manifest: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entries = manifest.get("assets", [])
    target = next(
        (
            entry
            for entry in entries
            if Path(entry.get("processed", {}).get("path", "")).name == ASSET_NAME
        ),
        None,
    )
    if target is None:
        raise ValueError("Cutout manifest does not contain the Ligo asset.")

    target["source"] = {
        "path": SOURCE_PATH.relative_to(ROOT).as_posix(),
        "dimensions": source_dimensions,
        "bytes": SOURCE_PATH.stat().st_size,
        "sha256": sha256(SOURCE_PATH),
    }
    target["processed"] = {
        "path": OUTPUT_PATH.relative_to(ROOT).as_posix(),
        "bytes": OUTPUT_PATH.stat().st_size,
        "sha256": sha256(OUTPUT_PATH),
        **inspect_asset(OUTPUT_PATH),
    }
    target["processing"] = {
        "maskType": "edge-connected light-background isolation",
        "sourcePage": SOURCE_PAGE,
        "outputCanvas": OUTPUT_CANVAS,
        "contentLimit": CONTENT_LIMIT,
        "minimumSafeMargin": MIN_MARGIN,
        "fullCanPreserved": True,
    }
    manifest["algorithm"] = (
        "deterministic asset isolation using edge-connected matte removal; "
        "Ligo is normalized onto a fixed full-can safe canvas"
    )
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def process_source() -> None:
    if not SOURCE_PATH.is_file():
        raise FileNotFoundError(
            f"Missing Ligo source: {SOURCE_PATH}. Run with --download once to refresh it."
        )
    with Image.open(SOURCE_PATH) as source:
        source.load()
        if min(source.size) < MIN_SOURCE_DIMENSION:
            raise ValueError(f"Ligo source is too small: {source.width}x{source.height}.")
        source_dimensions = list(source.size)
        derivative = isolate_full_can(source)
    derivative.save(OUTPUT_PATH, "WEBP", quality=94, alpha_quality=100, method=6, exact=True)
    validate_full_can_margin(derivative)
    update_manifest(source_dimensions, derivative)


def verify() -> None:
    if not SOURCE_PATH.is_file() or not OUTPUT_PATH.is_file():
        raise FileNotFoundError("Ligo source or derivative is missing.")
    if not MANIFEST_PATH.is_file():
        raise FileNotFoundError("Cutout manifest is missing.")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entry = next(
        (
            item
            for item in manifest.get("assets", [])
            if Path(item.get("processed", {}).get("path", "")).name == ASSET_NAME
        ),
        None,
    )
    if entry is None:
        raise ValueError("Cutout manifest does not contain the Ligo asset.")
    if entry.get("processing", {}).get("maskType") == "manual sealed-product silhouette":
        raise ValueError("Legacy Ligo manual silhouette is still active in the final manifest.")
    if entry.get("processing", {}).get("fullCanPreserved") is not True:
        raise ValueError("Ligo manifest does not record full-can preservation.")
    if entry.get("source", {}).get("sha256") != sha256(SOURCE_PATH):
        raise ValueError("Ligo source hash does not match the manifest.")
    if entry.get("processed", {}).get("sha256") != sha256(OUTPUT_PATH):
        raise ValueError("Ligo derivative hash does not match the manifest.")
    with Image.open(OUTPUT_PATH) as image:
        image.load()
        validate_full_can_margin(image.convert("RGBA"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download and preserve the reviewed full-can Ligo source before processing.",
    )
    parser.add_argument("--verify", action="store_true", help="Verify the final Ligo asset only.")
    args = parser.parse_args()

    if args.verify:
        verify()
        print("PASS: Ligo full-can derivative and manifest are consistent.")
        return
    if args.download:
        download_source()
    process_source()
    print(
        "PASS: Ligo source normalized to a full-can 800x800 transparent storefront derivative."
    )


if __name__ == "__main__":
    main()
