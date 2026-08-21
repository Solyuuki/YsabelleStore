import { Store } from "lucide-react";
import type { SyntheticEvent } from "react";

const BRAND_ASSET_VERSION = "a4f0dde2";
const BRAND_MARK_SRC = `/brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION}`;
const BRAND_MARK_SRC_SET = [
  `/brand/ysabelle-store-mark-128.png?v=${BRAND_ASSET_VERSION} 128w`,
  `/brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION} 256w`
].join(", ");

type YsabelleBrandMarkProps = {
  className?: string;
  eager?: boolean;
  variant?: "compact" | "display" | "mini";
};

export function YsabelleBrandMark({
  className = "",
  eager = false,
  variant = "compact"
}: YsabelleBrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`ysabelle-brand-mark ysabelle-brand-mark--${variant} ${className}`.trim()}
    >
      <Store className="ysabelle-brand-mark__fallback" />
      <img
        alt=""
        className="ysabelle-brand-mark__image"
        decoding="async"
        height={256}
        loading={eager ? "eager" : "lazy"}
        onError={(event: SyntheticEvent<HTMLImageElement>) => {
          event.currentTarget.hidden = true;
        }}
        sizes={variant === "display" ? "112px" : variant === "mini" ? "36px" : "48px"}
        src={BRAND_MARK_SRC}
        srcSet={BRAND_MARK_SRC_SET}
        width={256}
      />
    </span>
  );
}
