import { driver } from "driver.js";
import { useEffect } from "react";

const GUIDE_PENDING_KEY = "ysabelle:shopping-guide:pending";
const GUIDE_COMPLETE_KEY = "ysabelle:shopping-guide:complete";
const GUIDE_SCROLL_TIMEOUT_MS = 720;
const GUIDE_TARGET_WAIT_MS = 4_000;
const GUIDE_ROUTE_TRANSITION_CLASS = "ysabelle-guide-route-transition";
const GUIDE_ROUTE_EXIT_MS = 120;
const GUIDE_ROUTE_ENTER_MS = 180;
const GUIDE_SCROLLING_CLASS = "ysabelle-guide-scrolling";
const GUIDE_FINISHING_CLASS = "ysabelle-guide-finishing";
const GUIDE_FINISH_DURATION_MS = 160;
const GUIDE_SCROLL_IDLE_MS = 110;
const GUIDE_STEP_EXIT_MS = 90;
const GUIDE_TARGETS = [
  '[data-tour="search"]',
  ".home-categories .home-section-heading",
  '[data-tour="product"]',
  '[data-tour="add-to-cart"]',
  '[data-tour="cart"]',
  '[data-tour="checkout"]',
  null
] as const;

function getGuideTarget(index: number) {
  const selector = GUIDE_TARGETS[index];
  return selector ? document.querySelector<HTMLElement>(selector) : null;
}

function targetIsComfortablyVisible(target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  const safeTop = 96;
  const safeBottom = window.innerHeight - 96;
  const targetCenter = rect.top + rect.height / 2;
  return targetCenter >= safeTop && targetCenter <= safeBottom;
}

function waitForGuideTarget(index: number, onReady: (target: HTMLElement | null) => void) {
  const selector = GUIDE_TARGETS[index];
  if (!selector) {
    onReady(null);
    return;
  }

  const existingTarget = getGuideTarget(index);
  if (existingTarget) {
    onReady(existingTarget);
    return;
  }

  const startedAt = performance.now();
  const findTarget = () => {
    const target = getGuideTarget(index);
    if (target || performance.now() - startedAt >= GUIDE_TARGET_WAIT_MS) {
      onReady(target);
      return;
    }
    window.setTimeout(findTarget, 80);
  };

  findTarget();
}

function waitForScrollSettle(onSettled: () => void) {
  const startedAt = performance.now();
  let lastScrollY = window.scrollY;
  let stableFrames = 0;

  const check = () => {
    const currentScrollY = window.scrollY;
    stableFrames = Math.abs(currentScrollY - lastScrollY) < 0.5 ? stableFrames + 1 : 0;
    lastScrollY = currentScrollY;

    if (stableFrames >= 4 || performance.now() - startedAt >= GUIDE_SCROLL_TIMEOUT_MS) {
      onSettled();
      return;
    }

    requestAnimationFrame(check);
  };

  requestAnimationFrame(check);
}

