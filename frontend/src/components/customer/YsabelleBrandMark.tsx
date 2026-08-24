import { Store } from "lucide-react";
import type { SyntheticEvent } from "react";

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
        src={officialLogoUrl}
        width={256}
      />
    </span>
  );
}
