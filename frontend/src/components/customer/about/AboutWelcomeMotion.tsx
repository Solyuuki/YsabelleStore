import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ABOUT_ORIGIN_VIDEO = "/media/about-origin-motion-6738635d.mp4";
const LOOP_FADE_LEAD_SECONDS = 0.35;
const MAX_VIDEO_RETRIES = 1;

export function AboutWelcomeMotion() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const loopResetPendingRef = useRef(false);
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
  const [videoAttempt, setVideoAttempt] = useState(0);
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

  function markVideoReady(video: HTMLVideoElement) {
    setVideoReady(true);
    setVideoFailed(false);
    void video.play().catch(() => undefined);
  }

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
    const revealFirstFrame = () => {
      setIsLoopFading(false);
      loopResetPendingRef.current = false;
      video.removeEventListener("seeked", revealFirstFrame);
    };

    video.addEventListener("seeked", revealFirstFrame, { once: true });
    video.currentTime = 0;
    void video.play().catch(() => {
      video.removeEventListener("seeked", revealFirstFrame);
      setIsLoopFading(false);
      loopResetPendingRef.current = false;
    });
  }

  function handleVideoError() {
    setVideoReady(false);
    setIsLoopFading(false);
    loopResetPendingRef.current = false;

    if (videoAttempt < MAX_VIDEO_RETRIES) {
      setVideoAttempt((attempt) => attempt + 1);
      return;
    }

    setVideoFailed(true);

    if (import.meta.env.DEV) {
      console.error(
        `About origin motion failed to decode or load: ${ABOUT_ORIGIN_VIDEO}. Run npm run storefront:about-origin:verify.`
      );
    }
  }

  const videoSrc =
    videoAttempt === 0 ? ABOUT_ORIGIN_VIDEO : `${ABOUT_ORIGIN_VIDEO}?retry=${videoAttempt}`;

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
          autoPlay
          className="about-welcome-motion__video"
          key={videoAttempt}
          muted
          onCanPlay={(event) => markVideoReady(event.currentTarget)}
          onEnded={(event) => restartLoop(event.currentTarget)}
          onError={handleVideoError}
          onLoadedData={(event) => markVideoReady(event.currentTarget)}
          onTimeUpdate={(event) => maybeFadeForLoop(event.currentTarget)}
          playsInline
          preload="auto"
          ref={videoRef}
          src={videoSrc}
          tabIndex={-1}
        />
      ) : null}

      <span className="about-welcome-motion__scrim" />
      <span className="about-welcome-motion__edge-light" />
    </div>
  );
}
