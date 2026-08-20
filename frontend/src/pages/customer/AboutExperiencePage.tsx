import { useLayoutEffect, useRef } from "react";

import { AboutStorefrontHandoff } from "@/components/customer/about/AboutStorefrontHandoff";
import { DiscoverPage } from "@/pages/customer/DiscoverPage";
import "@/styles/about-storefront-handoff.css";

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
    <div className="about-experience" ref={rootRef}>
      <DiscoverPage navigate={navigate} />
      <AboutStorefrontHandoff navigate={navigate} />
    </div>
  );
}
