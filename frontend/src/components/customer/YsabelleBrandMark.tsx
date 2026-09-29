import officialLogoUrl from "@/assets/brand/ysabelle-logo-official.webp";

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
      <img
        alt=""
        aria-hidden="true"
        className="ysabelle-brand-mark__image"
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        src={officialLogoUrl}
      />
    </span>
  );
}
