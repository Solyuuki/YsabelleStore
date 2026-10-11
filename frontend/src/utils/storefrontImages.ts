import { resolveApiUrl } from "@/config/runtime";

const catalogImageRevisionByAssetId = {
  "sarima-p219-b7553e591e41": "edge-artifact-20260928"
} as const;

function withCatalogImageRevision(imageUrl: string) {
  for (const [assetId, revision] of Object.entries(catalogImageRevisionByAssetId)) {
    if (imageUrl.includes(`/product-images/${assetId}/`)) {
      return `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}v=${revision}`;
    }
  }

  return imageUrl;
}

export function getCatalogImageUrl(imageUrl: string | null | undefined) {
  const normalized = imageUrl?.trim();
  if (!normalized) {
    return null;
  }

  const resolved = normalized.startsWith("/api/")
    ? resolveApiUrl(normalized).toString()
    : normalized;
  return withCatalogImageRevision(resolved);
}

export async function preloadCatalogImage(
  imageUrl: string | null | undefined,
  signal?: AbortSignal
) {
  const source = getCatalogImageUrl(imageUrl);
  if (!source || typeof Image === "undefined") return;
  if (signal?.aborted) throw createImagePreloadAbortError();

  const image = new Image();
  image.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
    };
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Catalog image could not be preloaded."));
    };
    const handleAbort = () => {
      cleanup();
      image.src = "";
      reject(createImagePreloadAbortError());
    };

    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });
    image.src = source;
  });

  if (signal?.aborted) throw createImagePreloadAbortError();

  if (typeof image.decode === "function") {
    try {
      await image.decode();
    } catch {
      // A completed image can still be presented when decode() is unsupported or races the cache.
    }
  }

  if (signal?.aborted) throw createImagePreloadAbortError();
}

function createImagePreloadAbortError() {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Catalog image preload aborted.", "AbortError");
  }

  const error = new Error("Catalog image preload aborted.");
  error.name = "AbortError";
  return error;
}

export function hasCatalogImage<T extends { imageUrl?: string | null }>(
  product: T
): product is T & { imageUrl: string } {
  return getCatalogImageUrl(product.imageUrl) !== null;
}
