type AboutExperienceModule = typeof import("@/pages/customer/AboutExperiencePage");

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

let aboutModulePromise: Promise<AboutExperienceModule> | null = null;

export function loadAboutExperienceModule() {
  aboutModulePromise ??= import("@/pages/customer/AboutExperiencePage");
  return aboutModulePromise;
}

export function preloadAboutExperience() {
  void loadAboutExperienceModule();
}

export function scheduleAboutExperiencePreload() {
  const idleWindow = window as IdleWindow;

  if (idleWindow.requestIdleCallback) {
    const idleId = idleWindow.requestIdleCallback(
      () => {
        preloadAboutExperience();
      },
      { timeout: 400 }
    );

    return () => idleWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(() => {
    preloadAboutExperience();
  }, 80);

  return () => window.clearTimeout(timeoutId);
}
