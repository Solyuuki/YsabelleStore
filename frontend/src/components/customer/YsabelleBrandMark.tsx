import officialMark128Url from "@/assets/brand/ysabelle-approved-mark-128.png";
import officialMark180Url from "@/assets/brand/ysabelle-approved-mark-180.png";

const APPROVED_MARK_SOURCES = `${officialMark128Url} 128w, ${officialMark180Url} 180w`;

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
        height={180}
        loading={eager ? "eager" : "lazy"}
        sizes={sizes ?? (variant === "display" ? "112px" : variant === "mini" ? "36px" : "48px")}
        src={officialMark180Url}
        srcSet={APPROVED_MARK_SOURCES}
        width={180}
      />
    </span>
  );
}
