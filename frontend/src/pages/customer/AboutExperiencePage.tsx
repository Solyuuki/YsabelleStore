import { lazy, Suspense, useEffect, useState, type CSSProperties } from "react";

import { DiscoverPage } from "@/pages/customer/DiscoverPage";
import { useAppearance } from "@/context/AppearanceContext";
import "@/styles/about-welcome-motion.css";
import "@/styles/about-catalog-intelligence.css";
import "@/styles/about-sales-inventory.css";
import "@/styles/about-forecast-intelligence.css";

const storyTheme = {
  "--story-blue": "#008cff",
  "--story-indigo": "#625bff",
  "--story-magenta": "#f43f8c",
  "--story-navy": "#101426",
  "--story-violet": "#a83cf0"
} as CSSProperties;

const DeferredAboutStorefrontHandoff = lazy(() =>
  import("@/components/customer/about/AboutStorefrontHandoff").then(
    ({ AboutStorefrontHandoff }) => ({ default: AboutStorefrontHandoff })
  )
);

export function AboutExperiencePage({ navigate }: { navigate: (path: string) => void }) {
  const { storefrontTheme } = useAppearance();
  const [storyReady, setStoryReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setStoryReady(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (!storyReady) {
    return (
      <section
        aria-label="Opening About"
        className="about-experience about-experience--boot about-experience-boot"
        data-about-hero-theme={storefrontTheme}
        style={storyTheme}
      >
        <span className="sr-only">Opening Ysabelle Store About experience...</span>
      </section>
    );
  }

  return (
    <div className="about-experience" data-about-hero-theme={storefrontTheme} style={storyTheme}>
      <DiscoverPage navigate={navigate} variant="about" />
      <Suspense
        fallback={
          <section
            aria-hidden="true"
            className="story-scene story-delivery story-delivery--loading"
            id="discover-shop"
          />
        }
      >
        <DeferredAboutStorefrontHandoff navigate={navigate} />
      </Suspense>
    </div>
  );
}
