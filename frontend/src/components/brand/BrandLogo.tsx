import officialLogoUrl from "@/assets/brand/ysabelle-logo-official.webp";

const BRAND_ASSET_VERSION = "fullmark-2e25e00f";
const WEB_BRAND_MARK_SRC = `/brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION}`;

type BrandLogoProps = {
  className?: string;
  eager?: boolean;
  variant?: "mark" | "full";
};

export function BrandLogo({ className, eager = false, variant = "mark" }: BrandLogoProps) {
  const classes = ["ys-brand-logo", className].filter(Boolean).join(" ");
  const source =
    variant === "full" || window.location.protocol === "file:"
      ? officialLogoUrl
      : WEB_BRAND_MARK_SRC;

  return (
    <img
      alt=""
      aria-hidden="true"
      className={classes}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      src={source}
    />
  );
}
