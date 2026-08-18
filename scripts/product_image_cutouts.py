"""Create truthful transparent product cutouts from normalized white-background assets.

The processor is intentionally deterministic and non-generative. It removes only the
near-background component connected to the source canvas edges, derives antialiased alpha from
distance to the estimated matte, decontaminates fringe colors, and adds transparent safe padding.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import deque
from pathlib import Path
from statistics import median

from PIL import Image, ImageDraw, ImageFilter, features


ROOT = Path(__file__).resolve().parents[1]
PRODUCT_DIR = ROOT / "frontend" / "public" / "images" / "products"
SOURCE_DIR = PRODUCT_DIR / "originals"
OUTPUT_DIR = PRODUCT_DIR
MANIFEST_PATH = PRODUCT_DIR / "CUTOUT-MANIFEST.json"
ASSET_NAMES = (
    "gardenia-enriched-white-bread-600g.webp",
    "ligo-sardines-tomato-sauce-chili-added-155g.webp",
    "sunsilk-anti-dandruff-silky-shampoo-sachet-13-5ml.webp",
)
LOSSLESS_DERIVATIVES = {"gardenia-enriched-white-bread-600g.webp"}

# The licensed Ligo source is a real handheld product photo. A deterministic silhouette keeps only
# the sealed can while excluding the hand and room behind it; coordinates refer to the preserved
# 1275x1698 source and intentionally avoid reconstructing or altering any package artwork.
MANUAL_PRODUCT_POLYGONS = {
    "ligo-sardines-tomato-sauce-chili-added-155g.webp": (
        (305, 540),
        (320, 525),
        (350, 513),
        (405, 503),
        (750, 496),
        (790, 502),
        (818, 516),
        (832, 540),
        (829, 1190),
        (822, 1300),
        (812, 1355),
        (795, 1385),
        (770, 1405),
        (720, 1416),
        (420, 1425),
        (378, 1412),
        (348, 1390),
        (330, 1350),
        (316, 620),
    )
}

# A single color-distance policy is used for every asset. Connectivity, rather than a blanket
# white-pixel replacement, prevents enclosed light package artwork from being erased.
CLEAR_DISTANCE = 5.0
EDGE_DISTANCE = 150.0
MIN_BACKGROUND_CHANNEL = 140
FRINGE_DISTANCE = 190.0
FRINGE_MIN_BACKGROUND_CHANNEL = 140
FRINGE_PASSES = 1
SAFE_PADDING_RATIO = 0.025
MIN_SAFE_PADDING = 4
MAX_SAFE_PADDING = 8
MIN_COMPONENT_PIXELS = 16


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(64 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest().upper()


def estimate_background(image: Image.Image) -> tuple[int, int, int]:
    width, height = image.size
    pixels = image.load()
    boundary = (
        [pixels[x, 0] for x in range(width)]
        + [pixels[x, height - 1] for x in range(width)]
        + [pixels[0, y] for y in range(height)]
        + [pixels[width - 1, y] for y in range(height)]
    )
    neutral_light_pixels = [
        pixel
        for pixel in boundary
        if min(pixel) >= 210 and max(pixel) - min(pixel) <= 32
    ]
    samples = neutral_light_pixels or boundary
    return tuple(round(median(pixel[channel] for pixel in samples)) for channel in range(3))


def color_distance(pixel: tuple[int, int, int], background: tuple[int, int, int]) -> float:
    return math.sqrt(sum((pixel[channel] - background[channel]) ** 2 for channel in range(3)))


def is_background_candidate(
    pixel: tuple[int, int, int], background: tuple[int, int, int]
) -> bool:
    return min(pixel) >= MIN_BACKGROUND_CHANNEL and color_distance(pixel, background) <= EDGE_DISTANCE


def connected_background(image: Image.Image, background: tuple[int, int, int]) -> bytearray:
    width, height = image.size
    pixels = image.load()
    mask = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()

    def enqueue(x: int, y: int) -> None:
        index = y * width + x
        if mask[index] or not is_background_candidate(pixels[x, y], background):
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
        for neighbor_x, neighbor_y in (
            (x - 1, y - 1),
            (x, y - 1),
            (x + 1, y - 1),
            (x - 1, y),
            (x + 1, y),
            (x - 1, y + 1),
            (x, y + 1),
            (x + 1, y + 1),
        ):
            if 0 <= neighbor_x < width and 0 <= neighbor_y < height:
                enqueue(neighbor_x, neighbor_y)

    return mask


def include_contiguous_matte_fringe(
    image: Image.Image, background: tuple[int, int, int], mask: bytearray
) -> bytearray:
    width, height = image.size
    pixels = image.load()
    for _ in range(FRINGE_PASSES):
        additions: list[int] = []
        for y in range(height):
            for x in range(width):
                index = y * width + x
                if mask[index]:
                    continue
                pixel = pixels[x, y]
                if (
                    min(pixel) < FRINGE_MIN_BACKGROUND_CHANNEL
                    or color_distance(pixel, background) > FRINGE_DISTANCE
                ):
                    continue
                if any(
                    0 <= neighbor_x < width
                    and 0 <= neighbor_y < height
                    and mask[neighbor_y * width + neighbor_x]
                    for neighbor_x, neighbor_y in (
                        (x - 1, y - 1),
                        (x, y - 1),
                        (x + 1, y - 1),
                        (x - 1, y),
                        (x + 1, y),
                        (x - 1, y + 1),
                        (x, y + 1),
                        (x + 1, y + 1),
                    )
                ):
                    additions.append(index)
        for index in additions:
            mask[index] = 2
    return mask


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def remove_isolated_matte_specks(image: Image.Image) -> tuple[int, int]:
    width, height = image.size
    alpha = image.getchannel("A")
    alpha_pixels = alpha.load()
    visited = bytearray(width * height)
    removed_components = 0
    removed_pixels = 0

    for start_y in range(height):
        for start_x in range(width):
            start_index = start_y * width + start_x
            if visited[start_index] or alpha_pixels[start_x, start_y] <= 2:
                continue
            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[start_index] = 1
            component: list[tuple[int, int]] = []
            while queue:
                x, y = queue.popleft()
                component.append((x, y))
                for neighbor_x, neighbor_y in (
                    (x - 1, y - 1),
                    (x, y - 1),
                    (x + 1, y - 1),
                    (x - 1, y),
                    (x + 1, y),
                    (x - 1, y + 1),
                    (x, y + 1),
                    (x + 1, y + 1),
                ):
                    if not (0 <= neighbor_x < width and 0 <= neighbor_y < height):
                        continue
                    index = neighbor_y * width + neighbor_x
                    if visited[index] or alpha_pixels[neighbor_x, neighbor_y] <= 2:
                        continue
                    visited[index] = 1
                    queue.append((neighbor_x, neighbor_y))
            if len(component) >= MIN_COMPONENT_PIXELS:
                continue
            removed_components += 1
            removed_pixels += len(component)
            for x, y in component:
                red, green, blue, _ = image.getpixel((x, y))
                image.putpixel((x, y), (red, green, blue, 0))

    return removed_components, removed_pixels


def isolate_manual_product(
    image: Image.Image, polygon: tuple[tuple[int, int], ...]
) -> tuple[Image.Image, dict[str, object]]:
    rgba = image.convert("RGBA")
    mask = Image.new("L", rgba.size, 0)
    ImageDraw.Draw(mask).polygon(polygon, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.0))
    rgba.putalpha(mask)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("Manual product silhouette removed the entire image.")

    visible = rgba.crop(bounds)
    padding = max(
        MIN_SAFE_PADDING,
        min(MAX_SAFE_PADDING, round(max(visible.size) * SAFE_PADDING_RATIO)),
    )
    padded = Image.new(
        "RGBA", (visible.width + padding * 2, visible.height + padding * 2), (0, 0, 0, 0)
    )
    padded.alpha_composite(visible, (padding, padding))
    return padded, {
        "maskType": "manual sealed-product silhouette",
        "contentBounds": list(bounds),
        "safePadding": padding,
    }


def isolate_product(image: Image.Image, asset_name: str) -> tuple[Image.Image, dict[str, object]]:
    manual_polygon = MANUAL_PRODUCT_POLYGONS.get(asset_name)
    if manual_polygon is not None:
        return isolate_manual_product(image, manual_polygon)

    rgb = image.convert("RGB")
    width, height = rgb.size
    background = estimate_background(rgb)
    exterior = include_contiguous_matte_fringe(
        rgb, background, connected_background(rgb, background)
    )
    source_pixels = rgb.load()
    cutout = Image.new("RGBA", rgb.size, (0, 0, 0, 0))
    output_pixels = cutout.load()

    for y in range(height):
        for x in range(width):
            pixel = source_pixels[x, y]
            if not exterior[y * width + x]:
                output_pixels[x, y] = (*pixel, 255)
                continue

            distance = color_distance(pixel, background)
            alpha_distance = FRINGE_DISTANCE if exterior[y * width + x] == 2 else EDGE_DISTANCE
            alpha_fraction = smoothstep(
                (distance - CLEAR_DISTANCE) / (alpha_distance - CLEAR_DISTANCE)
            )
            alpha = round(alpha_fraction * 255)
            if alpha <= 2:
                output_pixels[x, y] = (0, 0, 0, 0)
                continue

            # Reverse the estimated white matte contribution so translucent contour pixels do not
            # carry a bright halo when the derivative is placed on a colored stage.
            decontaminated = tuple(
                max(
                    0,
                    min(
                        255,
                        round(
                            (pixel[channel] - (1.0 - alpha_fraction) * background[channel])
                            / alpha_fraction
                        ),
                    ),
                )
                for channel in range(3)
            )
            output_pixels[x, y] = (*decontaminated, alpha)

    removed_components, removed_pixels = remove_isolated_matte_specks(cutout)
    alpha = cutout.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value > 2 else 0).getbbox()
    if bounds is None:
        raise ValueError("Background isolation removed the entire image.")

    visible = cutout.crop(bounds)
    padding = max(
        MIN_SAFE_PADDING,
        min(MAX_SAFE_PADDING, round(max(visible.size) * SAFE_PADDING_RATIO)),
    )
    padded = Image.new(
        "RGBA", (visible.width + padding * 2, visible.height + padding * 2), (0, 0, 0, 0)
    )
    padded.alpha_composite(visible, (padding, padding))
    return padded, {
        "backgroundRgb": list(background),
        "contentBounds": list(bounds),
        "removedMatteComponents": removed_components,
        "removedMattePixels": removed_pixels,
        "safePadding": padding,
    }


def inspect_asset(path: Path) -> dict[str, object]:
    with Image.open(path) as image:
        image.load()
        bands = image.getbands()
        if "A" not in bands:
            raise ValueError(f"{path} does not contain an alpha channel.")
        alpha = image.getchannel("A")
        minimum_alpha, maximum_alpha = alpha.getextrema()
        if minimum_alpha != 0 or maximum_alpha != 255:
            raise ValueError(f"{path} must contain both transparent and opaque pixels.")
        width, height = image.size
        boundary_alpha = (
            [alpha.getpixel((x, 0)) for x in range(width)]
            + [alpha.getpixel((x, height - 1)) for x in range(width)]
            + [alpha.getpixel((0, y)) for y in range(height)]
            + [alpha.getpixel((width - 1, y)) for y in range(height)]
        )
        if max(boundary_alpha) != 0:
            raise ValueError(f"{path} has visible pixels touching its canvas boundary.")
        transparent_pixels = sum(1 for value in alpha.getdata() if value == 0)
        translucent_pixels = sum(1 for value in alpha.getdata() if 0 < value < 255)
        return {
            "dimensions": [width, height],
            "format": image.format,
            "hasAlpha": True,
            "opaqueBounds": list(alpha.getbbox() or ()),
            "transparentPixelRatio": round(transparent_pixels / (width * height), 4),
            "translucentPixels": translucent_pixels,
        }


def process_assets() -> dict[str, object]:
    if not features.check("webp"):
        raise RuntimeError("The installed Pillow build does not support WebP.")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, object]] = []

    for name in ASSET_NAMES:
        source_path = SOURCE_DIR / name
        output_path = OUTPUT_DIR / name
        if not source_path.is_file():
            raise FileNotFoundError(f"Missing preserved source asset: {source_path}")
        with Image.open(source_path) as source:
            source.load()
            source_dimensions = list(source.size)
            cutout, processing = isolate_product(source, name)
        save_options: dict[str, object] = {"method": 6, "exact": True}
        if name in LOSSLESS_DERIVATIVES:
            save_options["lossless"] = True
        else:
            save_options.update({"quality": 92, "alpha_quality": 100})
        cutout.save(output_path, "WEBP", **save_options)
        validation = inspect_asset(output_path)
        entries.append(
            {
                "source": {
                    "path": source_path.relative_to(ROOT).as_posix(),
                    "dimensions": source_dimensions,
                    "bytes": source_path.stat().st_size,
                    "sha256": sha256(source_path),
                },
                "processed": {
                    "path": output_path.relative_to(ROOT).as_posix(),
                    "bytes": output_path.stat().st_size,
                    "sha256": sha256(output_path),
                    **validation,
                },
                "processing": processing,
            }
        )

    manifest = {
        "algorithm": (
            "deterministic asset-specific isolation using edge-connected matte removal or a "
            "sealed-product silhouette"
        ),
        "deterministic": True,
        "generative": False,
        "processor": "Pillow 12.0.0 (MIT-CMU)",
        "assets": entries,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return manifest


def verify_assets() -> dict[str, object]:
    if not MANIFEST_PATH.is_file():
        raise FileNotFoundError(f"Missing cutout manifest: {MANIFEST_PATH}")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    entries_by_name = {
        Path(entry["processed"]["path"]).name: entry for entry in manifest.get("assets", [])
    }
    for name in ASSET_NAMES:
        source_path = SOURCE_DIR / name
        output_path = OUTPUT_DIR / name
        if name not in entries_by_name:
            raise ValueError(f"Manifest does not contain {name}.")
        if sha256(source_path) != entries_by_name[name]["source"]["sha256"]:
            raise ValueError(f"Preserved source hash changed for {name}.")
        validation = inspect_asset(output_path)
        if output_path.stat().st_size > 250_000:
            raise ValueError(f"Processed asset is unexpectedly large: {output_path}")
        if sha256(output_path) != entries_by_name[name]["processed"]["sha256"]:
            raise ValueError(f"Processed hash does not match manifest for {name}.")
        if validation["dimensions"] != entries_by_name[name]["processed"]["dimensions"]:
            raise ValueError(f"Processed dimensions do not match manifest for {name}.")
    return manifest


def render_qa_composites(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    backgrounds = ((245, 244, 240, 255), (38, 51, 77, 255))
    panel_width = 240
    panel_height = 460
    for name in ASSET_NAMES:
        with Image.open(OUTPUT_DIR / name) as image:
            cutout = image.convert("RGBA")
            sheet = Image.new("RGBA", (panel_width * 2, panel_height), backgrounds[0])
            for index, background in enumerate(backgrounds):
                panel = Image.new("RGBA", (panel_width, panel_height), background)
                x = (panel_width - cutout.width) // 2
                y = (panel_height - cutout.height) // 2
                panel.alpha_composite(cutout, (x, y))
                sheet.alpha_composite(panel, (index * panel_width, 0))
            sheet.convert("RGB").save(directory / f"{Path(name).stem}-light-dark.png", "PNG")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify", action="store_true", help="Validate existing derivatives only.")
    parser.add_argument(
        "--qa-dir",
        type=Path,
        help="Optionally render temporary light/dark edge-inspection composites.",
    )
    args = parser.parse_args()
    manifest = verify_assets() if args.verify else process_assets()
    if args.qa_dir:
        render_qa_composites(args.qa_dir.resolve())
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
