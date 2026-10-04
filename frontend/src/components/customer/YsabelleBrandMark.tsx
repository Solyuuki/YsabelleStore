import officialLogoUrl from "@/assets/brand/ysabelle-logo-official.webp";

const BRAND_ASSET_VERSION = "fullmark-2e25e00f";
const WEB_BRAND_MARK_SRC = `/brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION}`;
const WEB_BRAND_MARK_SRC_SET = [
  `/brand/ysabelle-store-mark-128.png?v=${BRAND_ASSET_VERSION} 128w`,
  `/brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION} 256w`
].join(", ");

type YsabelleBrandMarkProps = {
  className?: string;
  eager?: boolean;
  sizes?: string;
  variant?: "compact" | "display" | "mini";
};

export function YsabelleBrandMark({
  className = "",
  eager = false,
  sizes,
  variant = "compact"
}: YsabelleBrandMarkProps) {
  const isFileProtocol = window.location.protocol === "file:";
  const source = isFileProtocol ? officialLogoUrl : WEB_BRAND_MARK_SRC;
  const sourceSet = isFileProtocol ? undefined : WEB_BRAND_MARK_SRC_SET;

  return (
    <span
      aria-hidden="true"
      className={`ysabelle-brand-mark ysabelle-brand-mark--${variant} ${className}`.trim()}
    >
      <img
        alt=""
        aria-hidden="true"
        className="ysabelle-brand-mark__image"
        decoding="async"
        height={256}
        loading={eager ? "eager" : "lazy"}
        sizes={sizes ?? (variant === "display" ? "112px" : variant === "mini" ? "36px" : "48px")}
        src={source}
        srcSet={sourceSet}
        width={256}
      />
    </span>
  );
}
