import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ABOUT_ORIGIN_VIDEO_FILE = "about-origin-motion-6738635d.mp4";
const CROSSFADE_LEAD_SECONDS = 0.8;
const CROSSFADE_DURATION_MS = 800;

function resolveAboutOriginVideo() {
  if (window.location.protocol === "file:") {
    return new URL(`./media/${ABOUT_ORIGIN_VIDEO_FILE}`, document.baseURI).href;
  }

  return `/media/${ABOUT_ORIGIN_VIDEO_FILE}`;
}

export function AboutWelcomeMotion() {
  const videoRefs = [
    useRef<HTMLVideoElement>(null),
    useRef<HTMLVideoElement>(null)
  ] as const;
  const transitionTimerRef = useRef<number | null>(null);
  const transitioningRef = useRef(false);
  const activeIndexRef = useRef<0 | 1>(0);

  const [reduceMotion, setReduceMotion] = useState(() =>
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
  const [videoReady, setVideoReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState<0 | 1>(0);
  const [incomingIndex, setIncomingIndex] = useState<0 | 1 | null>(null);

  useEffect(() => {
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const handleMotionPreference = () => setReduceMotion(media.matches);

    handleMotionPreference();
    media.addEventListener("change", handleMotionPreference);
    return () => media.removeEventListener("change", handleMotionPreference);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }

      videoRefs.forEach((videoRef) => videoRef.current?.pause());
    };
  }, []);

  function markPrimaryReady(video: HTMLVideoElement) {
    setVideoReady(true);
    void video.play().catch(() => undefined);
  }

  function maybeCrossfade(video: HTMLVideoElement, index: 0 | 1) {
    if (
      transitioningRef.current ||
      index !== activeIndexRef.current ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration - video.currentTime > CROSSFADE_LEAD_SECONDS
    ) {
      return;
    }

    beginCrossfade(index);
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
          outgoingVideo.pause();
          outgoingVideo.currentTime = 0;

          activeIndexRef.current = toIndex;
          setActiveIndex(toIndex);
          setIncomingIndex(null);
          transitioningRef.current = false;
          transitionTimerRef.current = null;
        }, CROSSFADE_DURATION_MS);
      })
      .catch(() => {
        transitioningRef.current = false;
        setIncomingIndex(null);
      });
  }

  function handleEnded(index: 0 | 1) {
    if (index !== activeIndexRef.current || transitioningRef.current) return;
    beginCrossfade(index);
  }

  const source = resolveAboutOriginVideo();

  return (
    <div
      aria-hidden="true"
      className={`about-welcome-motion${videoReady ? " is-video-ready" : ""}`}
    >
      <div className="about-welcome-motion__fallback" />

      {!reduceMotion ? (
        <>
          {[0, 1].map((rawIndex) => {
            const index = rawIndex as 0 | 1;
            const isActive = index === activeIndex;
            const isIncoming = index === incomingIndex;

            return (
              <video
                autoPlay={index === 0}
                className={`about-welcome-motion__video${
                  isActive ? " is-active" : ""
                }${isIncoming ? " is-incoming" : ""}`}
                key={index}
                muted
                onCanPlay={
                  index === 0
                    ? (event) => markPrimaryReady(event.currentTarget)
                    : undefined
                }
                onEnded={() => handleEnded(index)}
                onLoadedData={
                  index === 0
                    ? (event) => markPrimaryReady(event.currentTarget)
                    : undefined
                }
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

      <span className="about-welcome-motion__scrim" />
      <span className="about-welcome-motion__edge-light" />
    </div>
  );
}
