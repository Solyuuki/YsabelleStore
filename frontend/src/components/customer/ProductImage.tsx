import { ImageOff } from "lucide-react";
import { useEffect, useState, type ImgHTMLAttributes } from "react";

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
  const isAvailable = Boolean(source && failedSource !== source);

  useEffect(() => setFailedSource(null), [source]);

  return (
    <span
      aria-label={isAvailable ? alt : `${alt}. Image unavailable.`}
      className={`catalog-product-image ${className}`.trim()}
      data-image-state={isAvailable ? "available" : "fallback"}
      role="img"
    >
      {isAvailable && source ? (
        <img
          alt=""
          decoding="async"
          fetchPriority={fetchPriority}
          loading={loading}
          onError={() => setFailedSource(source)}
          src={source}
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
