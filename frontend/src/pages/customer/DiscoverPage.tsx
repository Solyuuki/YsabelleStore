import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  Boxes,
  ExternalLink,
  MapPin,
  Package,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Store
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { ProductVisual } from "@/components/customer/ProductVisual";
import { SystemIntelligenceScene } from "@/components/customer/discover/SystemIntelligenceScene";
import { useCart } from "@/context/CartContext";
import { fetchStorefrontProducts } from "@/services/storefrontService";
import type { StorefrontProduct } from "@/types/storefront";

gsap.registerPlugin(ScrollTrigger);

const essentialShelfItems = [
  {
    alt: "Unbranded amber beverage bottle",
    category: "Beverages",
    imageUrl: "/images/discover/essentials/beverage.webp"
  },
  {
    alt: "Unbranded resealable snack pouch",
    category: "Snacks",
    imageUrl: "/images/discover/essentials/snacks.webp"
  },
  {
    alt: "Unbranded instant noodle cup",
    category: "Instant Food",
    imageUrl: "/images/discover/essentials/instant-food.webp"
  },
  {
    alt: "Unbranded canned food tin",
    category: "Canned Goods",
    imageUrl: "/images/discover/essentials/canned-goods.webp"
  },
  {
    alt: "Unbranded pantry staple bag",
    category: "Staples",
    imageUrl: "/images/discover/essentials/staples.webp"
  },
  {
    alt: "Unbranded personal care bottle",
    category: "Personal Care",
    imageUrl: "/images/discover/essentials/personal-care.webp"
  },
  {
    alt: "Unbranded household detergent bottle",
    category: "Household",
    imageUrl: "/images/discover/essentials/household.webp"
  },
  {
    alt: "Stainless steel kitchen utensils in a holder",
    category: "Kitchen & Dining",
    imageUrl: "/images/discover/essentials/kitchen-dining.webp"
  }
] as const;

const storyScenes = [
  { id: "discover-welcome", label: "Welcome" },
  { id: "discover-beginning", label: "Our beginning" },
  { id: "discover-essentials", label: "Everyday essentials" },
  { id: "discover-location", label: "Our location" },
  { id: "discover-smarter", label: "System intelligence" },
  { id: "discover-shop", label: "Shop with Ysabelle" }
];

