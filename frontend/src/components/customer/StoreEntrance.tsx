import { useEffect, useRef, useState } from "react";

import { YsabelleBrandMark } from "./YsabelleBrandMark";

const STORE_ENTRANCE_VIDEO = "/media/store-entrance.mp4?v=53360d48";
const STORE_ENTRANCE_POSTER =
  "/images/discover/essentials/canned-goods-retail-display.webp";

const EXIT_DURATION_MS = 620;
const LOOP_FADE_LEAD_SECONDS = 0.55;
const LOOP_REVEAL_DELAY_MS = 30;

export function StoreEntrance({ onEnter }: { onEnter: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loopResetPendingRef = useRef(false);
  const loopRevealTimerRef = useRef<number | null>(null);
  const [isLoopFading, setIsLoopFading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    return () => {
      if (loopRevealTimerRef.current !== null) {
        window.clearTimeout(loopRevealTimerRef.current);
      }
    };
  }, []);

  function maybeFadeForLoop(video: HTMLVideoElement) {
    if (
      loopResetPendingRef.current ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    if (video.duration - video.currentTime <= LOOP_FADE_LEAD_SECONDS) {
      loopResetPendingRef.current = true;
      setIsLoopFading(true);
    }
  }

  function restartLoop(video: HTMLVideoElement) {
    video.currentTime = 0;

    void video
      .play()
      .then(() => {
        loopRevealTimerRef.current = window.setTimeout(() => {
          setIsLoopFading(false);
          loopResetPendingRef.current = false;
          loopRevealTimerRef.current = null;
        }, LOOP_REVEAL_DELAY_MS);
      })
      .catch(() => {
        setIsLoopFading(false);
        loopResetPendingRef.current = false;
      });
  }

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
            muted
            onCanPlay={(event) => {
              void event.currentTarget.play().catch(() => undefined);
            }}
            onEnded={(event) => restartLoop(event.currentTarget)}
            onError={() => setVideoFailed(true)}
            onTimeUpdate={(event) => maybeFadeForLoop(event.currentTarget)}
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
      <div
        aria-hidden="true"
        className={`store-entrance__loop-curtain ${isLoopFading ? "is-visible" : ""}`}
      />
      <div aria-hidden="true" className="store-entrance__exit-curtain" />

      <div className="store-entrance__content">
        <YsabelleBrandMark
          className="store-entrance__brand-mark"
          eager
          variant="display"
        />

        <div className="store-entrance__copy">
          <h1>
            <span>Your Neighborhood Store</span>
            <span>Now Online.</span>
          </h1>
        </div>

        <button className="store-entrance__enter" onClick={enterStore} type="button">
          <span>Get Started</span>
        </button>
      </div>
    </main>
  );
}