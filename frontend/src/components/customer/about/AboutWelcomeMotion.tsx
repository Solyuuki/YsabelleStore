import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ABOUT_ORIGIN_VIDEO = "/media/about-origin-motion.mp4";
const LOOP_FADE_LEAD_SECONDS = 0.55;
const LOOP_REVEAL_DELAY_MS = 70;

export function AboutWelcomeMotion() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopResetPendingRef = useRef(false);
  const loopRevealTimerRef = useRef<number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isLoopFading, setIsLoopFading] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleMotionPreference = () => setReduceMotion(media.matches);

    handleMotionPreference();
    media.addEventListener("change", handleMotionPreference);

    return () => media.removeEventListener("change", handleMotionPreference);
  }, []);

  useEffect(() => {
    return () => {
      if (loopRevealTimerRef.current !== null) {
        window.clearTimeout(loopRevealTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion || videoFailed) return;

    let visible = false;

    const syncPlayback = () => {
      if (document.visibilityState !== "visible" || !visible) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Keep the lightweight static fallback visible if autoplay is unavailable.
      });
    };

    const handleVisibility = () => syncPlayback();
    document.addEventListener("visibilitychange", handleVisibility);

    if (!("IntersectionObserver" in window)) {
      visible = true;
      syncPlayback();

      return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
        video.pause();
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        syncPlayback();
      },
      { threshold: 0.08 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      video.pause();
    };
  }, [reduceMotion, videoFailed]);

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

  function handleVideoError() {
    setVideoReady(false);
    setVideoFailed(true);
    setIsLoopFading(false);
    loopResetPendingRef.current = false;

    if (import.meta.env.DEV) {
      console.error(
        `About origin motion asset failed to load from ${ABOUT_ORIGIN_VIDEO}. Run: npm run storefront:about-origin:install`
      );
    }
  }

  return (
    <div
      aria-hidden="true"
      className={`about-welcome-motion${videoReady ? " is-video-ready" : ""}${
        isLoopFading ? " is-loop-fading" : ""
      }${videoFailed ? " has-video-error" : ""}`}
    >
      <div className="about-welcome-motion__fallback" />

      {!reduceMotion ? (
        <video
          className="about-welcome-motion__video"
          muted
          onCanPlay={() => {
            setVideoReady(true);
            setVideoFailed(false);
          }}
          onEnded={(event) => restartLoop(event.currentTarget)}
          onError={handleVideoError}
          onTimeUpdate={(event) => maybeFadeForLoop(event.currentTarget)}
          playsInline
          preload="auto"
          ref={videoRef}
          tabIndex={-1}
        >
          <source src={ABOUT_ORIGIN_VIDEO} type="video/mp4" />
        </video>
      ) : null}

      <span className="about-welcome-motion__scrim" />
      <span className="about-welcome-motion__edge-light" />
    </div>
  );
}
