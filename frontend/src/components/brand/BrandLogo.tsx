const BRAND_ASSET_VERSION = "canonical-mark-20260930";
const WEB_BRAND_MARK_SRC = `/brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION}`;
const FILE_BRAND_MARK_SRC = `./brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION}`;

type BrandLogoProps = {
  className?: string;
  eager?: boolean;
  variant?: "mark" | "full";
};

function resolveCanonicalBrandSource() {
  if (window.location.protocol === "file:") {
    return new URL(FILE_BRAND_MARK_SRC, document.baseURI).href;
  }

  return WEB_BRAND_MARK_SRC;
}

export function BrandLogo({ className, eager = false, variant = "mark" }: BrandLogoProps) {
  const classes = ["ys-brand-logo", className].filter(Boolean).join(" ");

  return (
    <img
      alt=""
      aria-hidden="true"
      className={classes}
      data-brand-variant={variant}
      decoding="async"
      draggable={false}
      fetchPriority={eager ? "high" : "auto"}
      height={256}
      loading={eager ? "eager" : "lazy"}
      src={resolveCanonicalBrandSource()}
      width={256}
    />
  );
}
