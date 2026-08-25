import { ImageOff } from "lucide-react";
import {
  useEffect,
  useState,
  type CSSProperties,
  type ImgHTMLAttributes,
  type SyntheticEvent
} from "react";

import {
  describeCatalogImage,
  getCatalogImageMetadata,
  type CatalogImageMetadata
} from "@/utils/catalogImageMetadata";
import { getCatalogImageUrl } from "@/utils/storefrontImages";

type ProductImageProps = {
  alt: string;
  className?: string;
  fallbackLabel?: string;
  imageUrl?: string | null;
  loading?: ImgHTMLAttributes<HTMLImageElement>["loading"];
  fetchPriority?: ImgHTMLAttributes<HTMLImageElement>["fetchPriority"];
};

export function ProductImage({
  alt,
  className = "",
  fallbackLabel = "Catalog image pending",
  fetchPriority,
  imageUrl,
  loading = "lazy"
}: ProductImageProps) {
  const source = getCatalogImageUrl(imageUrl);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const knownMetadata = getCatalogImageMetadata(source);
  const [detectedMetadata, setDetectedMetadata] = useState<CatalogImageMetadata | null>(null);
  const metadata = knownMetadata ?? detectedMetadata;
  const presentation = metadata ? describeCatalogImage(metadata.width, metadata.height) : null;
  const isAvailable = Boolean(source && failedSource !== source);
  const imageStyle = metadata
    ? ({
        "--catalog-image-natural-height": `${metadata.height}px`,
        "--catalog-image-natural-width": `${metadata.width}px`
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    setFailedSource(null);
    setDetectedMetadata(null);
  }, [source]);

  function handleLoad(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    if (!knownMetadata) {
      setDetectedMetadata({
        background: "transparent",
        height: image.naturalHeight,
        width: image.naturalWidth
      });
    }
  }

  return (
    <span
      aria-label={isAvailable ? undefined : `${alt}. Image unavailable.`}
      className={`catalog-product-image ${className}`.trim()}
      data-image-background={metadata?.background}
      data-image-state={isAvailable ? "available" : "fallback"}
      data-image-resolution={presentation?.resolution}
      data-image-shape={presentation?.shape}
      role={isAvailable ? undefined : "img"}
      style={imageStyle}
    >
      {isAvailable && source ? (
        <img
          alt={alt}
          decoding="async"
          draggable={false}
          fetchPriority={fetchPriority}
          height={metadata?.height}
          loading={loading}
          onError={() => setFailedSource(source)}
          onLoad={handleLoad}
          src={source}
          width={metadata?.width}
        />
      ) : (
        <span aria-hidden="true" className="catalog-product-image__fallback">
          <ImageOff aria-hidden="true" />
          <small>{fallbackLabel}</small>
        </span>
      )}
    </span>
  );
}
