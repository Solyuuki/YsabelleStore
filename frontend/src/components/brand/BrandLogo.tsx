import officialLogoUrl from "@/assets/brand/ysabelle-logo-official.webp";

type BrandLogoProps = {
  className?: string;
  eager?: boolean;
  variant?: "mark" | "full";
};

export function BrandLogo({ className, eager = false }: BrandLogoProps) {
  const classes = ["ys-brand-logo", className].filter(Boolean).join(" ");

  return (
    <img
      alt=""
      aria-hidden="true"
      className={classes}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      src={officialLogoUrl}
    />
  );
}
