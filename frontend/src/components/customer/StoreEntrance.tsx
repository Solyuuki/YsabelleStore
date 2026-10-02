import { useEffect, useRef, useState } from "react";

import { YsabelleBrandMark } from "./YsabelleBrandMark";

const STORE_ENTRANCE_VIDEO = "/media/store-entrance.mp4?v=53360d48";
const STORE_ENTRANCE_POSTER =
  "/images/discover/essentials/canned-goods-retail-display.webp";

const EXIT_DURATION_MS = 620;
const LOOP_CROSSFADE_SECONDS = 0.9;
const LOOP_CROSSFADE_MS = 820;

export function StoreEntrance({ onEnter }: { onEnter: () => void }) {
  const primaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const loopTransitioningRef = useRef(false);
  const loopSettleTimerRef = useRef<number | null>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState<0 | 1>(0);
  const [isExiting, setIsExiting] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    return () => {
      if (loopSettleTimerRef.current !== null) {
        window.clearTimeout(loopSettleTimerRef.current);
      }
    };
  }, []);

  function getVideo(index: 0 | 1) {
    return index === 0 ? primaryVideoRef.current : secondaryVideoRef.current;
  }

  function startNextLoop(fromIndex: 0 | 1) {
    if (loopTransitioningRef.current || activeVideoIndex !== fromIndex) return;

    const current = getVideo(fromIndex);
    const nextIndex: 0 | 1 = fromIndex === 0 ? 1 : 0;
    const next = getVideo(nextIndex);

    if (!current || !next) return;

    loopTransitioningRef.current = true;
    next.currentTime = 0;

    void next
      .play()
      .then(() => {
        setActiveVideoIndex(nextIndex);

        if (loopSettleTimerRef.current !== null) {
          window.clearTimeout(loopSettleTimerRef.current);
        }

        loopSettleTimerRef.current = window.setTimeout(() => {
          current.pause();
          current.currentTime = 0;
          loopTransitioningRef.current = false;
          loopSettleTimerRef.current = null;
        }, LOOP_CROSSFADE_MS);
      })
      .catch(() => {
        loopTransitioningRef.current = false;
      });
  }

  function maybeCrossfadeLoop(index: 0 | 1, video: HTMLVideoElement) {
    if (
      activeVideoIndex !== index ||
      loopTransitioningRef.current ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0
    ) {
      return;
    }

    if (video.duration - video.currentTime <= LOOP_CROSSFADE_SECONDS) {
      startNextLoop(index);
    }
  }

  function enterStore() {
    if (isExiting) return;

    primaryVideoRef.current?.pause();
    secondaryVideoRef.current?.pause();

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
          <>
            <video
              autoPlay
              className={`store-entrance__video ${activeVideoIndex === 0 ? "is-active" : ""}`}
              muted
              onCanPlay={(event) => {
                if (activeVideoIndex === 0) {
                  void event.currentTarget.play().catch(() => undefined);
                }
              }}
              onEnded={() => startNextLoop(0)}
              onError={() => setVideoFailed(true)}
              onTimeUpdate={(event) => maybeCrossfadeLoop(0, event.currentTarget)}
              playsInline
              poster={STORE_ENTRANCE_POSTER}
              preload="auto"
              ref={primaryVideoRef}
            >
              <source src={STORE_ENTRANCE_VIDEO} type="video/mp4" />
            </video>
            <video
              className={`store-entrance__video ${activeVideoIndex === 1 ? "is-active" : ""}`}
              muted
              onCanPlay={(event) => {
                if (activeVideoIndex === 1) {
                  void event.currentTarget.play().catch(() => undefined);
                }
              }}
              onEnded={() => startNextLoop(1)}
              onError={() => setVideoFailed(true)}
              onTimeUpdate={(event) => maybeCrossfadeLoop(1, event.currentTarget)}
              playsInline
              preload="auto"
              ref={secondaryVideoRef}
            >
              <source src={STORE_ENTRANCE_VIDEO} type="video/mp4" />
            </video>
          </>
        )}
      </div>

      <div aria-hidden="true" className="store-entrance__scrim" />
      <div aria-hidden="true" className="store-entrance__vignette" />
      <div aria-hidden="true" className="store-entrance__exit-curtain" />

      <div className="store-entrance__content">
        <YsabelleBrandMark
          className="store-entrance__brand-mark"
          eager
          variant="display"
        />

        <div className="store-entrance__copy">
          <h1>
            <span>Your Neighborhood Store,</span>
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