const storeAddress = "110 A. Mabini Street, Pasig City, Metro Manila";
const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeAddress)}`;
const openStreetMapEmbedUrl =
  "https://www.openstreetmap.org/export/embed.html?bbox=121.0719091%2C14.5586904%2C121.0809091%2C14.5650904&layer=mapnik&marker=14.5618904%2C121.0764091";

type StoryConditions = {
  desktop: boolean;
  mobile: boolean;
  reduceMotion: boolean;
  tablet: boolean;
};

type CatalogStatus = "error" | "loading" | "ready";

function isPresentableStorefrontProduct(product: StorefrontProduct) {
  const searchable = `${product.name} ${product.category.name}`.toLowerCase();
  return !["data flow test product", "inventory import", "debug product", "test product"].some(
    (fixtureName) => searchable.includes(fixtureName)
  );
}

export function DiscoverPage({ navigate }: { navigate: (path: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeScene, setActiveScene] = useState(0);
  const [catalogProducts, setCatalogProducts] = useState<StorefrontProduct[]>([]);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("loading");
  const { addItem } = useCart();

  useEffect(() => {
    const controller = new AbortController();

    fetchStorefrontProducts({ availability: "in-stock", page: 1, pageSize: 48 }, controller.signal)
      .then(({ items }) => {
        setCatalogProducts(items.filter(isPresentableStorefrontProduct).slice(0, 6));
        setCatalogStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setCatalogStatus("error");
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let animationMedia: gsap.MatchMedia | undefined;
    let mounted = true;
    let refreshFrame = 0;

    const context = gsap.context(() => {
      const query = <T extends Element = HTMLElement>(selector: string) =>
        Array.from(root.querySelectorAll<T>(selector));
      const first = <T extends Element = HTMLElement>(selector: string) =>
        root.querySelector<T>(selector);
      const settle = (timeline: gsap.core.Timeline, start = 0.9) => {
        const hold = { progress: 0 };
        timeline.to(hold, { duration: 1 - start, ease: "none", progress: 1 }, start);
      };

      animationMedia = gsap.matchMedia();
      animationMedia.add(
        {
          desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          tablet:
            "(min-width: 700px) and (max-width: 1023px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 699px) and (prefers-reduced-motion: no-preference)",
          reduceMotion: "(prefers-reduced-motion: reduce)"
        },
        (mediaContext) => {
          const { desktop, mobile, reduceMotion, tablet } =
            mediaContext.conditions as StoryConditions;
          const scenes = query<HTMLElement>(".story-scene");

          ScrollTrigger.create({
            trigger: root,
            start: "top 75%",
            end: "bottom 25%",
            toggleClass: { targets: root, className: "story-progress-active" }
          });

          if (reduceMotion) {
            root.classList.add("story-reduced-motion");
            gsap.set(query("[data-story-motion]"), { clearProps: "all" });
            return () => root.classList.remove("story-reduced-motion");
          }

          root.classList.add("story-motion-ready");
          const scrub = desktop ? 0.9 : tablet ? 0.55 : 0.35;

          const progressFill = first<HTMLElement>(".discover-progress__fill");
          if (progressFill) {
            gsap.fromTo(
              progressFill,
              { scaleY: 0 },
              {
                scaleY: 1,
                ease: "none",
                scrollTrigger: {
                  trigger: root,
                  start: "top top+=76",
                  end: "bottom bottom",
                  scrub: 0.2
                }
              }
            );
          }

          const welcome = first<HTMLElement>(".story-welcome");
          if (welcome) {
            gsap
              .timeline({ defaults: { duration: 0.78, ease: "power3.out" } })
              .from(".story-welcome__mark", { autoAlpha: 0, rotate: -8, scale: 0.55 })
              .from(
                ".story-welcome__title .story-mask__line",
                { autoAlpha: 0, stagger: 0.08, y: 30 },
                "-=0.44"
              )
              .from(".story-welcome__support > *", { autoAlpha: 0, stagger: 0.1, y: 16 }, "-=0.3");

            const welcomeTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: welcome,
                start: "top top+=76",
                end: "bottom top+=76",
                scrub
              }
            });
            welcomeTimeline
              .to(".story-welcome__title", { duration: 0.62, scale: 0.92, yPercent: -14 }, 0)
              .to(
                ".story-grocery-drift--left",
                { duration: 0.72, rotate: -7, xPercent: -12, yPercent: -20 },
                0
              )
              .to(
                ".story-grocery-drift--right",
                { duration: 0.72, rotate: 8, xPercent: 14, yPercent: 16 },
                0
              )
              .to(".story-brand-path--one", { duration: 0.72, xPercent: 9, yPercent: -8 }, 0)
              .to(".story-brand-path--two", { duration: 0.72, xPercent: -8, yPercent: 9 }, 0)
              .fromTo(
                ".story-welcome__handoff",
                { scaleX: 0 },
                { duration: 0.1, ease: "none", scaleX: 1 },
                0.82
              );
            settle(welcomeTimeline);
          }

          const beginning = first<HTMLElement>(".story-beginning");
          if (beginning) {
            const beginningTimeline = gsap.timeline({
              scrollTrigger: desktop
                ? {
                    trigger: beginning,
                    start: "top top+=76",
                    end: () => `+=${Math.max(1100, Math.round(window.innerHeight * 1.4))}`,
                    pin: beginning,
                    pinSpacing: true,
                    anticipatePin: 1,
                    invalidateOnRefresh: true,
                    scrub: 0.9
                  }
                : {
                    trigger: beginning,
                    start: mobile ? "top 90%" : "top 84%",
                    end: "bottom 18%",
                    scrub
                  }
            });

            beginningTimeline
              .fromTo(
                ".story-beginning__year",
                { scale: desktop ? 1.07 : 1.03, xPercent: 0, y: desktop ? 18 : 8 },
                {
                  duration: 0.3,
                  ease: "none",
                  scale: 1,
                  xPercent: 0,
                  y: 0
                },
                0.04
              )
              .from(
                ".story-beginning__copy .story-mask__line",
                { autoAlpha: 0, duration: 0.18, stagger: 0.045, y: 24 },
                0.17
              )
              .from(
                ".story-beginning__copy p",
                { autoAlpha: 0, clipPath: "inset(0 100% 0 0)", duration: 0.16 },
                0.29
              )
              .fromTo(
                ".story-origin-shelf__line",
                { scaleX: 0 },
                { duration: 0.18, ease: "none", scaleX: 1 },
                0.4
              )
              .from(
                ".story-origin-shelf__item",
                {
                  autoAlpha: 0,
                  duration: 0.26,
                  scale: 0.68,
                  stagger: 0.045,
                  y: 54
                },
                0.48
              )
              .from(
                ".story-origin-shelf__sign",
                { autoAlpha: 0, duration: 0.14, scale: 0.7, y: 18 },
                0.7
              )
              .fromTo(
                ".story-beginning__handoff",
                { scaleX: 0 },
                { duration: 0.09, ease: "none", scaleX: 1 },
                0.84
              );
            settle(beginningTimeline);
          }

          const essentials = first<HTMLElement>(".story-products");
          if (essentials && !mobile) {
            const productsTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: essentials,
                start: desktop ? "top top+=76" : mobile ? "top 88%" : "top 84%",
                end: desktop ? "bottom bottom" : "bottom 16%",
                fastScrollEnd: true,
                invalidateOnRefresh: true,
                scrub
              }
            });
            productsTimeline
              .from(".story-products .story-kicker", { autoAlpha: 0, duration: 0.08, x: -24 }, 0.02)
              .from(
                ".story-products__count",
                { autoAlpha: 0, duration: 0.16, scale: 0.9, y: 48 },
                0.08
              )
              .from(
                ".story-products__heading .story-mask__line",
                { autoAlpha: 0, duration: 0.13, y: 26 },
                0.18
              )
              .from(
                ".story-products__heading p",
                { autoAlpha: 0, clipPath: "inset(0 100% 0 0)", duration: 0.1 },
                0.27
              )
              .fromTo(
                ".story-shelf__rail",
                { scaleX: 0 },
                { duration: 0.11, ease: "none", scaleX: 1 },
                0.31
              )
              .fromTo(
                ".story-shelf__item",
                {
                  autoAlpha: 0.12,
                  clipPath: "inset(100% 0 0 0 round 1.2rem)",
                  rotate: (index) => (index % 2 === 0 ? -4 : 4),
                  scale: 0.86,
                  x: (index) => (index % 2 === 0 ? -24 : 24),
                  y: 82
                },
                {
                  autoAlpha: 1,
                  clipPath: "inset(0% 0 0 0 round 1.2rem)",
                  duration: 0.16,
                  ease: "power2.out",
                  rotate: 0,
                  scale: 1,
                  stagger: 0.03,
                  x: 0,
                  y: 0
                },
                0.4
              )
              .fromTo(
                ".story-products__handoff",
                { scaleX: 0 },
                { duration: 0.06, ease: "none", scaleX: 1 },
                0.82
              );
            settle(productsTimeline, 0.88);
          }

          const location = first<HTMLElement>(".story-location");
          if (location) {
            const locationTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: location,
                start: desktop ? "top top+=76" : mobile ? "top 88%" : "top 82%",
                end: desktop ? "bottom bottom" : "bottom 14%",
                invalidateOnRefresh: true,
                scrub
              }
            });
            locationTimeline
              .fromTo(
                ".story-real-map",
                { clipPath: "inset(10% 10% 10% 10% round 3.5rem)", scale: 0.96 },
                {
                  clipPath: "inset(0% 0% 0% 0% round 2rem)",
                  duration: 0.18,
                  ease: "none",
                  scale: 1
                },
                0.02
              )
              .from(
                ".story-real-map__badge",
                { autoAlpha: 0, duration: 0.14, scale: 0.72, y: 18 },
                0.2
              )
              .fromTo(
                ".story-real-map__trace",
                { scaleX: 0 },
                { duration: 0.24, ease: "none", scaleX: 1 },
                0.26
              )
              .fromTo(
                ".story-real-map__route path",
                { strokeDashoffset: 1 },
                { duration: 0.26, ease: "none", strokeDashoffset: 0 },
                0.3
              )
              .from(
                ".story-location__copy .story-mask__line",
                { autoAlpha: 0, duration: 0.15, stagger: 0.035, y: 24 },
                0.52
              )
              .from(
                ".story-location__lead, .story-location__address > *",
                { autoAlpha: 0, duration: 0.12, stagger: 0.025, x: 22 },
                0.64
              )
              .from(".story-location__action", { autoAlpha: 0, duration: 0.1, x: 18 }, 0.75)
              .fromTo(
                ".story-location__handoff",
                { scaleX: 0 },
                { duration: 0.04, ease: "none", scaleX: 1 },
                0.87
              );
            settle(locationTimeline, 0.9);
          }

          const intelligence = first<HTMLElement>(".story-intelligence");
          if (intelligence) {
            const panels = query<HTMLElement>("[data-intelligence-panel]");
            const markers = query<HTMLElement>("[data-intelligence-step]");
            const markerIcons = markers
              .map((marker) => marker.querySelector<HTMLElement>(":scope > span"))
              .filter((icon): icon is HTMLElement => icon !== null);
            const firstPanel = panels[0];
            const firstMarker = markers[0];

            if (desktop && firstPanel && firstMarker) {
              gsap.set(panels, {
                autoAlpha: 0,
                inset: 0,
                marginTop: 0,
                position: "absolute",
                scale: 1,
                y: 18
              });
              gsap.set(firstPanel, { autoAlpha: 1, scale: 1, y: 0 });
              gsap.set(markers, { opacity: 0.42 });
              gsap.set(firstMarker, { opacity: 1 });
              gsap.set(markerIcons, { backgroundColor: "#202653", color: "#9ca3d9" });
              if (markerIcons[0]) {
                gsap.set(markerIcons[0], { backgroundColor: "#f7f9ff", color: "#625bff" });
              }
              gsap.set(".story-intelligence__heading .story-mask__line", {
                autoAlpha: 0,
                y: 22
              });
              gsap.set(".story-intelligence__heading p", { autoAlpha: 0, x: -16 });
              gsap.set(".story-intelligence__progress", { scaleY: 0.035 });

              panels.forEach((panel) => {
                gsap.set(
                  Array.from(panel.querySelectorAll<HTMLElement>("[data-intelligence-build]")),
                  { autoAlpha: 0, y: 12 }
                );

                Array.from(
                  panel.querySelectorAll<SVGGeometryElement>("[data-intelligence-chart-path]")
                ).forEach((path) => {
                  const length = path.getTotalLength();
                  gsap.set(path, { strokeDasharray: length, strokeDashoffset: length });
                });

                gsap.set(panel.querySelectorAll("[data-intelligence-line]"), {
                  scaleX: 0,
                  transformOrigin: "left center"
                });
              });

              const intelligenceTimeline = gsap.timeline({
                scrollTrigger: {
                  trigger: intelligence,
                  start: "top top+=76",
                  end: () => `+=${Math.max(5600, Math.round(window.innerHeight * 7.2))}`,
                  pin: intelligence,
                  pinSpacing: true,
                  anticipatePin: 1,
                  fastScrollEnd: true,
                  invalidateOnRefresh: true,
                  scrub: 0.55
                }
              });

              intelligenceTimeline
                .to(
                  ".story-intelligence__heading .story-mask__line",
                  { autoAlpha: 1, duration: 0.16, stagger: 0.035, y: 0 },
                  0
                )
                .to(".story-intelligence__heading p", { autoAlpha: 1, duration: 0.14, x: 0 }, 0.08);

              panels.forEach((panel, index) => {
                const stageStart = 0.24 + index;
                const buildElements = Array.from(
                  panel.querySelectorAll<HTMLElement>("[data-intelligence-build]")
                );
                const chartPaths = Array.from(
                  panel.querySelectorAll<SVGGeometryElement>("[data-intelligence-chart-path]")
                );
                const lineElements = Array.from(
                  panel.querySelectorAll<HTMLElement>("[data-intelligence-line]")
                );

                intelligenceTimeline.addLabel(`intelligence-stage-${index + 1}`, stageStart);

                if (index > 0) {
                  const handoffStart = stageStart - 0.2;
                  const progress = index / (panels.length - 1);

                  intelligenceTimeline
                    .to(
                      panels[index - 1]!,
                      { autoAlpha: 0, duration: 0.14, ease: "power1.in", y: -12 },
                      handoffStart
                    )
                    .to(
                      ".story-intelligence__progress",
                      { duration: 0.18, ease: "none", scaleY: progress },
                      handoffStart
                    )
                    .to(markers[index - 1]!, { duration: 0.14, opacity: 0.68 }, handoffStart)
                    .to(markers[index]!, { duration: 0.14, opacity: 1 }, handoffStart)
                    .set(
                      markerIcons[index - 1]!,
                      { backgroundColor: "#242a62", color: "#9c96ff" },
                      handoffStart
                    )
                    .set(
                      markerIcons[index]!,
                      { backgroundColor: "#f7f9ff", color: "#625bff" },
                      handoffStart
                    )
                    .to(
                      panel,
                      { autoAlpha: 1, duration: 0.16, ease: "power2.out", y: 0 },
                      stageStart
                    );
                }

                if (buildElements.length) {
                  intelligenceTimeline.to(
                    buildElements,
                    {
                      autoAlpha: 1,
                      duration: 0.2,
                      ease: "power2.out",
                      stagger: 0.025,
                      y: 0
                    },
                    stageStart + 0.14
                  );
                }

                if (lineElements.length) {
                  intelligenceTimeline.to(
                    lineElements,
                    { duration: 0.28, ease: "none", scaleX: 1 },
                    stageStart + 0.38
                  );
                }

                if (chartPaths.length) {
                  intelligenceTimeline.to(
                    chartPaths,
                    { duration: 0.34, ease: "none", stagger: 0.08, strokeDashoffset: 0 },
                    stageStart + 0.34
                  );
                }
              });

              intelligenceTimeline.fromTo(
                ".story-intelligence__handoff",
                { scaleX: 0 },
                { duration: 0.22, ease: "none", scaleX: 1 },
                6.92
              );
              intelligenceTimeline.to({ hold: 0 }, { duration: 0.68, hold: 1 }, 7.14);
            } else {
              gsap.from(".story-intelligence__heading .story-mask__line", {
                autoAlpha: 0,
                scrollTrigger: {
                  trigger: ".story-intelligence__heading",
                  start: "top 88%",
                  end: "bottom 55%",
                  scrub
                },
                y: 22,
                stagger: 0.05
              });
            }
          }

          const shop = first<HTMLElement>(".story-shop");
          if (shop) {
            const liveProducts = query<HTMLElement>(".story-live-product");
            const liveProductBodies = query<HTMLElement>(".story-live-product__body");
            const liveProductButtons = query<HTMLElement>(".story-live-product button");
            const shopTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: shop,
                start: desktop ? "top top+=76" : mobile ? "top 90%" : "top 84%",
                end: desktop ? "bottom bottom" : "bottom 14%",
                invalidateOnRefresh: true,
                scrub
              }
            });
            shopTimeline
              .from(
                ".story-shop__copy .story-mask__line",
                { autoAlpha: 0, duration: 0.12, stagger: 0.03, y: 24 },
                0.03
              )
              .from(".story-shop__copy p", { autoAlpha: 0, duration: 0.12, x: -24 }, 0.16)
              .fromTo(
                ".story-live-store",
                { clipPath: "inset(0 0 100% 0 round 2rem)", scale: 0.96 },
                {
                  clipPath: "inset(0 0 0% 0 round 2rem)",
                  duration: 0.24,
                  ease: "none",
                  scale: 1
                },
                0.18
              );

            if (liveProducts.length) {
              shopTimeline
                .from(
                  liveProducts,
                  {
                    autoAlpha: 0,
                    duration: 0.14,
                    scale: 0.82,
                    stagger: 0.025,
                    x: (index) => (index % 2 === 0 ? -30 : 30)
                  },
                  0.4
                )
                .from(
                  liveProductBodies,
                  { autoAlpha: 0, duration: 0.11, stagger: 0.02, y: 14 },
                  0.5
                )
                .from(liveProductButtons, { autoAlpha: 0, duration: 0.09, scale: 0.86 }, 0.68);
            }

            shopTimeline
              .from(
                ".story-live-store__cart",
                { autoAlpha: 0, duration: 0.08, rotate: 8, scale: 0.6 },
                0.72
              )
              .from(
                ".story-shop__copy .customer-button",
                { autoAlpha: 0, duration: 0.1, scale: 0.94, x: -16 },
                0.78
              )
              .fromTo(
                ".story-shop__handoff",
                { scaleX: 0 },
                { duration: 0.04, ease: "none", scaleX: 1 },
                0.87
              );
            settle(shopTimeline, 0.9);
          }

          const updateActiveScene = () => {
            const viewportMarker = window.innerHeight * 0.5;
            let currentScene = 0;

            scenes.forEach((scene, index) => {
              if (scene.getBoundingClientRect().top <= viewportMarker) currentScene = index;
            });
            setActiveScene(currentScene);
          };

          ScrollTrigger.create({
            trigger: root,
            start: "top bottom",
            end: "bottom top",
            onEnter: updateActiveScene,
            onEnterBack: updateActiveScene,
            onRefresh: updateActiveScene,
            onUpdate: updateActiveScene
          });

          return () => root.classList.remove("story-motion-ready");
        }
      );
    }, root);

    refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh());
    void document.fonts?.ready.then(() => {
      if (mounted) ScrollTrigger.refresh();
    });

    return () => {
      mounted = false;
      window.cancelAnimationFrame(refreshFrame);
      animationMedia?.revert();
      context.revert();
      root.classList.remove("story-motion-ready", "story-progress-active", "story-reduced-motion");
    };
  }, [catalogProducts.length, catalogStatus]);

  return (
    <div className="customer-discover discover-story" ref={rootRef}>
      <nav aria-label="About Ysabelle story progress" className="discover-progress">
        <span aria-hidden="true" className="discover-progress__rail">
          <span className="discover-progress__fill" />
        </span>
        <ol>
          {storyScenes.map((scene, index) => (
            <li className={activeScene === index ? "is-active" : undefined} key={scene.id}>
              <a
                aria-current={activeScene === index ? "step" : undefined}
                aria-label={`${String(index + 1).padStart(2, "0")}: ${scene.label}`}
                href={`#${scene.id}`}
              >
                {String(index + 1).padStart(2, "0")}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <section className="story-scene story-welcome" id="discover-welcome">
        <div aria-hidden="true" className="story-brand-canvas">
          <span className="story-brand-path story-brand-path--one" />
          <span className="story-brand-path story-brand-path--two" />
          <span className="story-brand-mesh story-brand-mesh--mint" />
          <span className="story-brand-mesh story-brand-mesh--sky" />
        </div>
        <div aria-hidden="true" className="story-grocery-drift story-grocery-drift--left">
          <Package />
          <span />
          <span />
        </div>
        <div aria-hidden="true" className="story-grocery-drift story-grocery-drift--right">
          <ShoppingBasket />
          <span />
          <span />
        </div>

        <div className="customer-container story-welcome__stage" data-story-motion>
          <div className="story-welcome__mark">
            <Store aria-hidden="true" />
          </div>
          <span className="story-kicker">01 / Welcome</span>
          <h1 className="story-display-safe story-welcome__title">
            <span className="story-mask">
              <span className="story-mask__line">Ysabelle&apos;s</span>
            </span>
            <span className="story-mask">
              <span className="story-mask__line story-mask__line--accent">Store</span>
            </span>
          </h1>
          <div className="story-welcome__support">
            <p>Everyday essentials, closer to home.</p>
            <strong>Established 2019</strong>
            <a className="story-skip" href="#discover-location">
              Skip story <ArrowRight aria-hidden="true" />
            </a>
          </div>
        </div>
        <span aria-hidden="true" className="story-welcome__handoff" />
      </section>

      <section className="story-scene story-beginning" id="discover-beginning">
        <div aria-hidden="true" className="story-beginning__atmosphere">
          <span className="story-beginning__glow story-beginning__glow--one" />
          <span className="story-beginning__glow story-beginning__glow--two" />
          <span className="story-beginning__orbit" />
        </div>
        <div className="customer-container story-beginning__stage" data-story-motion>
          <div className="story-beginning__year" aria-label="Established in 2019">
            2019
          </div>
          <div className="story-beginning__copy">
            <span className="story-kicker">02 / Our beginning</span>
            <h2 className="story-display-safe">
              <span className="story-mask">
                <span className="story-mask__line">Where our story</span>
              </span>
              <span className="story-mask">
                <span className="story-mask__line">begins.</span>
              </span>
            </h2>
            <p>
              Ysabelle&apos;s Store is a local grocery retail store serving everyday consumer needs.
            </p>
          </div>

          <div
            aria-label="Abstract shelf filling with everyday essentials"
            className="story-origin-shelf"
            role="img"
          >
            <span aria-hidden="true" className="story-origin-shelf__line" />
            <div aria-hidden="true" className="story-origin-shelf__items">
              {[ShoppingBasket, Package, Boxes, Store].map((Icon, index) => (
                <span className="story-origin-shelf__item" key={`origin-item-${index}`}>
                  <Icon />
                </span>
              ))}
            </div>
            <strong className="story-origin-shelf__sign">
              Everyday essentials take their place.
            </strong>
          </div>
        </div>
        <span aria-hidden="true" className="story-beginning__handoff" />
      </section>

      <section className="story-scene story-products" id="discover-essentials">
        <div className="customer-container story-products__stage" data-story-motion>
          <div className="story-products__heading">
            <span className="story-kicker">03 / Everyday essentials</span>
            <h2 className="story-display-safe">
              <span className="story-number-mask">
                <span className="story-products__count">300+</span>
              </span>
              <span className="story-mask">
                <span className="story-mask__line">products across the store</span>
              </span>
            </h2>
            <p>The shelf fills category by category, from daily groceries to household needs.</p>
          </div>

          <div className="story-shelf">
            <ul aria-label="Store product and category shelf">
              {essentialShelfItems.map((item, index) => (
                <li
                  className={`story-shelf__item story-shelf__item--${(index % 4) + 1}`}
                  key={`shelf-slot-${index}`}
                >
                  <div className="story-shelf__visual">
                    <img alt={item.alt} decoding="async" loading="lazy" src={item.imageUrl} />
                    <span aria-hidden="true" className="story-shelf__shine" />
                  </div>
                  <span className="story-shelf__label">
                    <small>Store category</small>
                    <strong>{item.category}</strong>
                  </span>
                  <b aria-hidden="true">{String(index + 1).padStart(2, "0")}</b>
                </li>
              ))}
            </ul>
            <span aria-hidden="true" className="story-shelf__rail" />
          </div>
        </div>
        <span aria-hidden="true" className="story-products__handoff" />
      </section>

      <section className="story-scene story-location" id="discover-location">
        <div className="customer-container story-location__stage" data-story-motion>
          <figure className="story-real-map">
            <iframe
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              src={openStreetMapEmbedUrl}
              title="OpenStreetMap showing 110 A. Mabini Street in Pasig City"
            />
            <span aria-hidden="true" className="story-real-map__trace" />
            <svg aria-hidden="true" className="story-real-map__route" viewBox="0 0 640 440">
              <path d="M320 24 V150 M320 250 V416 M24 200 H270 M370 200 H616" pathLength="1" />
              <circle cx="320" cy="200" r="25" />
              <circle cx="320" cy="200" r="7" />
            </svg>
            <figcaption className="story-real-map__badge">
              <MapPin aria-hidden="true" />
              <span>
                <strong>Store location</strong>
                <small>Pasig City</small>
              </span>
            </figcaption>
          </figure>

          <div className="story-location__copy">
            <span className="story-kicker">04 / Our location</span>
            <h2 className="story-display-safe">
              <span className="story-mask">
                <span className="story-mask__line">Local by</span>
              </span>
              <span className="story-mask">
                <span className="story-mask__line story-mask__line--accent">design.</span>
              </span>
            </h2>
            <p className="story-location__lead">Serving everyday grocery needs in Pasig City.</p>
            <address className="story-location__address">
              <span>110 A. Mabini Street</span>
              <strong>Pasig City, Metro Manila</strong>
            </address>
            <a
              className="story-location__action"
              href={googleMapsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Open in Google Maps <ExternalLink aria-hidden="true" />
            </a>
          </div>
        </div>
        <span aria-hidden="true" className="story-location__handoff" />
      </section>

      <SystemIntelligenceScene />

      <section className="story-scene story-shop" id="discover-shop">
        <div className="customer-container story-shop__stage" data-story-motion>
          <div className="story-shop__copy">
            <span className="story-kicker">06 / Shop with Ysabelle</span>
            <h2 className="story-display-safe">
              <span className="story-mask">
                <span className="story-mask__line">The story opens</span>
              </span>
              <span className="story-mask">
                <span className="story-mask__line story-mask__line--sky">into the store.</span>
              </span>
            </h2>
            <p>Search the live catalog, check real availability, and build your pickup order.</p>
            <CustomerLink
              className="customer-button customer-button--light"
              href="/shop"
              navigate={navigate}
            >
              Start shopping <ArrowRight aria-hidden="true" size={18} />
            </CustomerLink>
          </div>

          <div className="story-live-store">
            <div className="story-live-store__bar">
              <span>
                <Store aria-hidden="true" />
                <strong>Available store essentials</strong>
              </span>
              <CustomerLink
                aria-label="Open cart"
                className="story-live-store__cart"
                href="/cart"
                navigate={navigate}
              >
                <ShoppingCart aria-hidden="true" />
              </CustomerLink>
            </div>
            <CustomerLink className="story-live-store__search" href="/shop" navigate={navigate}>
              <Search aria-hidden="true" />
              Search the real catalog
              <ArrowRight aria-hidden="true" />
            </CustomerLink>

            {catalogStatus === "ready" && catalogProducts.length ? (
              <div className="story-live-store__products">
                {catalogProducts.slice(0, 4).map((product) => (
                  <article className="story-live-product" key={product.id}>
                    <CustomerLink href={`/product/${product.id}`} navigate={navigate}>
                      <ProductVisual
                        category={product.category.name}
                        imageUrl={product.imageUrl}
                        name={product.name}
                      />
                    </CustomerLink>
                    <div className="story-live-product__body">
                      <small>{product.category.name}</small>
                      <CustomerLink href={`/product/${product.id}`} navigate={navigate}>
                        <h3>{product.name}</h3>
                      </CustomerLink>
                      <strong>{formatCurrency(product.sellingPrice)}</strong>
                      <span
                        className={`story-live-product__stock story-live-product__stock--${product.stockStatus.toLowerCase()}`}
                      >
                        {product.stockStatus === "LOW_STOCK"
                          ? `Only ${product.availableStock} left`
                          : "In stock"}
                      </span>
                      <button onClick={() => addItem(product, 1)} type="button">
                        <ShoppingBasket aria-hidden="true" /> Quick add
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="story-live-store__unavailable" role="status">
                <Package aria-hidden="true" />
                <div>
                  <strong>
                    {catalogStatus === "loading"
                      ? "Preparing available products"
                      : "Live catalog preview unavailable"}
                  </strong>
                  <p>
                    {catalogStatus === "loading"
                      ? "Connecting to the store catalog and current stock."
                      : "The full storefront remains available from the shopping page."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        <span aria-hidden="true" className="story-shop__handoff" />
      </section>
    </div>
  );
}
