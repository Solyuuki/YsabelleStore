import officialMark128Url from "@/assets/brand/ysabelle-approved-mark-128.png";
import officialMark180Url from "@/assets/brand/ysabelle-approved-mark-180.png";

const APPROVED_MARK_SOURCES = `${officialMark128Url} 128w, ${officialMark180Url} 180w`;

type BrandLogoProps = {
  className?: string;
  eager?: boolean;
  variant?: "mark" | "full";
};

export function BrandLogo({ className, eager = false, variant = "mark" }: BrandLogoProps) {
  const classes = ["ys-brand-logo", className].filter(Boolean).join(" ");

  return (
    <img
      alt=""
      aria-hidden="true"
      className={classes}
      decoding="async"
      height={180}
      loading={eager ? "eager" : "lazy"}
      sizes={variant === "full" ? "180px" : "48px"}
      src={officialMark180Url}
      srcSet={APPROVED_MARK_SOURCES}
      width={180}
    />
  );
}
