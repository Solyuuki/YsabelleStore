import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, MapPin, Route, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";

gsap.registerPlugin(ScrollTrigger);

const deliverySignals = [
  { icon: Route, label: "Multi-point routes" },
  { icon: Truck, label: "Courier handoff" },
  { icon: MapPin, label: "Delivery progress" }
] as const;

const DELIVERY_VIDEO_SRC = "/media/about-delivery-operations-83b7547e.mp4";
const DELIVERY_CROSSFADE_LEAD_SECONDS = 0.85;
const DELIVERY_CROSSFADE_DURATION_MS = 720;

export function AboutStorefrontHandoff({ navigate }: { navigate: (path: string) => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const;
  const activeVideoIndexRef = useRef<0 | 1>(0);
  const deliveryTransitioningRef = useRef(false);
  const deliveryTransitionTimerRef = useRef<number | null>(null);
  const deliveryResetFrameRef = useRef<number | null>(null);
  const deliveryVisibleRef = useRef(false);
  const [activeVideoIndex, setActiveVideoIndex] = useState<0 | 1>(0);
  const [incomingVideoIndex, setIncomingVideoIndex] = useState<0 | 1 | null>(null);
  const [deliveryVideoReady, setDeliveryVideoReady] = useState(false);

  const markDeliveryReady = (video: HTMLVideoElement) => {
    setDeliveryVideoReady(true);
    if (deliveryVisibleRef.current) void video.play().catch(() => undefined);
  };

  const beginDeliveryCrossfade = (fromIndex: 0 | 1) => {
    if (
      deliveryTransitioningRef.current ||
      fromIndex !== activeVideoIndexRef.current ||
      !deliveryVisibleRef.current
    ) {
      return;
    }

    const toIndex: 0 | 1 = fromIndex === 0 ? 1 : 0;
    const outgoingVideo = videoRefs[fromIndex].current;
    const incomingVideo = videoRefs[toIndex].current;
    if (!outgoingVideo || !incomingVideo) return;

    deliveryTransitioningRef.current = true;
    incomingVideo.currentTime = 0;

    void incomingVideo
      .play()
      .then(() => {
        setIncomingVideoIndex(toIndex);

        deliveryTransitionTimerRef.current = window.setTimeout(() => {
          activeVideoIndexRef.current = toIndex;
          setActiveVideoIndex(toIndex);
          setIncomingVideoIndex(null);
          deliveryTransitionTimerRef.current = null;

          deliveryResetFrameRef.current = window.requestAnimationFrame(() => {
            outgoingVideo.pause();
            outgoingVideo.currentTime = 0;
            deliveryTransitioningRef.current = false;
            deliveryResetFrameRef.current = null;
          });
        }, DELIVERY_CROSSFADE_DURATION_MS);
      })
      .catch(() => {
        deliveryTransitioningRef.current = false;
        setIncomingVideoIndex(null);
      });
  };

  const maybeCrossfadeDelivery = (video: HTMLVideoElement, index: 0 | 1) => {
    if (
      index !== activeVideoIndexRef.current ||
      deliveryTransitioningRef.current ||
      !deliveryVisibleRef.current ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration - video.currentTime > DELIVERY_CROSSFADE_LEAD_SECONDS
    ) {
      return;
    }

    beginDeliveryCrossfade(index);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      videoRefs.forEach((ref) => ref.current?.pause());
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        deliveryVisibleRef.current = entry.isIntersecting;

        if (entry.isIntersecting) {
          const activeVideo = videoRefs[activeVideoIndexRef.current].current;
          if (activeVideo) void activeVideo.play().catch(() => undefined);
        } else {
          videoRefs.forEach((ref) => ref.current?.pause());
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(root);

    return () => {
      observer.disconnect();
      if (deliveryTransitionTimerRef.current !== null) {
        window.clearTimeout(deliveryTransitionTimerRef.current);
      }
      if (deliveryResetFrameRef.current !== null) {
        window.cancelAnimationFrame(deliveryResetFrameRef.current);
      }
      videoRefs.forEach((ref) => ref.current?.pause());
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const copy = Array.from(root.querySelectorAll<HTMLElement>("[data-delivery-copy]"));
        const proofs = Array.from(root.querySelectorAll<HTMLElement>("[data-delivery-proof]"));
        const visual = root.querySelector<HTMLElement>("[data-delivery-visual]");
        const frame = root.querySelector<HTMLElement>("[data-delivery-frame]");

        if (!copy.length || !proofs.length || !visual || !frame) return;

        gsap.set(copy, { autoAlpha: 0, x: -26, y: 12 });
        gsap.set(proofs, { autoAlpha: 0, scale: 0.94, y: 9 });
        gsap.set(visual, { autoAlpha: 0, scale: 0.975, x: 34, y: 22 });
        gsap.set(frame, { clipPath: "inset(0 10% 0 10% round 1.8rem)" });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top 84%",
            end: "top 14%",
            invalidateOnRefresh: true,
            scrub: 0.42
          }
        });

        timeline
          .to(copy, {
            autoAlpha: 1,
            duration: 0.34,
            ease: "power2.out",
            stagger: 0.055,
            x: 0,
            y: 0
          })
          .to(
            proofs,
            {
              autoAlpha: 1,
              duration: 0.18,
              ease: "power2.out",
              scale: 1,
              stagger: 0.045,
              y: 0
            },
            0.2
          )
          .to(
            visual,
            {
              autoAlpha: 1,
              duration: 0.4,
              ease: "power2.out",
              scale: 1,
              x: 0,
              y: 0
            },
            0.15
          )
          .to(
            frame,
            {
              clipPath: "inset(0 0% 0 0% round 1.8rem)",
              duration: 0.34,
              ease: "power2.out"
            },
            0.22
          );
      }, root);

      return () => context.revert();
    });

    return () => media.revert();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="story-scene story-delivery" id="discover-shop" ref={rootRef}>
      <div aria-hidden="true" className="story-delivery__atmosphere">
        <span className="story-delivery__glow story-delivery__glow--blue" />
        <span className="story-delivery__glow story-delivery__glow--violet" />
        <span className="story-delivery__network" />
      </div>

      <div className="customer-container story-delivery__stage">
        <div className="story-delivery__copy">
          <span className="story-kicker" data-delivery-copy>
            06 / Delivery operations
          </span>

          <h2 className="story-display-safe" data-delivery-copy>
            <span className="story-mask">
              <span className="story-mask__line">
                From Store <em className="story-mask__line--delivery">to Door.</em>
              </span>
            </span>
          </h2>

          <p className="story-delivery__tagline" data-delivery-copy>
            Every delivery stays in view.
          </p>

          <p className="story-delivery__lead" data-delivery-copy>
            Coordinate outgoing orders, courier handoff, and destination progress through a clear
            delivery view designed for modern neighborhood retail.
          </p>

          <ul aria-label="Delivery capabilities" className="story-delivery__proofs">
            {deliverySignals.map(({ icon: Icon, label }) => (
              <li data-delivery-proof key={label}>
                <Icon aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>

          <CustomerLink
            aria-label="Explore the Ysabelle Store home"
            className="customer-button customer-button--light story-delivery__primary-action"
            data-delivery-copy
            href="/"
            navigate={navigate}
          >
            Explore now <ArrowRight aria-hidden="true" size={18} />
          </CustomerLink>
        </div>

        <div className="story-delivery__visual" data-delivery-visual>
          <div className={`story-delivery__frame${deliveryVideoReady ? " is-video-ready" : ""}`} data-delivery-frame>
            <div aria-hidden="true" className="story-delivery__fallback">
              <Route />
              <span>Delivery network preview</span>
            </div>
            {[0, 1].map((rawIndex) => {
              const index = rawIndex as 0 | 1;
              return (
                <video
                  aria-label={
                    index === 0 ? "Illustrative Ysabelle Store delivery network" : undefined
                  }
                  autoPlay={index === 0}
                  className={`story-delivery__video${index === activeVideoIndex ? " is-active" : ""}${
                    index === incomingVideoIndex ? " is-incoming" : ""
                  }`}
                  data-delivery-video
                  key={index}
                  muted
                  onCanPlay={index === 0 ? (event) => markDeliveryReady(event.currentTarget) : undefined}
                  onEnded={() => beginDeliveryCrossfade(index)}
                  onLoadedData={
                    index === 0 ? (event) => markDeliveryReady(event.currentTarget) : undefined
                  }
                  onPlaying={
                    index === 0 ? (event) => markDeliveryReady(event.currentTarget) : undefined
                  }
                  onTimeUpdate={(event) => maybeCrossfadeDelivery(event.currentTarget, index)}
                  playsInline
                  preload="auto"
                  ref={videoRefs[index]}
                  src={DELIVERY_VIDEO_SRC}
                  tabIndex={-1}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
