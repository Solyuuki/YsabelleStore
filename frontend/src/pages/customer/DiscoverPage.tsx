import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Check,
  ClipboardCheck,
  Database,
  ExternalLink,
  LineChart,
  MapPin,
  Package,
  RefreshCw,
  ScanBarcode,
  Search,
  ShoppingBasket,
  ShoppingCart,
  Store,
  TrendingUp,
  Warehouse,
  type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { formatCurrency } from "@/components/customer/ProductCard";
import { ProductVisual } from "@/components/customer/ProductVisual";
import { useCart } from "@/context/CartContext";
import { fetchStorefrontProducts } from "@/services/storefrontService";
import type { StorefrontProduct } from "@/types/storefront";

gsap.registerPlugin(ScrollTrigger);

const essentialCategories = [
  "Beverages",
  "Snacks",
  "Instant Food",
  "Canned Goods",
  "Staples",
  "Personal Care",
  "Household",
  "Kitchen & Dining"
];

const storyScenes = [
  { id: "discover-welcome", label: "Welcome" },
  { id: "discover-beginning", label: "Our beginning" },
  { id: "discover-essentials", label: "Everyday essentials" },
  { id: "discover-location", label: "Our location" },
  { id: "discover-smarter", label: "System intelligence" },
  { id: "discover-shop", label: "Shop with Ysabelle" }
];

