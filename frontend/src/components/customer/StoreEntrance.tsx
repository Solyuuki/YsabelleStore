import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STORE_ENTRANCE_VIDEO = "/media/gemini_generated_video_418a3614.mp4";
const LEGACY_STORE_ENTRANCE_VIDEO = "/media/store-entrance.mp4";
const STORE_ENTRANCE_POSTER =
  "/images/discover/essentials/canned-goods-retail-display.webp";

const EXIT_DURATION_MS = 620;
const SCENE_FADE_MS = 180;
const BLACK_HOLD_MS = 90;

type SceneTransition = {
  holdMs: number;
  next: number;
  trigger: number;
};

const SCENE_TRANSITIONS: readonly SceneTransition[] = [
  // Gemini dissolve: refrigerators -> snacks.
  { trigger: 4.0, next: 4.48, holdMs: 120 },
  // Gemini dissolve: snacks -> personal care.
  { trigger: 5.74, next: 6.3, holdMs: 120 },
  // Gemini dissolve: household -> cooking/pantry.
  { trigger: 9.2, next: 9.66, holdMs: 160 },
  // Controlled end-to-start loop. The source MP4 remains untouched.
  { trigger: 9.84, next: 0.04, holdMs: 420 }
];

function wait(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

function seekVideo(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };

    video.addEventListener("seeked", finish, { once: true });
    video.currentTime = time;
    window.setTimeout(finish, 450);
  });
}

export function StoreEntrance({ onEnter }: { onEnter: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const transitionBusyRef = useRef(false);
  const transitionIndexRef = useRef(0);
  const mountedRef = useRef(true);
  const exitingRef = useRef(false);

  const [isExiting, setIsExiting] = useState(false);
  const [sceneCurtainActive, setSceneCurtainActive] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || videoFailed) return;

    let animationFrame = 0;
    let cancelled = false;

    async function runTransition(transition: SceneTransition, index: number) {
      const video = videoRef.current;
      if (!video || transitionBusyRef.current || exitingRef.current) return;

      transitionBusyRef.current = true;
      video.pause();

      await wait(transition.holdMs);
      if (cancelled || exitingRef.current) return;

      if (mountedRef.current) setSceneCurtainActive(true);
      await wait(SCENE_FADE_MS + 20);
      if (cancelled || exitingRef.current) return;

      await seekVideo(video, transition.next);
      if (cancelled || exitingRef.current) return;

      await wait(BLACK_HOLD_MS);
      if (mountedRef.current) setSceneCurtainActive(false);
      await wait(SCENE_FADE_MS + 20);

      if (transition.next < transition.trigger) {
        transitionIndexRef.current = 0;
      } else {
        transitionIndexRef.current = index + 1;
      }

      transitionBusyRef.current = false;

      if (!cancelled && !exitingRef.current) {
        void video.play().catch(() => undefined);
      }
    }

    function monitorVideo() {
      const video = videoRef.current;
      const transition = SCENE_TRANSITIONS[transitionIndexRef.current];

      if (
        video &&
        transition &&
        !video.paused &&
        !transitionBusyRef.current &&
        !exitingRef.current &&
        video.currentTime >= transition.trigger
      ) {
        void runTransition(transition, transitionIndexRef.current);
      }

      animationFrame = window.requestAnimationFrame(monitorVideo);
    }

    animationFrame = window.requestAnimationFrame(monitorVideo);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [prefersReducedMotion, videoFailed]);

  function enterStore() {
    if (isExiting) return;

    exitingRef.current = true;
    transitionBusyRef.current = true;
    videoRef.current?.pause();
    setSceneCurtainActive(false);

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
            <source src={LEGACY_STORE_ENTRANCE_VIDEO} type="video/mp4" />
          </video>
        )}
      </div>

      <div aria-hidden="true" className="store-entrance__scrim" />
      <div aria-hidden="true" className="store-entrance__vignette" />
      <div
        aria-hidden="true"
        className={`store-entrance__scene-curtain ${sceneCurtainActive ? "is-active" : ""}`}
      />
      <div aria-hidden="true" className="store-entrance__exit-curtain" />

      <div className="store-entrance__content">
        <p className="store-entrance__brand-name">Ysabelle Store</p>

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
