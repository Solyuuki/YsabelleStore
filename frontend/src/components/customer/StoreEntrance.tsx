import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STORE_ENTRANCE_VIDEO = "/media/store-entrance.mp4?v=26c4d4b0";
const STORE_ENTRANCE_LOGO = "/brand/store-entrance-logo.png?v=12c660a6";
const STORE_ENTRANCE_LOGO_FALLBACK = "/brand/ysabelle-store-mark.png";
const STORE_ENTRANCE_POSTER =
  "/images/discover/essentials/canned-goods-retail-display.webp";

const EXIT_DURATION_MS = 620;

type FadeWindow = {
  end: number;
  peak: number;
  start: number;
};

const SCENE_FADE_WINDOWS: readonly FadeWindow[] = [
  // Hard scene cut: aisle -> refrigerators.
  { start: 1.88, peak: 2.0, end: 2.12 },
  // Gemini dissolve: refrigerators -> snacks.
  { start: 3.95, peak: 4.25, end: 4.55 },
  // Gemini dissolve: snacks -> personal care.
  { start: 5.75, peak: 6.0, end: 6.25 },
  // Hard scene cut: personal care -> household.
  { start: 7.88, peak: 8.0, end: 8.12 },
  // Gemini dissolve: household -> cooking/pantry.
  { start: 9.25, peak: 9.48, end: 9.7 }
];

const LOOP_FADE_OUT_START = 9.72;
const LOOP_FADE_IN_END = 0.34;
const FALLBACK_DURATION_SECONDS = 10;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothStep(value: number) {
  const progress = clamp01(value);
  return progress * progress * (3 - 2 * progress);
}

function fadeWindowOpacity(time: number, window: FadeWindow) {
  if (time < window.start || time > window.end) return 0;

  if (time <= window.peak) {
    return smoothStep((time - window.start) / (window.peak - window.start));
  }

  return 1 - smoothStep((time - window.peak) / (window.end - window.peak));
}

function sceneCurtainOpacity(time: number, duration: number) {
  let opacity = 0;

  // The first frame starts black and reveals the moving source video.
  if (time <= LOOP_FADE_IN_END) {
    opacity = Math.max(opacity, 1 - smoothStep(time / LOOP_FADE_IN_END));
  }

  for (const window of SCENE_FADE_WINDOWS) {
    opacity = Math.max(opacity, fadeWindowOpacity(time, window));
  }

  const resolvedDuration =
    Number.isFinite(duration) && duration > LOOP_FADE_OUT_START
      ? duration
      : FALLBACK_DURATION_SECONDS;

  if (time >= LOOP_FADE_OUT_START) {
    opacity = Math.max(
      opacity,
      smoothStep(
        (time - LOOP_FADE_OUT_START) /
          Math.max(0.01, resolvedDuration - LOOP_FADE_OUT_START)
      )
    );
  }

  return clamp01(opacity);
}

export function StoreEntrance({ onEnter }: { onEnter: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sceneCurtainRef = useRef<HTMLDivElement | null>(null);
  const exitingRef = useRef(false);

  const [isExiting, setIsExiting] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (prefersReducedMotion || videoFailed) return;

    let animationFrame = 0;

    function syncCurtainToVideo() {
      const video = videoRef.current;
      const curtain = sceneCurtainRef.current;

      if (video && curtain) {
        curtain.style.opacity = String(sceneCurtainOpacity(video.currentTime, video.duration));
      }

      animationFrame = window.requestAnimationFrame(syncCurtainToVideo);
    }

    animationFrame = window.requestAnimationFrame(syncCurtainToVideo);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [prefersReducedMotion, videoFailed]);

  useEffect(() => {
    function handleVisibilityChange() {
      const video = videoRef.current;
      if (!video || prefersReducedMotion || videoFailed || exitingRef.current) return;

      if (document.hidden) {
        video.pause();
        return;
      }

      void video.play().catch(() => undefined);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [prefersReducedMotion, videoFailed]);

  function enterStore() {
    if (isExiting) return;

    exitingRef.current = true;
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
      <div
        aria-hidden="true"
        className="store-entrance__scene-curtain"
        ref={sceneCurtainRef}
        style={prefersReducedMotion || videoFailed ? { opacity: 0 } : undefined}
      />
      <div aria-hidden="true" className="store-entrance__exit-curtain" />

      <div className="store-entrance__content">
        <img
          alt="Ysabelle Store"
          className="store-entrance__logo"
          decoding="async"
          draggable={false}
          onError={(event) => {
            if (!event.currentTarget.src.endsWith(STORE_ENTRANCE_LOGO_FALLBACK)) {
              event.currentTarget.src = STORE_ENTRANCE_LOGO_FALLBACK;
            }
          }}
          src={STORE_ENTRANCE_LOGO}
        />

        <div className="store-entrance__copy">
          <h1>Your neighborhood store, now online.</h1>
        </div>

        <button className="store-entrance__enter" onClick={enterStore} type="button">
          <span>Get Started</span>
          <ArrowRight aria-hidden="true" size={18} />
        </button>
      </div>
    </main>
  );
}
