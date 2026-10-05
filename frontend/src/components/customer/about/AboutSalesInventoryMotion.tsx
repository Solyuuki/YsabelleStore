import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const SALES_INVENTORY_VIDEO_FILE = "gemini_generated_video_2e78399f.mp4";
const CROSSFADE_LEAD_SECONDS = 0.85;
const CROSSFADE_DURATION_MS = 680;

function resolveSalesInventoryVideo() {
  if (window.location.protocol === "file:") {
    return new URL(`./media/${SALES_INVENTORY_VIDEO_FILE}`, document.baseURI).href;
  }

  return `/media/${SALES_INVENTORY_VIDEO_FILE}`;
}

export function AboutSalesInventoryMotion() {
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const;
  const activeIndexRef = useRef<0 | 1>(0);
  const transitioningRef = useRef(false);
  const transitionTimerRef = useRef<number | null>(null);
  const resetFrameRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const salesVisibleRef = useRef(false);
  const salesWarmRef = useRef(false);

  const [reduceMotion, setReduceMotion] = useState(
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches
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
    const root = rootRef.current;
    if (!root || reduceMotion) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        salesVisibleRef.current = entry.isIntersecting;

        if (entry.isIntersecting) {
          if (!salesWarmRef.current) {
            salesWarmRef.current = true;
            videoRefs.forEach((ref) => {
              const video = ref.current;
              if (!video) return;
              video.preload = "auto";
              if (video.readyState < 2) video.load();
            });
          }

          const activeVideo = videoRefs[activeIndexRef.current].current;
          if (activeVideo) void activeVideo.play().catch(() => undefined);
        } else {
          videoRefs.forEach((ref) => ref.current?.pause());
        }
      },
      {
        rootMargin: "24% 0px 24% 0px",
        threshold: 0.01
      }
    );

    observer.observe(root);
    return () => observer.disconnect();
  }, [reduceMotion]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
      if (resetFrameRef.current !== null) window.cancelAnimationFrame(resetFrameRef.current);
      videoRefs.forEach((ref) => ref.current?.pause());
    };
  }, []);

  function markReady(video: HTMLVideoElement) {
    setVideoReady(true);
    if (salesVisibleRef.current) void video.play().catch(() => undefined);
  }

  function beginCrossfade(fromIndex: 0 | 1) {
    if (
      transitioningRef.current ||
      fromIndex !== activeIndexRef.current ||
      !salesVisibleRef.current
    ) {
      return;
    }

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
      !salesVisibleRef.current ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration - video.currentTime > CROSSFADE_LEAD_SECONDS
    ) {
      return;
    }

    beginCrossfade(index);
  }

  const source = resolveSalesInventoryVideo();

  return (
    <div
      aria-hidden="true"
      className={`about-sales-motion${videoReady ? " is-video-ready" : ""}`}
      ref={rootRef}
    >
      <div className="about-sales-motion__fallback" />

      {!reduceMotion ? (
        <>
          {[0, 1].map((rawIndex) => {
            const index = rawIndex as 0 | 1;
            return (
              <video
                className={`about-sales-motion__video${
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
                preload="metadata"
                ref={videoRefs[index]}
                src={source}
                tabIndex={-1}
              />
            );
          })}
        </>
      ) : null}

      <span className="about-sales-motion__glass" />
    </div>
  );
}
