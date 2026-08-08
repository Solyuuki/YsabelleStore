import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useEffect } from "react";

const GUIDE_PENDING_KEY = "ysabelle:shopping-guide:pending";
const GUIDE_COMPLETE_KEY = "ysabelle:shopping-guide:complete";

export function useShoppingGuide(pathname: string, navigate: (path: string) => void) {
  function runGuide() {
    const guide = driver({
      allowClose: true,
      allowKeyboardControl: true,
      allowScroll: true,
      animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      doneBtnText: "Finish",
      nextBtnText: "Next",
      prevBtnText: "Back",
      progressText: "Step {{current}} of {{total}}",
      showProgress: true,
      showButtons: ["previous", "next", "close"],
      skipMissingElement: true,
      smoothScroll: true,
      waitForElement: 1_000,
      overlayColor: "#052e26",
      overlayOpacity: 0.58,
      popoverClass: "ysabelle-guide",
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
          element: '[data-tour="search"]',
          popover: {
            title: "Search groceries",
            description: "Search by product or category from anywhere in the shop."
          }
        },
        {
          element: '[data-tour="categories"]',
          popover: {
            title: "Browse categories",
            description: "Jump straight to the section that matches your shopping list."
          }
        },
        {
          element: '[data-tour="product"]',
          popover: {
            title: "View a product",
            description: "Open a product to check its price, unit, and current availability."
          }
        },
        {
          element: '[data-tour="add-to-cart"]',
          popover: {
            title: "Add what you need",
            description: "Choose a quantity, then add the item to your grocery cart."
          }
        },
        {
          element: '[data-tour="cart"]',
          popover: {
            title: "Review your cart",
            description: "Your cart stays within reach and keeps your item count visible."
          }
        },
        {
          element: '[data-tour="checkout"]',
          popover: {
            title: "Checkout clearly",
            description: "Review totals, provide pickup details, and pay cash when you collect."
          }
        },
        {
          element: '[data-tour="start-shopping"]',
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
