import { useEffect, useState, type CSSProperties } from "react";

import { AboutStorefrontHandoff } from "@/components/customer/about/AboutStorefrontHandoff";
import { DiscoverPage } from "@/pages/customer/DiscoverPage";
import "@/styles/about-welcome-motion.css";
import "@/styles/about-catalog-intelligence.css";
import "@/styles/about-sales-inventory.css";
import "@/styles/about-forecast-intelligence.css";
import "@/styles/about-storefront-handoff.css";
import "@/styles/about-storefront-handoff-layout.css";

const storyTheme = {
  "--story-blue": "#008cff",
  "--story-indigo": "#625bff",
  "--story-magenta": "#f43f8c",
  "--story-navy": "#101426",
  "--story-violet": "#a83cf0"
} as CSSProperties;

export function AboutExperiencePage({ navigate }: { navigate: (path: string) => void }) {
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
        style={storyTheme}
      >
        <span className="sr-only">Opening Ysabelle Store About experience...</span>
      </section>
    );
  }

  return (
    <div className="about-experience" style={storyTheme}>
      <DiscoverPage navigate={navigate} variant="about" />
      <AboutStorefrontHandoff navigate={navigate} />
    </div>
  );
}
