import { ArrowRight } from "lucide-react";
import { useRef, useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";

const STORE_ENTRANCE_VIDEO = "/media/store-entrance.mp4?v=26c4d4b0";
const STORE_ENTRANCE_LOGO = "/brand/store-entrance-logo.png?v=12c660a6";
const STORE_ENTRANCE_POSTER =
  "/images/discover/essentials/canned-goods-retail-display.webp";

const EXIT_DURATION_MS = 620;

export function StoreEntrance({ onEnter }: { onEnter: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function enterStore() {
    if (isExiting) return;

    videoRef.current?.pause();

    if (prefersReducedMotion) {
      onEnter();
      return;
    }

    setIsExiting(true);
    window.setTimeout(onEnter, EXIT_DURATION_MS);
  }

  return (
    <main
      aria-label="Ysabelle Store entrance"
      className={`customer-app store-entrance ${isExiting ? "is-exiting" : ""}`}
    >
      <div aria-hidden="true" className="store-entrance__media">
        {prefersReducedMotion || videoFailed ? (
          <img alt="" className="store-entrance__poster" src={STORE_ENTRANCE_POSTER} />
        ) : (
          <video
            autoPlay
            className="store-entrance__video"
            loop
            muted
            onCanPlay={(event) => {
              void event.currentTarget.play().catch(() => undefined);
            }}
            onError={() => setVideoFailed(true)}
            playsInline
            poster={STORE_ENTRANCE_POSTER}
            preload="auto"
            ref={videoRef}
          >
            <source src={STORE_ENTRANCE_VIDEO} type="video/mp4" />
          </video>
        )}
      </div>

      <div aria-hidden="true" className="store-entrance__scrim" />
      <div aria-hidden="true" className="store-entrance__vignette" />
      <div aria-hidden="true" className="store-entrance__exit-curtain" />

      <div className="store-entrance__content">
        <div className="store-entrance__logo-wrap">
          {logoFailed ? (
            <BrandLogo className="store-entrance__logo" eager variant="full" />
          ) : (
            <img
              alt="Ysabelle Store"
              className="store-entrance__logo"
              decoding="async"
              draggable={false}
              onError={() => setLogoFailed(true)}
              src={STORE_ENTRANCE_LOGO}
            />
          )}
        </div>

        <div className="store-entrance__copy">
          <h1>
            <span>Your neighborhood store,</span>
            <span>now online.</span>
          </h1>
        </div>

        <button className="store-entrance__enter" onClick={enterStore} type="button">
          <span>Get Started</span>
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
    </main>
  );
}
