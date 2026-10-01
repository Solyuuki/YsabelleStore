import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { BrandLogo } from "@/components/brand/BrandLogo";

const STORE_ENTRANCE_VIDEO = "/media/store-entrance.mp4";
const STORE_ENTRANCE_POSTER = "/images/discover/essentials/canned-goods-retail-display.webp";
const EXIT_DURATION_MS = 620;

export function StoreEntrance({ onEnter }: { onEnter: () => void }) {
  const [isExiting, setIsExiting] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function enterStore() {
    if (isExiting) return;

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
            onError={() => setVideoFailed(true)}
            playsInline
            poster={STORE_ENTRANCE_POSTER}
            preload="metadata"
          >
            <source src={STORE_ENTRANCE_VIDEO} type="video/mp4" />
          </video>
        )}
      </div>

      <div aria-hidden="true" className="store-entrance__scrim" />
      <div aria-hidden="true" className="store-entrance__vignette" />
      <div aria-hidden="true" className="store-entrance__exit-curtain" />

      <div className="store-entrance__content">
        <div className="store-entrance__brand" aria-label="Ysabelle Store">
          <BrandLogo className="store-entrance__logo" eager variant="full" />
          <span>
            <strong>Ysabelle</strong>
            <small>STORE</small>
          </span>
        </div>

        <div className="store-entrance__copy">
          <p className="store-entrance__eyebrow">Neighborhood grocery · Pasig City</p>
          <h1>
            Everyday groceries,
            <em>ready when you are.</em>
          </h1>
          <p className="store-entrance__lead">
            Step inside a compact neighborhood store stocked for everyday errands, quick pickups,
            and the things you reach for most.
          </p>
        </div>

        <div className="store-entrance__actions">
          <button className="store-entrance__enter" onClick={enterStore} type="button">
            <span>Enter the store</span>
            <ArrowRight aria-hidden="true" size={19} />
          </button>
          <span className="store-entrance__service-note">Order online · Store pickup</span>
        </div>
      </div>
    </main>
  );
}
