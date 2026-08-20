import { useLayoutEffect, useRef, type CSSProperties } from "react";

import { AboutStorefrontHandoff } from "@/components/customer/about/AboutStorefrontHandoff";
import { DiscoverPage } from "@/pages/customer/DiscoverPage";
import "@/styles/about-storefront-handoff.css";

const storyTheme = {
  "--story-blue": "#008cff",
  "--story-indigo": "#625bff",
  "--story-magenta": "#f43f8c",
  "--story-navy": "#101426",
  "--story-violet": "#a83cf0"
} as CSSProperties;

export function AboutExperiencePage({ navigate }: { navigate: (path: string) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const legacyShop = rootRef.current?.querySelector<HTMLElement>(
      ".discover-story #discover-shop"
    );
    if (!legacyShop) return;

    legacyShop.id = "discover-shop-legacy";
    legacyShop.classList.add("story-shop--legacy-hidden");
    legacyShop.setAttribute("aria-hidden", "true");

    return () => {
      legacyShop.id = "discover-shop";
      legacyShop.classList.remove("story-shop--legacy-hidden");
      legacyShop.removeAttribute("aria-hidden");
    };
  }, []);

  return (
    <div className="about-experience" ref={rootRef} style={storyTheme}>
      <DiscoverPage navigate={navigate} />
      <AboutStorefrontHandoff navigate={navigate} />
    </div>
  );
}
