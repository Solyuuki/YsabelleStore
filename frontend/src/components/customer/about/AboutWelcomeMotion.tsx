import { useEffect, useRef, useState } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ABOUT_ORIGIN_VIDEO_FILE = "about-origin-motion-6738635d.mp4";
const CROSSFADE_LEAD_SECONDS = 0.95;
const CROSSFADE_DURATION_MS = 720;

type VideoFrameMetadata = {
  mediaTime: number;
};

type FrameAwareVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (
    callback: (now: number, metadata: VideoFrameMetadata) => void
  ) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

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
  const resetFrameRef = useRef<number | null>(null);
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
    if (reduceMotion || !videoReady || transitioningRef.current) return;

    const video = videoRefs[activeIndex].current as FrameAwareVideo | null;
    if (!video?.requestVideoFrameCallback) return;

    let cancelled = false;
    let callbackHandle: number | null = null;

    const inspectFrame = (_now: number, metadata: VideoFrameMetadata) => {
      if (cancelled || transitioningRef.current) return;

      maybeCrossfade(video, activeIndex, metadata.mediaTime);

      if (!transitioningRef.current && video.requestVideoFrameCallback) {
        callbackHandle = video.requestVideoFrameCallback(inspectFrame);
      }
    };

    callbackHandle = video.requestVideoFrameCallback(inspectFrame);

    return () => {
      cancelled = true;
      if (callbackHandle !== null && video.cancelVideoFrameCallback) {
        video.cancelVideoFrameCallback(callbackHandle);
      }
    };
  }, [activeIndex, reduceMotion, videoReady]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
      if (resetFrameRef.current !== null) {
        window.cancelAnimationFrame(resetFrameRef.current);
      }

      videoRefs.forEach((videoRef) => videoRef.current?.pause());
    };
  }, []);

  function markPrimaryReady(video: HTMLVideoElement) {
    setVideoReady(true);
    void video.play().catch(() => undefined);
  }

  function maybeCrossfade(
    video: HTMLVideoElement,
    index: 0 | 1,
    mediaTime = video.currentTime
  ) {
    if (
      transitioningRef.current ||
      index !== activeIndexRef.current ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration - mediaTime > CROSSFADE_LEAD_SECONDS
    ) {
      return;
    }

    beginCrossfade(index);
  }

  function beginCrossfade(fromIndex: 0 | 1) {
    if (transitioningRef.current || fromIndex !== activeIndexRef.current) return;

    const toIndex: 0 | 1 = fromIndex === 0 ? 1 : 0;
    const outgoingVideo = videoRefs[fromIndex].current;
    const incomingVideo = videoRefs[toIndex].current as FrameAwareVideo | null;

    if (!outgoingVideo || !incomingVideo) return;

    transitioningRef.current = true;
    incomingVideo.currentTime = 0;

    const revealIncoming = () => {
      setIncomingIndex(toIndex);

      transitionTimerRef.current = window.setTimeout(() => {
        activeIndexRef.current = toIndex;
        setActiveIndex(toIndex);
        setIncomingIndex(null);
        transitionTimerRef.current = null;

        // The outgoing layer is now underneath a fully opaque incoming layer.
        // Wait for React/CSS to commit that hidden state before seeking it.
        resetFrameRef.current = window.requestAnimationFrame(() => {
          resetFrameRef.current = window.requestAnimationFrame(() => {
            outgoingVideo.pause();
            outgoingVideo.currentTime = 0;
            transitioningRef.current = false;
            resetFrameRef.current = null;
          });
        });
      }, CROSSFADE_DURATION_MS);
    };

    void incomingVideo
      .play()
      .then(() => {
        if (incomingVideo.requestVideoFrameCallback) {
          incomingVideo.requestVideoFrameCallback(() => revealIncoming());
          return;
        }

        if (incomingVideo.readyState >= 2) {
          revealIncoming();
          return;
        }

        incomingVideo.addEventListener("loadeddata", revealIncoming, { once: true });
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
                onTimeUpdate={(event) =>
                  maybeCrossfade(event.currentTarget, index)
                }
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
