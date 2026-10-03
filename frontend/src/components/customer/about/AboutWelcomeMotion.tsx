import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function AboutWelcomeMotion() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleMotionPreference = () => setReduceMotion(media.matches);

    handleMotionPreference();
    media.addEventListener("change", handleMotionPreference);

    return () => media.removeEventListener("change", handleMotionPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;

    let visible = false;

    const syncPlayback = () => {
      if (document.visibilityState !== "visible" || !visible) {
        video.pause();
        return;
      }

      void video.play().catch(() => {
        // Muted inline playback is expected to succeed; keep the static fallback if it does not.
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
  }, [reduceMotion]);

  return (
    <div aria-hidden="true" className="about-welcome-motion">
      {!reduceMotion ? (
        <video
          className="about-welcome-motion__video"
          loop
          muted
          playsInline
          preload="auto"
          ref={videoRef}
          tabIndex={-1}
        >
          <source src="/media/about-origin-motion.mp4" type="video/mp4" />
        </video>
      ) : null}
      <span className="about-welcome-motion__scrim" />
      <span className="about-welcome-motion__edge-light" />
    </div>
  );
}
