type YsabelleBrandMarkProps = {
  className?: string;
  eager?: boolean;
  variant?: "compact" | "display" | "mini";
};

function resolvePublicBrandAsset(fileName: string) {
  const relativeSource = `./brand/${fileName}`;
  if (window.location.protocol === "file:") {
    return new URL(relativeSource, document.baseURI).href;
  }

  return `/brand/${fileName}`;
}

export function YsabelleBrandMark({
  className = "",
  eager = false,
  variant = "compact"
}: YsabelleBrandMarkProps) {
  const fileName = variant === "display" ? "apple-touch-icon.png" : "favicon-48x48.png";
  const source = resolvePublicBrandAsset(fileName);

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
        height={variant === "display" ? 180 : 48}
        loading={eager ? "eager" : "lazy"}
        src={source}
        width={variant === "display" ? 180 : 48}
      />
    </span>
  );
}
