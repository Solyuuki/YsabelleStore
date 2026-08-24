import { useState } from "react";

import officialLogoUrl from "@/assets/brand/ysabelle-logo-official.webp";

const BRAND_ASSET_VERSION = "fullmark-2e25e00f";
const WEB_BRAND_MARK_SRC = `/brand/ysabelle-store-mark-256.png?v=${BRAND_ASSET_VERSION}`;

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className }: BrandLogoProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const classes = ["ys-brand-logo", className].filter(Boolean).join(" ");
  const source = window.location.protocol === "file:" ? officialLogoUrl : WEB_BRAND_MARK_SRC;

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
      src={source}
    />
  );
}
