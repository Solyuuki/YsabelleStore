import { useState } from "react";

const BRAND_LOGO_SRC = "/brand/ysabelle-logo-v2.png";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const classes = ["ys-brand-logo", className].filter(Boolean).join(" ");

  if (imageFailed) {
    return (
      <svg
        aria-hidden="true"
        className={classes}
        focusable="false"
        viewBox="0 0 64 64"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M18 21h28l-3.5 29h-21L18 21Z"
          fill="#625bff"
          stroke="#625bff"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        <path
          d="M24 22c0-5 3.6-9 8-9s8 4 8 9"
          fill="none"
          stroke="#008cff"
          strokeLinecap="round"
          strokeWidth="4"
        />
        <path
          d="m24.5 30.5 7.5 7 7.5-7M32 37.5V45"
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
      </svg>
    );
  }

  return (
    <img
      alt=""
      aria-hidden="true"
      className={classes}
      decoding="async"
      onError={() => setImageFailed(true)}
      src={BRAND_LOGO_SRC}
    />
  );
}