const intelligenceStages: Array<{
  description: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  tone: "foundation" | "forecast" | "target";
}> = [
  {
    eyebrow: "01 / Customer and POS sale",
    title: "A completed sale starts the signal.",
    description:
      "Customer and POS transactions capture which product moved and how many units sold.",
    icon: ShoppingBasket,
    tone: "foundation"
  },
  {
    eyebrow: "02 / Inventory update",
    title: "Stock visibility follows the transaction.",
    description:
      "Completed selling activity connects to usable-stock monitoring and inventory movement records.",
    icon: Boxes,
    tone: "foundation"
  },
  {
    eyebrow: "03 / Historical monthly sales",
    title: "Transactions become demand history.",
    description:
      "Approved POS and historical sales records form complete monthly product-demand series.",
    icon: Database,
    tone: "foundation"
  },
  {
    eyebrow: "04 / SARIMA demand forecast",
    title: "Seasonal patterns become a forward view.",
    description:
      "Eligible product series use SARIMA to model recurring 12-month demand patterns, with validated fallback models for limited histories.",
    icon: LineChart,
    tone: "forecast"
  },
  {
    eyebrow: "05 / Target decision layer",
    title: "Forecast demand meets inventory context.",
    description:
      "The planned recommendation layer combines forecast demand with usable stock and confirmed supply information before proposing a replenishment need.",
    icon: BarChart3,
    tone: "target"
  },
  {
    eyebrow: "06 / Owner decision",
    title: "The owner remains in control.",
    description:
      "The target workflow keeps recommendations reviewable and adjustable before any replenishment action is approved.",
    icon: ClipboardCheck,
    tone: "target"
  },
  {
    eyebrow: "07 / Restock workflow",
    title: "An approved decision becomes store action.",
    description:
      "Approved quantities can proceed into the store's restocking and supplier workflow without presenting supplier automation as complete.",
    icon: RefreshCw,
    tone: "target"
  }
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

type ShelfItem = {
  category: string;
  label: string;
  product?: StorefrontProduct;
};

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
                { yPercent: 112, stagger: 0.08 },
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
                { scale: desktop ? 1.12 : 1.04, xPercent: desktop ? 7 : 0 },
                {
                  duration: 0.34,
                  ease: "none",
                  scale: desktop ? 0.76 : 0.94,
                  xPercent: desktop ? -8 : 0
                },
                0.04
              )
              .from(
                ".story-beginning__copy .story-mask__line",
                { duration: 0.18, stagger: 0.045, yPercent: 110 },
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
          if (essentials) {
            const productsTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: essentials,
                start: desktop ? "top top+=76" : mobile ? "top 88%" : "top 84%",
                end: desktop ? "bottom bottom" : "bottom 16%",
                scrub
              }
            });
            productsTimeline
              .from(".story-products__count", { duration: 0.22, scale: 1.12, yPercent: 105 }, 0.04)
              .from(
                ".story-products__heading .story-mask__line",
                { duration: 0.18, stagger: 0.045, yPercent: 110 },
                0.12
              )
              .from(".story-products__heading p", { autoAlpha: 0, duration: 0.13, x: 24 }, 0.25)
              .from(
                ".story-shelf__item",
                {
                  autoAlpha: 0,
                  duration: 0.25,
                  rotate: (index) => (index % 2 === 0 ? -3 : 3),
                  scale: 0.76,
                  stagger: 0.03,
                  x: (index) => (index % 3 === 0 ? -80 : index % 3 === 1 ? 70 : 0),
                  y: (index) => (index % 3 === 2 ? -45 : 58)
                },
                0.32
              )
              .fromTo(
                ".story-shelf__rail",
                { scaleX: 0 },
                { duration: 0.12, ease: "none", scaleX: 1 },
                0.74
              )
              .fromTo(
                ".story-products__handoff",
                { scaleX: 0 },
                { duration: 0.08, ease: "none", scaleX: 1 },
                0.84
              );
            settle(productsTimeline);
          }

          const location = first<HTMLElement>(".story-location");
          if (location) {
            const locationTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: location,
                start: mobile ? "top 88%" : "top 80%",
                end: "bottom 18%",
                scrub
              }
            });
            locationTimeline
              .fromTo(
                ".story-real-map",
                { clipPath: "inset(10% 10% 10% 10% round 3.5rem)", scale: 0.96 },
                {
                  clipPath: "inset(0% 0% 0% 0% round 2rem)",
                  duration: 0.42,
                  ease: "none",
                  scale: 1
                },
                0.04
              )
              .fromTo(
                ".story-real-map__trace",
                { scaleX: 0 },
                { duration: 0.28, ease: "none", scaleX: 1 },
                0.16
              )
              .from(
                ".story-real-map__badge",
                { autoAlpha: 0, duration: 0.15, scale: 0.65, y: 16 },
                0.34
              )
              .from(
                ".story-location__copy .story-mask__line",
                { duration: 0.2, stagger: 0.05, yPercent: 110 },
                0.44
              )
              .from(
                ".story-location__address > *, .story-location__action",
                { autoAlpha: 0, duration: 0.14, stagger: 0.025, x: 22 },
                0.58
              )
              .fromTo(
                ".story-location__handoff",
                { scaleX: 0 },
                { duration: 0.09, ease: "none", scaleX: 1 },
                0.84
              );
            settle(locationTimeline);
          }

          const intelligence = first<HTMLElement>(".story-intelligence");
          if (intelligence) {
            const panels = query<HTMLElement>(".story-intelligence__panel");
            const markers = query<HTMLElement>(".story-intelligence__step");
            const firstPanel = panels[0];
            const firstMarker = markers[0];

            if (desktop && firstPanel && firstMarker) {
              gsap.set(panels, {
                autoAlpha: 0,
                inset: 0,
                marginTop: 0,
                position: "absolute",
                scale: 0.97,
                y: 26
              });
              gsap.set(firstPanel, { autoAlpha: 1, scale: 1, y: 0 });
              gsap.set(markers, { opacity: 0.34 });
              gsap.set(firstMarker, { opacity: 1 });

              const intelligenceTimeline = gsap.timeline({
                scrollTrigger: {
                  trigger: intelligence,
                  start: "top top+=76",
                  end: () => `+=${Math.max(2600, Math.round(window.innerHeight * 3.2))}`,
                  pin: intelligence,
                  pinSpacing: true,
                  anticipatePin: 1,
                  invalidateOnRefresh: true,
                  scrub: 0.95
                }
              });

              intelligenceTimeline
                .from(
                  ".story-intelligence__heading .story-mask__line",
                  { duration: 0.1, stagger: 0.025, yPercent: 110 },
                  0
                )
                .from(
                  ".story-intelligence__heading p",
                  { autoAlpha: 0, duration: 0.08, x: -20 },
                  0.06
                )
                .fromTo(
                  ".story-intelligence__progress",
                  { scaleY: 0 },
                  { duration: 0.72, ease: "none", scaleY: 1 },
                  0.08
                );

              panels.forEach((panel, index) => {
                const position = 0.09 + index * 0.105;
                const panelMotion = Array.from(
                  panel.querySelectorAll<HTMLElement>("[data-intelligence-motion]")
                );

                if (index > 0) {
                  intelligenceTimeline
                    .to(
                      panels[index - 1]!,
                      { autoAlpha: 0, duration: 0.05, scale: 0.98, y: -18 },
                      position
                    )
                    .fromTo(
                      panel,
                      { autoAlpha: 0, scale: 0.97, y: 26 },
                      { autoAlpha: 1, duration: 0.035, scale: 1, y: 0 },
                      position
                    )
                    .to(markers[index - 1]!, { duration: 0.05, opacity: 0.34 }, position)
                    .to(markers[index]!, { duration: 0.035, opacity: 1 }, position);
                }

                if (panelMotion.length) {
                  intelligenceTimeline.from(
                    panelMotion,
                    {
                      autoAlpha: 0,
                      duration: 0.06,
                      stagger: 0.012,
                      y: 16
                    },
                    position + 0.045
                  );
                }
              });

              intelligenceTimeline.fromTo(
                ".story-intelligence__handoff",
                { scaleX: 0 },
                { duration: 0.08, ease: "none", scaleX: 1 },
                0.84
              );
              settle(intelligenceTimeline);
            } else {
              gsap.from(".story-intelligence__heading .story-mask__line", {
                scrollTrigger: {
                  trigger: ".story-intelligence__heading",
                  start: "top 88%",
                  end: "bottom 55%",
                  scrub
                },
                yPercent: 110,
                stagger: 0.05
              });

              panels.forEach((panel) => {
                gsap.from(panel, {
                  clipPath: "inset(0 0 18% 0 round 1.5rem)",
                  scale: 0.96,
                  scrollTrigger: {
                    trigger: panel,
                    start: "top 90%",
                    end: "center 58%",
                    scrub
                  },
                  y: 26
                });
              });
            }
          }

          const shop = first<HTMLElement>(".story-shop");
          if (shop) {
            const shopTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: shop,
                start: mobile ? "top 90%" : "top 82%",
                end: "bottom 18%",
                scrub
              }
            });
            shopTimeline
              .from(
                ".story-shop__copy .story-mask__line",
                { duration: 0.2, stagger: 0.05, yPercent: 110 },
                0.04
              )
              .from(
                ".story-shop__copy p, .story-shop__copy .customer-button",
                { autoAlpha: 0, duration: 0.18, stagger: 0.04, x: -24 },
                0.18
              )
              .fromTo(
                ".story-live-store",
                { clipPath: "inset(0 0 100% 0 round 2rem)", scale: 0.96 },
                {
                  clipPath: "inset(0 0 0% 0 round 2rem)",
                  duration: 0.36,
                  ease: "none",
                  scale: 1
                },
                0.14
              );

            shopTimeline.from(
              ".story-live-store__cart",
              { autoAlpha: 0, duration: 0.1, rotate: 8, scale: 0.6 },
              0.76
            );
            settle(shopTimeline, 0.88);
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
  }, []);

  useEffect(() => {
    if (catalogStatus !== "ready" || !catalogProducts.length) return;

    const root = rootRef.current;
    if (!root) return;

    let animationMedia: gsap.MatchMedia | undefined;
    let refreshFrame = 0;
    const context = gsap.context(() => {
      animationMedia = gsap.matchMedia();
      animationMedia.add("(prefers-reduced-motion: no-preference)", () => {
        const products = Array.from(root.querySelectorAll<HTMLElement>(".story-live-product"));
        const shop = root.querySelector<HTMLElement>(".story-shop");
        if (!products.length || !shop) return;

        gsap.from(products, {
          autoAlpha: 0,
          duration: 0.24,
          scale: 0.78,
          scrollTrigger: {
            end: "bottom 32%",
            scrub: window.innerWidth >= 1024 ? 0.55 : 0.3,
            start: window.innerWidth < 700 ? "top 88%" : "top 78%",
            trigger: shop
          },
          stagger: 0.025,
          x: (index) => (index % 2 === 0 ? -32 : 32)
        });
      });
    }, root);

    refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => {
      window.cancelAnimationFrame(refreshFrame);
      animationMedia?.revert();
      context.revert();
    };
  }, [catalogProducts.length, catalogStatus]);

  const shelfItems: ShelfItem[] = [
    ...catalogProducts.slice(0, 4).map((product) => ({
      category: product.category.name,
      label: product.name,
      product
    })),
    ...essentialCategories.map((category) => ({
      category,
      label: category
    }))
  ].slice(0, 8);

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
              {shelfItems.map((item, index) => (
                <li
                  className={`story-shelf__item story-shelf__item--${(index % 4) + 1} ${item.product ? "story-shelf__item--live" : ""}`}
                  key={`shelf-slot-${index}`}
                >
                  {item.product ? (
                    <ProductVisual category={item.category} name={item.label} />
                  ) : (
                    <span aria-hidden="true" className="story-shelf__icon">
                      <Package />
                    </span>
                  )}
                  <span>
                    <small>{item.product ? item.category : "Store category"}</small>
                    <strong>{item.label}</strong>
                  </span>
                  <b>{String(index + 1).padStart(2, "0")}</b>
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

      <section className="story-scene story-intelligence" id="discover-smarter">
        <div className="customer-container story-intelligence__stage" data-story-motion>
          <div className="story-intelligence__heading">
            <span className="story-kicker">05 / System intelligence</span>
            <h2 className="story-display-safe">
              <span className="story-mask">
                <span className="story-mask__line">Sales become signals.</span>
              </span>
              <span className="story-mask">
                <span className="story-mask__line story-mask__line--mint">
                  SARIMA finds the season.
                </span>
              </span>
            </h2>
            <p>
              Validated seasonal forecasting connects grocery demand history to clearer inventory
              decisions without presenting SARIMA as generic AI.
            </p>
          </div>

          <div className="story-intelligence__layout">
            <div className="story-intelligence__index">
              <span aria-hidden="true" className="story-intelligence__track" />
              <span aria-hidden="true" className="story-intelligence__progress" />
              <ol aria-label="Retail intelligence stages">
                {intelligenceStages.map(({ icon: Icon, title }, index) => (
                  <li className="story-intelligence__step" key={title}>
                    <span>
                      <Icon aria-hidden="true" />
                    </span>
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <strong>{title}</strong>
                  </li>
                ))}
              </ol>
            </div>

            <div className="story-intelligence__visual">
              {intelligenceStages.map((stage, index) => (
                <IntelligencePanel index={index} key={stage.title} stage={stage} />
              ))}
            </div>
          </div>

          <p className="story-intelligence__disclosure">
            Current system boundary: forecasting is implemented; the inventory-aware recommendation
            endpoint and approval workflow remain planned integration layers.
          </p>
        </div>
        <span aria-hidden="true" className="story-intelligence__handoff" />
      </section>

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
                      <ProductVisual category={product.category.name} name={product.name} />
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
      </section>
    </div>
  );
}

function IntelligencePanel({
  index,
  stage
}: {
  index: number;
  stage: (typeof intelligenceStages)[number];
}) {
  const Icon = stage.icon;

  return (
    <article
      className={`story-intelligence__panel story-intelligence__panel--${index + 1}`}
      data-tone={stage.tone}
    >
      <header>
        <span className="story-intelligence__panel-icon">
          <Icon aria-hidden="true" />
        </span>
        <div>
          <small>{stage.eyebrow}</small>
          <h3>{stage.title}</h3>
        </div>
      </header>
      <p>{stage.description}</p>
      <IntelligenceVisual index={index} />
    </article>
  );
}

function IntelligenceVisual({ index }: { index: number }) {
  if (index === 0) {
    return (
      <div aria-hidden="true" className="intelligence-sale intelligence-visual">
        <span data-intelligence-motion>
          <ScanBarcode /> Scan
        </span>
        <i data-intelligence-motion />
        <span data-intelligence-motion>
          <ShoppingBasket /> Complete sale
        </span>
        <b data-intelligence-motion>
          <Check /> Recorded
        </b>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div
        aria-label="Illustrative usable-stock update after a sale"
        className="intelligence-stock intelligence-visual"
        role="img"
      >
        <div data-intelligence-motion>
          <span>Usable stock</span>
          <strong>Before sale</strong>
          <i style={{ "--stock-level": "88%" } as CSSProperties} />
        </div>
        <ArrowRight aria-hidden="true" data-intelligence-motion />
        <div data-intelligence-motion>
          <span>Movement recorded</span>
          <strong>After sale</strong>
          <i style={{ "--stock-level": "66%" } as CSSProperties} />
        </div>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="intelligence-history intelligence-visual">
        <div data-intelligence-motion>
          <Database aria-hidden="true" />
          <span>Approved monthly demand history</span>
        </div>
        <svg
          aria-label="Illustrative monthly sales series accumulating over time"
          data-intelligence-motion
          role="img"
          viewBox="0 0 620 190"
        >
          <path d="M20 154 C70 132 92 142 135 108 C180 72 214 130 260 98 C308 62 340 85 384 58 C430 30 470 88 512 52 C548 22 576 42 604 24" />
          {Array.from({ length: 12 }, (_, month) => (
            <line key={month} x1={24 + month * 52} x2={24 + month * 52} y1="170" y2="176" />
          ))}
        </svg>
        <small data-intelligence-motion>
          Complete months / product-level series / validated inputs
        </small>
      </div>
    );
  }

  if (index === 3) {
    return (
      <div className="intelligence-sarima intelligence-visual">
        <div className="intelligence-sarima__facts" data-intelligence-motion>
          <span>
            <strong>24+</strong> monthly observations
          </span>
          <span>
            <strong>12</strong> month seasonality
          </span>
          <span>
            <strong>SARIMA</strong> eligible series
          </span>
        </div>
        <svg
          aria-label="Illustrative historical seasonal curve continuing into a forecast"
          data-intelligence-motion
          role="img"
          viewBox="0 0 680 250"
        >
          <defs>
            <linearGradient id="sarima-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#7ad3b9" stopOpacity="0.38" />
              <stop offset="1" stopColor="#7ad3b9" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            className="intelligence-sarima__area"
            d="M20 210 C72 184 92 98 145 128 C194 158 218 202 270 158 C320 116 342 50 392 82 L392 230 L20 230 Z"
          />
          <path
            className="intelligence-sarima__history"
            d="M20 210 C72 184 92 98 145 128 C194 158 218 202 270 158 C320 116 342 50 392 82"
          />
          <path
            className="intelligence-sarima__forecast"
            d="M392 82 C438 112 458 186 512 146 C558 112 584 45 660 72"
          />
          <line className="intelligence-sarima__divider" x1="392" x2="392" y1="30" y2="230" />
          <text x="36" y="30">
            Historical sales
          </text>
          <text x="420" y="30">
            Forecast horizon
          </text>
        </svg>
        <p data-intelligence-motion>
          SARIMA is a seasonal statistical model, not a generic AI label.
        </p>
      </div>
    );
  }

  if (index === 4) {
    return (
      <div className="intelligence-formula intelligence-visual">
        <strong data-intelligence-motion>Target inventory-aware decision model</strong>
        <div data-intelligence-motion>
          <span>Forecast demand</span>
          <b>+</b>
          <span>Safety stock</span>
          <b>-</b>
          <span>Current usable stock</span>
          <b>-</b>
          <span>Confirmed incoming stock</span>
          <b>=</b>
          <span className="is-result">Base replenishment need</span>
        </div>
        <p data-intelligence-motion>
          Planned integration. Current production forecasting does not yet apply this inventory
          formula.
        </p>
      </div>
    );
  }

  if (index === 5) {
    return (
      <div className="intelligence-owner intelligence-visual">
        <div data-intelligence-motion>
          <TrendingUp aria-hidden="true" />
          <span>
            <small>Recommendation review</small>
            <strong>Owner decision point</strong>
          </span>
        </div>
        <div aria-hidden="true" className="intelligence-owner__actions" data-intelligence-motion>
          <span>Review</span>
          <span>Adjust</span>
          <span className="is-approved">
            <Check /> Approve
          </span>
        </div>
        <p data-intelligence-motion>Target workflow: decision support, not automatic purchasing.</p>
      </div>
    );
  }

  return (
    <div className="intelligence-restock intelligence-visual">
      <span data-intelligence-motion>
        <ClipboardCheck aria-hidden="true" /> Approved quantity
      </span>
      <ArrowRight aria-hidden="true" data-intelligence-motion />
      <span data-intelligence-motion>
        <Warehouse aria-hidden="true" /> Supplier workflow
      </span>
      <ArrowRight aria-hidden="true" data-intelligence-motion />
      <span data-intelligence-motion>
        <Boxes aria-hidden="true" /> Stock received
      </span>
      <small data-intelligence-motion>Operational handoff remains owner-controlled.</small>
    </div>
  );
}
