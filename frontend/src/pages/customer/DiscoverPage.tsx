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
import { ProductImage } from "@/components/customer/ProductImage";
import { SystemIntelligenceScene } from "@/components/customer/discover/SystemIntelligenceScene";
import { useCart } from "@/context/CartContext";
import { fetchStorefrontProducts } from "@/services/storefrontService";
import type { StorefrontProduct } from "@/types/storefront";

gsap.registerPlugin(ScrollTrigger);

const essentialShelfItems = [
  {
    alt: "Bottled and canned beverages arranged on a grocery shelf",
    category: "Beverages",
    imageUrl: "/images/discover/essentials/beverages-retail-display.webp"
  },
  {
    alt: "Packaged crackers, chips, and snacks arranged on a grocery shelf",
    category: "Snacks",
    imageUrl: "/images/discover/essentials/snacks-retail-display.webp"
  },
  {
    alt: "Packaged instant noodles and noodle cups arranged for retail",
    category: "Instant Food",
    imageUrl: "/images/discover/essentials/instant-food-retail-display.webp"
  },
  {
    alt: "Unopened canned foods arranged across store shelves",
    category: "Canned Goods",
    imageUrl: "/images/discover/essentials/canned-goods-retail-display.webp"
  },
  {
    alt: "Packaged rice and grains arranged in a supermarket aisle",
    category: "Staples",
    imageUrl: "/images/discover/essentials/staples-retail-display.webp"
  },
  {
    alt: "Packaged hair and personal care products on retail shelves",
    category: "Personal Care",
    imageUrl: "/images/discover/essentials/personal-care-retail-display.webp"
  },
  {
    alt: "Bottled household cleaners and laundry products on a display shelf",
    category: "Household",
    imageUrl: "/images/discover/essentials/household-retail-display.webp"
  },
  {
    alt: "Non-stick cookware arranged on a kitchenware store display",
    category: "Kitchen & Dining",
    imageUrl: "/images/discover/essentials/kitchen-dining-retail-display.webp"
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
  const [catalogError, setCatalogError] = useState("");
  const [catalogReloadKey, setCatalogReloadKey] = useState(0);
  const { addItem } = useCart();

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    setCatalogStatus("loading");

    fetchStorefrontProducts({ availability: "in-stock", page: 1, pageSize: 48 }, controller.signal)
      .then(({ items }) => {
        setCatalogProducts(items.filter(isPresentableStorefrontProduct));
        setCatalogStatus("ready");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setCatalogError(
            reason instanceof Error ? reason.message : "The live catalog could not be reached."
          );
          setCatalogStatus("error");
        }
      });

    return () => controller.abort();
  }, [catalogReloadKey]);

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

          if (reduceMotion) {
            root.classList.add("story-reduced-motion");
            gsap.set(query("[data-story-motion]"), { clearProps: "all" });
            return () => root.classList.remove("story-reduced-motion");
          }

          const scrub = desktop ? 0.9 : tablet ? 0.55 : 0.35;
          const progressFill = first<HTMLElement>(".discover-progress__fill");

          if (progressFill) {
            progressFill.style.transform = "scaleY(0)";
            progressFill.style.transformOrigin = "top";
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
            const beginningYear = beginning.querySelector<HTMLElement>(".story-beginning__year");
            const beginningKicker = beginning.querySelector<HTMLElement>(".story-kicker");
            const beginningHeadline = Array.from(
              beginning.querySelectorAll<HTMLElement>(".story-mask__line")
            );
            const beginningCopy = beginning.querySelector<HTMLElement>(".story-beginning__copy p");
            const originShelf = beginning.querySelector<HTMLElement>(".story-origin-shelf");
            const originShelfSign = beginning.querySelector<HTMLElement>(
              ".story-origin-shelf__sign"
            );
            const originShelfLine = beginning.querySelector<HTMLElement>(
              ".story-origin-shelf__line"
            );
            const originShelfItems = Array.from(
              beginning.querySelectorAll<HTMLElement>(".story-origin-shelf__item")
            );
            const beginningHandoff = beginning.querySelector<HTMLElement>(
              ".story-beginning__handoff"
            );

            if (
              beginningYear &&
              beginningKicker &&
              beginningHeadline.length &&
              beginningCopy &&
              originShelf &&
              originShelfSign &&
              originShelfLine &&
              originShelfItems.length &&
              beginningHandoff
            ) {
              const setBeginningAtmosphere = (isActive: boolean) => {
                beginning.classList.toggle("is-story-active", isActive);
              };

              gsap.set(beginningYear, {
                autoAlpha: 0,
                scale: desktop ? 1.07 : 1.03,
                y: desktop ? 18 : 8
              });
              gsap.set(beginningKicker, { autoAlpha: 0, x: -18 });
              gsap.set(beginningHeadline, { autoAlpha: 0, y: 24 });
              gsap.set(beginningCopy, { autoAlpha: 0, y: 16 });
              gsap.set(originShelf, { autoAlpha: 0, y: 18 });
              gsap.set(originShelfSign, { autoAlpha: 0, y: 12 });
              gsap.set(originShelfLine, { scaleX: 0 });
              gsap.set(originShelfItems, { autoAlpha: 0, scale: 0.68, y: 54 });
              gsap.set(beginningHandoff, { scaleX: 0 });

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
                      onToggle: ({ isActive }) => setBeginningAtmosphere(isActive),
                      scrub: 0.9
                    }
                  : {
                      trigger: beginning,
                      start: mobile ? "top 90%" : "top 84%",
                      end: "bottom 18%",
                      onToggle: ({ isActive }) => setBeginningAtmosphere(isActive),
                      scrub
                    }
              });

              beginningTimeline
                .addLabel("year", 0)
                .to(
                  beginningYear,
                  { autoAlpha: 1, duration: 0.12, ease: "power2.out", scale: 1, y: 0 },
                  "year+=0.02"
                )
                .addLabel("eyebrow", 0.13)
                .to(
                  beginningKicker,
                  { autoAlpha: 1, duration: 0.07, ease: "power2.out", x: 0 },
                  "eyebrow"
                )
                .addLabel("headline", 0.2)
                .to(
                  beginningHeadline,
                  { autoAlpha: 1, duration: 0.11, ease: "power2.out", stagger: 0.025, y: 0 },
                  "headline"
                )
                .to(beginningCopy, { autoAlpha: 1, duration: 0.09, ease: "power1.out", y: 0 }, 0.34)
                .addLabel("shelf", 0.43)
                .to(originShelf, { autoAlpha: 1, duration: 0.1, ease: "power1.out", y: 0 }, "shelf")
                .to(
                  originShelfSign,
                  { autoAlpha: 1, duration: 0.09, ease: "power2.out", y: 0 },
                  0.44
                )
                .to(originShelfLine, { duration: 0.1, ease: "none", scaleX: 1 }, 0.54)
                .to(
                  originShelfItems,
                  {
                    autoAlpha: 1,
                    duration: 0.09,
                    ease: "power2.out",
                    scale: 1,
                    stagger: 0.025,
                    y: 0
                  },
                  0.64
                )
                .addLabel("complete", 0.81)
                .to(beginningHandoff, { duration: 0.06, ease: "none", scaleX: 1 }, 0.93);
              settle(beginningTimeline, 0.99);
            }
          }

          const essentials = first<HTMLElement>(".story-products");
          if (essentials && !mobile) {
            const essentialsKicker = essentials.querySelector<HTMLElement>(".story-kicker");
            const essentialsCount = essentials.querySelector<HTMLElement>(".story-products__count");
            const essentialsHeadline = essentials.querySelector<HTMLElement>(
              ".story-products__heading .story-mask__line"
            );
            const essentialsCopy = essentials.querySelector<HTMLElement>(
              ".story-products__heading p"
            );
            const shelfRail = essentials.querySelector<HTMLElement>(".story-shelf__rail");
            const shelfItems = Array.from(
              essentials.querySelectorAll<HTMLElement>(".story-shelf__item")
            );
            const productsHandoff = essentials.querySelector<HTMLElement>(
              ".story-products__handoff"
            );

            if (
              essentialsKicker &&
              essentialsCount &&
              essentialsHeadline &&
              essentialsCopy &&
              shelfRail &&
              shelfItems.length &&
              productsHandoff
            ) {
              gsap.set(essentialsKicker, { autoAlpha: 0, x: -24 });
              gsap.set(essentialsCount, { autoAlpha: 0, scale: 0.92, y: 44 });
              gsap.set(essentialsHeadline, { autoAlpha: 0, y: 26 });
              gsap.set(essentialsCopy, { autoAlpha: 0, y: 18 });
              gsap.set(shelfRail, { scaleX: 0 });
              gsap.set(shelfItems, {
                autoAlpha: 0,
                rotate: (index) => (index % 2 === 0 ? -2 : 2),
                scale: 0.94,
                x: (index) => (index % 2 === 0 ? -14 : 14),
                y: 60
              });
              gsap.set(productsHandoff, { scaleX: 0 });

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
                .addLabel("entry", 0)
                .to(
                  essentialsKicker,
                  { autoAlpha: 1, duration: 0.07, ease: "power2.out", x: 0 },
                  "entry+=0.02"
                )
                .addLabel("headline", 0.1)
                .to(
                  essentialsCount,
                  { autoAlpha: 1, duration: 0.12, ease: "power2.out", scale: 1, y: 0 },
                  "headline"
                )
                .to(
                  essentialsHeadline,
                  { autoAlpha: 1, duration: 0.12, ease: "power2.out", y: 0 },
                  0.23
                )
                .to(
                  essentialsCopy,
                  { autoAlpha: 1, duration: 0.09, ease: "power1.out", y: 0 },
                  0.36
                )
                .addLabel("shelf", 0.47)
                .to(shelfRail, { duration: 0.1, ease: "none", scaleX: 1 }, "shelf")
                .addLabel("products", 0.59)
                .to(
                  shelfItems,
                  {
                    autoAlpha: 1,
                    duration: 0.07,
                    ease: "power2.out",
                    rotate: 0,
                    scale: 1,
                    stagger: 0.023,
                    x: 0,
                    y: 0
                  },
                  "products"
                )
                .to(productsHandoff, { duration: 0.04, ease: "none", scaleX: 1 }, 0.83)
                .addLabel("settled", 0.87);
              settle(productsTimeline, 0.87);
            }
          }

          const location = first<HTMLElement>(".story-location");
          if (location) {
            const realMap = location.querySelector<HTMLElement>(".story-real-map");
            const locationKicker = location.querySelector<HTMLElement>(".story-kicker");
            const locationHeadline = Array.from(
              location.querySelectorAll<HTMLElement>(".story-mask__line")
            );
            const mapBadge = location.querySelector<HTMLElement>(".story-real-map__badge");
            const mapTrace = location.querySelector<HTMLElement>(".story-real-map__trace");
            const mapRoute = location.querySelector<SVGGeometryElement>(
              ".story-real-map__route path"
            );
            const mapMarkers = Array.from(
              location.querySelectorAll<SVGCircleElement>(".story-real-map__route circle")
            );
            const locationLead = location.querySelector<HTMLElement>(".story-location__lead");
            const locationAddress = location.querySelector<HTMLElement>(".story-location__address");
            const locationAction = location.querySelector<HTMLElement>(".story-location__action");
            const locationHandoff = location.querySelector<HTMLElement>(".story-location__handoff");

            if (
              realMap &&
              locationKicker &&
              locationHeadline.length &&
              mapBadge &&
              mapTrace &&
              mapRoute &&
              mapMarkers.length &&
              locationLead &&
              locationAddress &&
              locationAction &&
              locationHandoff
            ) {
              gsap.set(realMap, { autoAlpha: 0, scale: 0.98, y: 18 });
              gsap.set(locationKicker, { autoAlpha: 0, x: -18 });
              gsap.set(locationHeadline, { autoAlpha: 0, y: 24 });
              gsap.set(mapBadge, { autoAlpha: 0, scale: 0.78, y: 14 });
              gsap.set(mapMarkers, { autoAlpha: 0, scale: 0.72, transformOrigin: "center" });
              gsap.set(mapTrace, { scaleX: 0 });
              gsap.set(mapRoute, { strokeDashoffset: 1 });
              gsap.set([locationLead, locationAddress], { autoAlpha: 0, x: 20 });
              gsap.set(locationAction, { autoAlpha: 0, x: 16 });
              gsap.set(locationHandoff, { scaleX: 0 });

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
                .addLabel("map", 0)
                .to(
                  realMap,
                  { autoAlpha: 1, duration: 0.1, ease: "power1.out", scale: 1, y: 0 },
                  "map+=0.02"
                )
                .to(
                  locationKicker,
                  { autoAlpha: 1, duration: 0.07, ease: "power2.out", x: 0 },
                  0.14
                )
                .addLabel("headline", 0.2)
                .to(
                  locationHeadline,
                  { autoAlpha: 1, duration: 0.1, ease: "power2.out", stagger: 0.025, y: 0 },
                  "headline"
                )
                .addLabel("marker", 0.35)
                .to(
                  [mapBadge, ...mapMarkers],
                  {
                    autoAlpha: 1,
                    duration: 0.08,
                    ease: "power2.out",
                    scale: 1,
                    stagger: 0.02,
                    y: 0
                  },
                  "marker"
                )
                .addLabel("route", 0.44)
                .to(mapTrace, { duration: 0.11, ease: "none", scaleX: 1 }, "route")
                .to(mapRoute, { duration: 0.13, ease: "none", strokeDashoffset: 0 }, "route")
                .addLabel("address", 0.58)
                .to(
                  [locationLead, locationAddress],
                  { autoAlpha: 1, duration: 0.09, ease: "power1.out", stagger: 0.02, x: 0 },
                  "address"
                )
                .to(locationAction, { autoAlpha: 1, duration: 0.08, ease: "power1.out", x: 0 }, 0.7)
                .addLabel("complete", 0.8)
                .to(locationHandoff, { duration: 0.04, ease: "none", scaleX: 1 }, 0.94);
              settle(locationTimeline, 0.98);
            }
          }

          const intelligence = first<HTMLElement>(".story-intelligence");
          if (intelligence) {
            const panels = Array.from(
              intelligence.querySelectorAll<HTMLElement>("[data-intelligence-panel]")
            );
            const markers = Array.from(
              intelligence.querySelectorAll<HTMLElement>("[data-intelligence-step]")
            );
            const markerIcons = markers
              .map((marker) => marker.querySelector<HTMLElement>(":scope > span"))
              .filter((icon): icon is HTMLElement => icon !== null);
            const firstPanel = panels[0];
            const firstMarker = markers[0];
            const intelligenceKicker = intelligence.querySelector<HTMLElement>(".story-kicker");
            const intelligenceHeadline = Array.from(
              intelligence.querySelectorAll<HTMLElement>(
                ".story-intelligence__heading .story-mask__line"
              )
            );
            const intelligenceCopy = intelligence.querySelector<HTMLElement>(
              ".story-intelligence__heading p"
            );
            const intelligenceSystem = intelligence.querySelector<HTMLElement>(
              ".story-intelligence__system"
            );
            const intelligenceProgress = intelligence.querySelector<HTMLElement>(
              ".story-intelligence__progress"
            );
            const intelligenceHandoff = intelligence.querySelector<HTMLElement>(
              ".story-intelligence__handoff"
            );

            if (
              desktop &&
              firstPanel &&
              firstMarker &&
              markerIcons.length === markers.length &&
              intelligenceKicker &&
              intelligenceHeadline.length &&
              intelligenceCopy &&
              intelligenceSystem &&
              intelligenceProgress &&
              intelligenceHandoff
            ) {
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

              gsap.set(panels, {
                autoAlpha: 0,
                display: "none",
                inset: 0,
                marginTop: 0,
                position: "absolute",
                scale: 1,
                y: 18
              });
              gsap.set(markers, { opacity: 0.42 });
              gsap.set(firstMarker, { opacity: 1 });
              gsap.set(markerIcons, { backgroundColor: "#202653", color: "#9ca3d9" });
              if (markerIcons[0]) {
                gsap.set(markerIcons[0], { backgroundColor: "#f7f9ff", color: "#625bff" });
              }
              gsap.set(intelligenceKicker, { autoAlpha: 0, x: -18 });
              gsap.set(intelligenceHeadline, { autoAlpha: 0, y: 22 });
              gsap.set(intelligenceCopy, { autoAlpha: 0, x: -16 });
              gsap.set(intelligenceSystem, { autoAlpha: 0, scale: 0.985, y: 16 });
              gsap.set(intelligenceProgress, { scaleY: 0.035 });
              gsap.set(intelligenceHandoff, { scaleX: 0 });

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
                  intelligenceKicker,
                  { autoAlpha: 1, duration: 0.1, ease: "power2.out", x: 0 },
                  0.02
                )
                .to(
                  intelligenceHeadline,
                  { autoAlpha: 1, duration: 0.16, stagger: 0.035, y: 0 },
                  0.1
                )
                .to(intelligenceCopy, { autoAlpha: 1, duration: 0.12, x: 0 }, 0.2)
                .to(
                  intelligenceSystem,
                  { autoAlpha: 1, duration: 0.18, ease: "power1.out", scale: 1, y: 0 },
                  0.34
                );

              panels.forEach((panel, index) => {
                const stageStart = 0.55 + index * 0.82;
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

                if (index === 0) {
                  intelligenceTimeline
                    .set(panel, { display: "block" }, stageStart - 0.06)
                    .to(
                      panel,
                      { autoAlpha: 1, duration: 0.14, ease: "power2.out", y: 0 },
                      stageStart
                    );
                } else {
                  const handoffStart = stageStart - 0.14;
                  const progress = index / (panels.length - 1);

                  intelligenceTimeline
                    .set(panel, { display: "block" }, handoffStart)
                    .to(
                      panels[index - 1]!,
                      { autoAlpha: 0, duration: 0.1, ease: "power1.in", y: -10 },
                      handoffStart
                    )
                    .to(
                      intelligenceProgress,
                      { duration: 0.12, ease: "none", scaleY: progress },
                      handoffStart
                    )
                    .to(markers[index - 1]!, { duration: 0.1, opacity: 0.68 }, handoffStart)
                    .to(markers[index]!, { duration: 0.1, opacity: 1 }, handoffStart)
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
                    .set(panels[index - 1]!, { display: "none" }, handoffStart + 0.11)
                    .to(
                      panel,
                      { autoAlpha: 1, duration: 0.14, ease: "power2.out", y: 0 },
                      stageStart
                    );
                }

                if (buildElements.length) {
                  intelligenceTimeline.to(
                    buildElements,
                    {
                      autoAlpha: 1,
                      duration: 0.16,
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
                    { duration: 0.2, ease: "none", scaleX: 1 },
                    stageStart + 0.34
                  );
                }

                if (chartPaths.length) {
                  intelligenceTimeline.to(
                    chartPaths,
                    { duration: 0.24, ease: "none", stagger: 0.04, strokeDashoffset: 0 },
                    stageStart + 0.32
                  );
                }
              });

              intelligenceTimeline
                .addLabel("intelligence-complete", 6.15)
                .to({ hold: 0 }, { duration: 1, ease: "none", hold: 1 }, 6.15)
                .to(intelligenceHandoff, { duration: 0.18, ease: "none", scaleX: 1 }, 7.15)
                .to({ hold: 0 }, { duration: 0.05, ease: "none", hold: 1 }, 7.35);
            }
          }

          const shop = first<HTMLElement>(".story-shop");
          if (shop) {
            const shopKicker = shop.querySelector<HTMLElement>(".story-kicker");
            const shopHeadline = Array.from(
              shop.querySelectorAll<HTMLElement>(".story-shop__copy .story-mask__line")
            );
            const shopCopy = shop.querySelector<HTMLElement>(".story-shop__copy p");
            const shopCta = shop.querySelector<HTMLElement>(".story-shop__copy .customer-button");
            const liveStore = shop.querySelector<HTMLElement>(".story-live-store");
            const liveStoreIdentity = shop.querySelector<HTMLElement>(
              ".story-live-store__bar > span:first-child"
            );
            const liveStoreSearch = shop.querySelector<HTMLElement>(".story-live-store__search");
            const liveStoreCart = shop.querySelector<HTMLElement>(".story-live-store__cart");
            const shopHandoff = shop.querySelector<HTMLElement>(".story-shop__handoff");

            if (
              shopKicker &&
              shopHeadline.length &&
              shopCopy &&
              shopCta &&
              liveStore &&
              liveStoreIdentity &&
              liveStoreSearch &&
              liveStoreCart &&
              shopHandoff
            ) {
              gsap.set(shopKicker, { autoAlpha: 0, x: -18 });
              gsap.set(shopHeadline, { autoAlpha: 0, y: 24 });
              gsap.set(shopCopy, { autoAlpha: 0, x: -20 });
              gsap.set(shopCta, { autoAlpha: 0, scale: 0.94, x: -14 });
              gsap.set(liveStore, { autoAlpha: 0, scale: 0.98, y: 18 });
              gsap.set(liveStoreIdentity, { autoAlpha: 0, y: 10 });
              gsap.set(liveStoreSearch, { autoAlpha: 0, y: 10 });
              gsap.set(liveStoreCart, { autoAlpha: 0, rotate: 6, scale: 0.7 });
              gsap.set(shopHandoff, { scaleX: 0 });
              shop.classList.add("story-shop-motion-ready");

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
                .to(shopKicker, { autoAlpha: 1, duration: 0.07, ease: "power2.out", x: 0 }, 0.02)
                .to(
                  shopHeadline,
                  { autoAlpha: 1, duration: 0.1, ease: "power2.out", stagger: 0.025, y: 0 },
                  0.08
                )
                .to(shopCopy, { autoAlpha: 1, duration: 0.08, ease: "power1.out", x: 0 }, 0.19)
                .to(
                  liveStore,
                  { autoAlpha: 1, duration: 0.1, ease: "power1.out", scale: 1, y: 0 },
                  0.29
                )
                .to(
                  liveStoreIdentity,
                  { autoAlpha: 1, duration: 0.08, ease: "power2.out", y: 0 },
                  0.36
                )
                .to(
                  liveStoreSearch,
                  { autoAlpha: 1, duration: 0.08, ease: "power1.out", y: 0 },
                  0.44
                )
                .to(
                  shop,
                  {
                    "--shop-card-opacity": 1,
                    "--shop-card-scale": 1,
                    "--shop-card-y": "0px",
                    duration: 0.11,
                    ease: "power2.out"
                  },
                  0.52
                )
                .to(
                  shop,
                  {
                    "--shop-info-opacity": 1,
                    "--shop-info-y": "0px",
                    duration: 0.09,
                    ease: "power1.out"
                  },
                  0.63
                )
                .to(
                  shop,
                  {
                    "--shop-action-opacity": 1,
                    "--shop-action-scale": 1,
                    duration: 0.08,
                    ease: "power2.out"
                  },
                  0.72
                )
                .to(
                  liveStoreCart,
                  { autoAlpha: 1, duration: 0.08, ease: "power2.out", rotate: 0, scale: 1 },
                  0.72
                )
                .to(
                  shopCta,
                  { autoAlpha: 1, duration: 0.08, ease: "power2.out", scale: 1, x: 0 },
                  0.78
                )
                .addLabel("shop-complete", 0.86)
                .to(shopHandoff, { duration: 0.04, ease: "none", scaleX: 1 }, 0.95);
              settle(shopTimeline, 0.99);
            }
          }

          root.classList.add("story-motion-ready");

          let currentScene = -1;
          let progressActive = false;
          let rootTop = 0;
          let rootBottom = 0;
          let sceneOwnershipStarts: number[] = [];

          const cacheStoryLayout = () => {
            const rootBounds = root.getBoundingClientRect();
            const ownershipOffset = desktop ? 76 : window.innerHeight * 0.5;
            rootTop = rootBounds.top + window.scrollY;
            rootBottom = rootBounds.bottom + window.scrollY;
            sceneOwnershipStarts = scenes.map((scene) => {
              const anchor = scene.parentElement?.classList.contains("pin-spacer")
                ? scene.parentElement
                : scene;
              return anchor.getBoundingClientRect().top + window.scrollY - ownershipOffset;
            });
          };

          const updateStoryUi = () => {
            const scrollTop = window.scrollY;
            const viewportHeight = window.innerHeight;
            const progressStart = rootTop - 76;
            const progressEnd = Math.max(progressStart + 1, rootBottom - viewportHeight);
            const progress = gsap.utils.clamp(
              0,
              1,
              (scrollTop - progressStart) / (progressEnd - progressStart)
            );

            if (progressFill) progressFill.style.transform = `scaleY(${progress})`;

            const nextProgressActive =
              scrollTop >= rootTop - viewportHeight * 0.75 &&
              scrollTop <= rootBottom - viewportHeight * 0.25;
            if (nextProgressActive !== progressActive) {
              progressActive = nextProgressActive;
              root.classList.toggle("story-progress-active", progressActive);
            }

            let nextScene = 0;
            for (let index = 1; index < sceneOwnershipStarts.length; index += 1) {
              if (sceneOwnershipStarts[index]! <= scrollTop) nextScene = index;
              else break;
            }
            if (nextScene !== currentScene) {
              currentScene = nextScene;
              setActiveScene(nextScene);
            }
          };

          ScrollTrigger.create({
            trigger: root,
            start: "top bottom",
            end: "bottom top",
            onEnter: updateStoryUi,
            onEnterBack: updateStoryUi,
            onRefresh: () => {
              cacheStoryLayout();
              updateStoryUi();
            },
            onUpdate: updateStoryUi
          });

          return () => {
            beginning?.classList.remove("is-story-active");
            shop?.classList.remove("story-shop-motion-ready");
            root.classList.remove("story-motion-ready", "story-progress-active");
            if (progressFill) {
              progressFill.style.removeProperty("transform");
              progressFill.style.removeProperty("transform-origin");
            }
          };
        }
      );
    }, root);

    const scheduleRefresh = () => {
      if (!mounted) return;
      window.cancelAnimationFrame(refreshFrame);
      refreshFrame = window.requestAnimationFrame(() => {
        refreshFrame = 0;
        if (mounted) ScrollTrigger.refresh();
      });
    };

    if (document.fonts?.status === "loading") void document.fonts.ready.then(scheduleRefresh);
    else scheduleRefresh();

    return () => {
      mounted = false;
      window.cancelAnimationFrame(refreshFrame);
      animationMedia?.revert();
      context.revert();
      root.classList.remove("story-motion-ready", "story-progress-active", "story-reduced-motion");
    };
  }, []);

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
                    <ProductImage
                      alt={item.alt}
                      fallbackLabel="Image temporarily unavailable"
                      imageUrl={item.imageUrl}
                    />
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
                      : catalogStatus === "error"
                        ? catalogError
                        : "No in-stock catalog products are available right now."}
                  </p>
                  {catalogStatus === "error" ? (
                    <button
                      onClick={() => setCatalogReloadKey((current) => current + 1)}
                      type="button"
                    >
                      Retry connection
                    </button>
                  ) : null}
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
