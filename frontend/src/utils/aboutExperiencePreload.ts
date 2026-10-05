const ABOUT_HERO_VIDEO = "/media/about-origin-motion-6738635d.mp4";

type AboutExperienceModule = typeof import("@/pages/customer/AboutExperiencePage");

let aboutModulePromise: Promise<AboutExperienceModule> | null = null;
let heroPreloadLink: HTMLLinkElement | null = null;

function shouldPreloadHeroMedia() {
  const navigatorWithConnection = navigator as Navigator & {
    connection?: {
      effectiveType?: string;
      saveData?: boolean;
    };
  };
  const connection = navigatorWithConnection.connection;

  if (connection?.saveData) return false;
  if (connection?.effectiveType && /(^|-)2g$/.test(connection.effectiveType)) return false;

  return window.location.protocol !== "file:";
}

function ensureHeroPreload() {
  if (!shouldPreloadHeroMedia() || heroPreloadLink) return;

  const existing = document.querySelector<HTMLLinkElement>(
    `link[data-about-hero-preload="${ABOUT_HERO_VIDEO}"]`
  );
  if (existing) {
    heroPreloadLink = existing;
    return;
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = ABOUT_HERO_VIDEO;
  link.type = "video/mp4";
  link.setAttribute("fetchpriority", "high");
  link.dataset.aboutHeroPreload = ABOUT_HERO_VIDEO;
  document.head.appendChild(link);
  heroPreloadLink = link;
}

export function loadAboutExperienceModule() {
  aboutModulePromise ??= import("@/pages/customer/AboutExperiencePage");
  return aboutModulePromise;
}

export function preloadAboutExperience({ media = true }: { media?: boolean } = {}) {
  void loadAboutExperienceModule();
  if (media) ensureHeroPreload();
}

export function scheduleAboutExperiencePreload() {
  const timeoutId = window.setTimeout(() => {
    preloadAboutExperience();
  }, 700);

  return () => window.clearTimeout(timeoutId);
}
