import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const FORECAST_VIDEO_FILE = "gemini_generated_video_9d3956f0.mp4";

function resolveForecastVideo() {
  if (window.location.protocol === "file:") {
    return new URL(`./media/${FORECAST_VIDEO_FILE}`, document.baseURI).href;
  }

  return `/media/${FORECAST_VIDEO_FILE}`;
}

export function AboutForecastMotion() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = () => setReduceMotion(media.matches);

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    return () => {
      videoRef.current?.pause();
    };
  }, []);

  function markReady(video: HTMLVideoElement) {
    video.pause();

    if (Number.isFinite(video.duration) && video.duration > 0) {
      try {
        video.currentTime = 0;
      } catch {
        // Some browsers reject an early seek until enough metadata is buffered.
      }
    }

    setVideoReady(true);
  }

  const source = resolveForecastVideo();

  return (
    <div
      aria-hidden="true"
      className={`about-forecast-motion${videoReady ? " is-video-ready" : ""}`}
    >
      <div className="about-forecast-motion__fallback" />

      {!reduceMotion ? (
        <video
          className="about-forecast-motion__video is-active"
          data-forecast-video
          muted
          onCanPlay={(event) => markReady(event.currentTarget)}
          onLoadedData={(event) => markReady(event.currentTarget)}
          onLoadedMetadata={(event) => markReady(event.currentTarget)}
          playsInline
          preload="auto"
          ref={videoRef}
          src={source}
          tabIndex={-1}
        />
      ) : null}

      <span className="about-forecast-motion__wash" />
    </div>
  );
}
