import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const CATALOG_VIDEO_FILE = "gemini_generated_video_00ca849a.mp4";
const CROSSFADE_LEAD_SECONDS = 0.85;
const CROSSFADE_DURATION_MS = 680;

function resolveCatalogVideo() {
  if (window.location.protocol === "file:") {
    return new URL(`./media/${CATALOG_VIDEO_FILE}`, document.baseURI).href;
  }

  return `/media/${CATALOG_VIDEO_FILE}`;
}

export function AboutCatalogMotion() {
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const;
  const activeIndexRef = useRef<0 | 1>(0);
  const transitioningRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const resetFrameRef = useRef<number | null>(null);

  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
  const [videoReady, setVideoReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState<0 | 1>(0);
  const [incomingIndex, setIncomingIndex] = useState<0 | 1 | null>(null);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleChange = () => setReduceMotion(media.matches);

    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
      if (resetFrameRef.current !== null) window.cancelAnimationFrame(resetFrameRef.current);
      videoRefs.forEach((ref) => ref.current?.pause());
    };
  }, []);

  function markReady(video: HTMLVideoElement) {
    setVideoReady(true);
    void video.play().catch(() => undefined);
  }

  function beginCrossfade(fromIndex: 0 | 1) {
    if (transitioningRef.current || fromIndex !== activeIndexRef.current) return;

    const toIndex: 0 | 1 = fromIndex === 0 ? 1 : 0;
    const outgoingVideo = videoRefs[fromIndex].current;
    const incomingVideo = videoRefs[toIndex].current;
    if (!outgoingVideo || !incomingVideo) return;

    transitioningRef.current = true;
    incomingVideo.currentTime = 0;

    void incomingVideo
      .play()
      .then(() => {
        setIncomingIndex(toIndex);

        transitionTimerRef.current = window.setTimeout(() => {
          activeIndexRef.current = toIndex;
          setActiveIndex(toIndex);
          setIncomingIndex(null);
          transitionTimerRef.current = null;

          resetFrameRef.current = window.requestAnimationFrame(() => {
            outgoingVideo.pause();
            outgoingVideo.currentTime = 0;
            transitioningRef.current = false;
            resetFrameRef.current = null;
          });
        }, CROSSFADE_DURATION_MS);
      })
      .catch(() => {
        transitioningRef.current = false;
        setIncomingIndex(null);
      });
  }

  function maybeCrossfade(video: HTMLVideoElement, index: 0 | 1) {
    if (
      index !== activeIndexRef.current ||
      transitioningRef.current ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration - video.currentTime > CROSSFADE_LEAD_SECONDS
    ) {
      return;
    }

    beginCrossfade(index);
  }

  const source = resolveCatalogVideo();

  return (
    <div
      aria-hidden="true"
      className={`about-catalog-motion${videoReady ? " is-video-ready" : ""}`}
    >
      <div className="about-catalog-motion__fallback" />

      {!reduceMotion ? (
        <>
          {[0, 1].map((rawIndex) => {
            const index = rawIndex as 0 | 1;
            return (
              <video
                autoPlay={index === 0}
                className={`about-catalog-motion__video${
                  index === activeIndex ? " is-active" : ""
                }${index === incomingIndex ? " is-incoming" : ""}`}
                key={index}
                muted
                onCanPlay={index === 0 ? (event) => markReady(event.currentTarget) : undefined}
                onEnded={() => beginCrossfade(index)}
                onLoadedData={index === 0 ? (event) => markReady(event.currentTarget) : undefined}
                onPlaying={index === 0 ? (event) => markReady(event.currentTarget) : undefined}
                onTimeUpdate={(event) => maybeCrossfade(event.currentTarget, index)}
                playsInline
                preload="auto"
                ref={videoRefs[index]}
                src={source}
                tabIndex={-1}
              />
            );
          })}
        </>
      ) : null}

      <span className="about-catalog-motion__glass" />
    </div>
  );
}
