import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, MapPin, Route, Truck } from "lucide-react";
import { useEffect, useRef } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";

gsap.registerPlugin(ScrollTrigger);

const deliverySignals = [
  { icon: Route, label: "Multi-point routes" },
  { icon: Truck, label: "Courier handoff" },
  { icon: MapPin, label: "Delivery progress" }
] as const;

const DELIVERY_VIDEO_SRC = "/media/about-delivery-operations-83b7547e.mp4";

export function AboutStorefrontHandoff({ navigate }: { navigate: (path: string) => void }) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const video = root.querySelector<HTMLVideoElement>("[data-delivery-video]");
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;

        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(video);
    return () => observer.disconnect();
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
          <div className="story-delivery__frame" data-delivery-frame>
            <div aria-hidden="true" className="story-delivery__fallback">
              <Route />
              <span>Delivery network preview</span>
            </div>
            <video
              aria-label="Illustrative Ysabelle Store delivery network"
              autoPlay
              data-delivery-video
              loop
              muted
              onCanPlay={(event) => {
                event.currentTarget.parentElement?.classList.add("is-video-ready");
              }}
              playsInline
              preload="metadata"
            >
              <source src={DELIVERY_VIDEO_SRC} type="video/mp4" />
            </video>
          </div>
        </div>
      </div>
    </section>
  );
}