export function useShoppingGuide(pathname: string, navigate: (path: string) => void) {
  function runGuide() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let isTransitioning = false;
    let scrollIdleTimer: number | null = null;
    let finishTimer: number | null = null;

    function clearGuideClasses() {
      document.documentElement.classList.remove(GUIDE_SCROLLING_CLASS, GUIDE_FINISHING_CLASS);
    }

    function handleGuideScroll() {
      if (prefersReducedMotion) return;

      document.documentElement.classList.add(GUIDE_SCROLLING_CLASS);
      if (scrollIdleTimer !== null) window.clearTimeout(scrollIdleTimer);
      scrollIdleTimer = window.setTimeout(() => {
        document.documentElement.classList.remove(GUIDE_SCROLLING_CLASS);
        scrollIdleTimer = null;
      }, GUIDE_SCROLL_IDLE_MS);
    }

    function moveGuide(direction: "next" | "previous", currentIndex: number | undefined) {
      if (isTransitioning) return;

      const nextIndex = Math.max(0, (currentIndex ?? 0) + (direction === "next" ? 1 : -1));
      const wrapper = guide.getState().popover?.wrapper;
      isTransitioning = true;

      if (!prefersReducedMotion) wrapper?.classList.add("is-transitioning");

      const revealNextPopover = () => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            guide.getState().popover?.wrapper.classList.remove("is-transitioning");
            isTransitioning = false;
          });
        });
      };

      const completeMove = () => {
        document.documentElement.classList.remove(GUIDE_SCROLLING_CLASS);
        if (direction === "next") guide.moveNext();
        else guide.movePrevious();
        revealNextPopover();
      };

      const beginMove = (target: HTMLElement | null) => {
        if (!target || prefersReducedMotion || targetIsComfortablyVisible(target)) {
          completeMove();
          return;
        }

        document.documentElement.classList.add(GUIDE_SCROLLING_CLASS);
        target.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest"
        });
        waitForScrollSettle(completeMove);
      };

      waitForGuideTarget(nextIndex, (target) => {
        if (prefersReducedMotion) {
          beginMove(target);
          return;
        }

        window.setTimeout(() => beginMove(target), GUIDE_STEP_EXIT_MS);
      });
    }

    window.addEventListener("scroll", handleGuideScroll, { passive: true });

    const guide = driver({
      allowClose: true,
      allowKeyboardControl: true,
      allowScroll: true,
      animate: !prefersReducedMotion,
      duration: prefersReducedMotion ? 0 : 340,
      doneBtnText: "Start shopping",
      nextBtnText: "Next",
      prevBtnText: "Back",
      progressText: "{{current}} of {{total}}",
      showProgress: true,
      showButtons: ["previous", "next", "close"],
      skipMissingElement: true,
      smoothScroll: false,
      stagePadding: 10,
      stageRadius: 16,
      popoverOffset: 14,
      waitForElement: 4_000,
      overlayColor: "#101426",
      overlayOpacity: 0.46,
      popoverClass: "ysabelle-guide",
      onNextClick: (_element, _step, options) => moveGuide("next", options.index),
      onPrevClick: (_element, _step, options) => moveGuide("previous", options.index),
      onDestroyed: () => {
        localStorage.setItem(GUIDE_COMPLETE_KEY, "true");
        window.removeEventListener("scroll", handleGuideScroll);
        if (scrollIdleTimer !== null) window.clearTimeout(scrollIdleTimer);
        if (finishTimer !== null) window.clearTimeout(finishTimer);
        clearGuideClasses();
      },
      onDoneClick: () => {
        const finish = () => {
          localStorage.setItem(GUIDE_COMPLETE_KEY, "true");
          document.documentElement.classList.remove(GUIDE_FINISHING_CLASS);
          guide.destroy();
          navigate("/shop");
        };

        if (prefersReducedMotion) {
          finish();
          return;
        }

        document.documentElement.classList.remove(GUIDE_SCROLLING_CLASS);
        document.documentElement.classList.add(GUIDE_FINISHING_CLASS);
        finishTimer = window.setTimeout(finish, GUIDE_FINISH_DURATION_MS);
      },
      onPopoverRender: (popover) => {
        popover.wrapper.classList.remove("is-transitioning");
        popover.closeButton.textContent = "Skip";
        popover.closeButton.setAttribute("aria-label", "Skip shopping guide");
      },
      steps: [
        {
          element: GUIDE_TARGETS[0],
          popover: {
            title: "Search the catalog",
            description:
              "Find products or categories from the header. Suggestions and recent searches help you move faster.",
            side: "bottom",
            align: "center"
          }
        },
        {
          element: GUIDE_TARGETS[1],
          popover: {
            title: "Browse by aisle",
            description: "Choose a category to narrow the live catalog without losing your place.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: GUIDE_TARGETS[2],
          popover: {
            title: "Check product details",
            description:
              "See the current price, unit, rating, availability, and save favorites for later.",
            side: "right",
            align: "center"
          }
        },
        {
          element: GUIDE_TARGETS[3],
          popover: {
            title: "Build your basket",
            description: "Choose a quantity, then add the item to your cart.",
            side: "right",
            align: "center"
          }
        },
        {
          element: GUIDE_TARGETS[4],
          popover: {
            title: "Review your cart",
            description: "Adjust quantities and review your running total before checkout.",
            side: "bottom",
            align: "end"
          }
        },
        {
          element: GUIDE_TARGETS[5],
          popover: {
            title: "Checkout & delivery",
            description:
              "Confirm your delivery details, then choose secure online payment or Cash on Delivery.",
            side: "top",
            align: "start"
          }
        },
        {
          popover: {
            title: "Ready to shop",
            description: "You can reopen this guide anytime from Guide in the header."
          }
        }
      ]
    });

    guide.drive();
  }

  function startGuide() {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (pathname !== "/") {
      sessionStorage.setItem(GUIDE_PENDING_KEY, "true");

      if (prefersReducedMotion) {
        navigate("/");
        return;
      }

      document.documentElement.classList.add(GUIDE_ROUTE_TRANSITION_CLASS);
      window.setTimeout(() => navigate("/"), GUIDE_ROUTE_EXIT_MS);
      return;
    }

    window.setTimeout(runGuide, 500);
  }

  useEffect(() => {
    if (pathname !== "/" || sessionStorage.getItem(GUIDE_PENDING_KEY) !== "true") return;

    sessionStorage.removeItem(GUIDE_PENDING_KEY);
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    let startTimeout: number | null = null;

    if (prefersReducedMotion) {
      document.documentElement.classList.remove(GUIDE_ROUTE_TRANSITION_CLASS);
    } else {
      requestAnimationFrame(() => {
        if (!cancelled) document.documentElement.classList.remove(GUIDE_ROUTE_TRANSITION_CLASS);
      });
    }

    waitForGuideTarget(0, () => {
      if (cancelled) return;

      startTimeout = window.setTimeout(
        () => {
          if (!cancelled) runGuide();
        },
        prefersReducedMotion ? 0 : GUIDE_ROUTE_ENTER_MS
      );
    });

    return () => {
      cancelled = true;
      if (startTimeout !== null) window.clearTimeout(startTimeout);
      document.documentElement.classList.remove(GUIDE_ROUTE_TRANSITION_CLASS);
    };
  }, [pathname]);

  return { startGuide };
}
