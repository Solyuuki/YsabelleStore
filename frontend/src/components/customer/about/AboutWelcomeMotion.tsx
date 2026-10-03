import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ABOUT_ORIGIN_VIDEO = "/media/about-origin-motion.mp4";

export function AboutWelcomeMotion() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleMotionPreference = () => setReduceMotion(media.matches);

    handleMotionPreference();
    media.addEventListener("change", handleMotionPreference);

    return () => media.removeEventListener("change", handleMotionPreference);
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
        // Keep the animated CSS fallback visible if browser autoplay is unavailable.
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

  function handleVideoError() {
    setVideoReady(false);
    setVideoFailed(true);

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
        videoFailed ? " has-video-error" : ""
      }`}
    >
      <div className="about-welcome-motion__fallback">
        <span className="about-welcome-motion__orbit about-welcome-motion__orbit--one" />
        <span className="about-welcome-motion__orbit about-welcome-motion__orbit--two" />
        <span className="about-welcome-motion__float about-welcome-motion__float--one" />
        <span className="about-welcome-motion__float about-welcome-motion__float--two" />
        <span className="about-welcome-motion__float about-welcome-motion__float--three" />
      </div>

      {!reduceMotion ? (
        <video
          className="about-welcome-motion__video"
          loop
          muted
          onCanPlay={() => setVideoReady(true)}
          onError={handleVideoError}
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
