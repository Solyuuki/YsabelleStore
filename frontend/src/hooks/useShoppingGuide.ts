import { driver } from "driver.js";
import { useEffect } from "react";

const GUIDE_PENDING_KEY = "ysabelle:shopping-guide:pending";
const GUIDE_COMPLETE_KEY = "ysabelle:shopping-guide:complete";
const GUIDE_SCROLL_TIMEOUT_MS = 900;
const GUIDE_TARGET_WAIT_MS = 4_000;
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

    function moveGuide(direction: "next" | "previous", currentIndex: number | undefined) {
      if (isTransitioning) return;

      const nextIndex = Math.max(0, (currentIndex ?? 0) + (direction === "next" ? 1 : -1));
      isTransitioning = true;

      const wrapper = guide.getState().popover?.wrapper;
      if (wrapper) wrapper.classList.add("is-transitioning");

      const completeMove = () => {
        requestAnimationFrame(() => {
          if (direction === "next") guide.moveNext();
          else guide.movePrevious();
          isTransitioning = false;
        });
      };

      waitForGuideTarget(nextIndex, (target) => {
        if (!target || prefersReducedMotion || targetIsComfortablyVisible(target)) {
          completeMove();
          return;
        }

        target.scrollIntoView({
          behavior: prefersReducedMotion ? "auto" : "smooth",
          block: "center",
          inline: "nearest"
        });
        waitForScrollSettle(completeMove);
      });
    }

    const guide = driver({
      allowClose: true,
      allowKeyboardControl: true,
      allowScroll: true,
      animate: !prefersReducedMotion,
      duration: prefersReducedMotion ? 0 : 520,
      doneBtnText: "Finish",
      nextBtnText: "Next",
      prevBtnText: "Back",
      progressText: "Step {{current}} of {{total}}",
      showProgress: true,
      showButtons: ["previous", "next", "close"],
      skipMissingElement: true,
      smoothScroll: false,
      waitForElement: GUIDE_TARGET_WAIT_MS,
      overlayColor: "#101426",
      overlayOpacity: 0.52,
      popoverClass: "ysabelle-guide",
      onNextClick: (_element, _step, options) => moveGuide("next", options.index),
      onPrevClick: (_element, _step, options) => moveGuide("previous", options.index),
      onDestroyed: () => localStorage.setItem(GUIDE_COMPLETE_KEY, "true"),
      onDoneClick: () => {
        localStorage.setItem(GUIDE_COMPLETE_KEY, "true");
        guide.destroy();
        navigate("/shop");
      },
      onPopoverRender: (popover) => {
        popover.closeButton.textContent = "Skip";
        popover.closeButton.setAttribute("aria-label", "Skip shopping guide");
      },
      steps: [
        {
          element: GUIDE_TARGETS[0],
          popover: {
            title: "Search groceries",
            description: "Search by product or category from anywhere in the shop.",
            side: "bottom",
            align: "center"
          }
        },
        {
          element: GUIDE_TARGETS[1],
          popover: {
            title: "Browse categories",
            description: "Jump straight to the section that matches your shopping list.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: GUIDE_TARGETS[2],
          popover: {
            title: "View a product",
            description: "Open a product to check its price, unit, and current availability.",
            side: "right",
            align: "center"
          }
        },
        {
          element: GUIDE_TARGETS[3],
          popover: {
            title: "Add what you need",
            description: "Choose a quantity, then add the item to your grocery cart.",
            side: "right",
            align: "center"
          }
        },
        {
          element: GUIDE_TARGETS[4],
          popover: {
            title: "Review your cart",
            description: "Your cart stays within reach and keeps your item count visible.",
            side: "bottom",
            align: "end"
          }
        },
        {
          element: GUIDE_TARGETS[5],
          popover: {
            title: "Checkout clearly",
            description: "Review totals, provide pickup details, and pay cash when you collect.",
            side: "top",
            align: "start"
          }
        },
        {
          popover: {
            title: "You are ready",
            description:
              "Start shopping whenever you are ready. You can restart this guide from Help."
          }
        }
      ]
    });

    guide.drive();
  }

  function startGuide() {
    if (pathname !== "/") {
      sessionStorage.setItem(GUIDE_PENDING_KEY, "true");
      navigate("/");
      return;
    }
    window.setTimeout(runGuide, 500);
  }

  useEffect(() => {
    if (pathname !== "/" || sessionStorage.getItem(GUIDE_PENDING_KEY) !== "true") return;
    sessionStorage.removeItem(GUIDE_PENDING_KEY);
    const timeout = window.setTimeout(runGuide, 700);
    return () => window.clearTimeout(timeout);
  }, [pathname]);

  return { startGuide };
}
