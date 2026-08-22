import path from "node:path";

const LEGACY_PRODUCT_IMAGE_PATTERN = /^\/images\/products\/([^/?#\\]+)$/;

export function resolveLegacyProductImageSource(
  repositoryRoot: string,
  imageUrl: string | null
) {
  if (!imageUrl) {
    return null;
  }

  const match = LEGACY_PRODUCT_IMAGE_PATTERN.exec(imageUrl);
  const basename = match?.[1];

  if (!basename || basename === "." || basename === "..") {
    return null;
  }

  return path.join(
    repositoryRoot,
    "frontend",
    "public",
    "images",
    "products",
    "originals",
    basename
  );
}
