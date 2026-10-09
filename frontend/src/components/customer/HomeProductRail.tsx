import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import "@/styles/customer-home-product-rail.css";

type RailState = {
  canScrollNext: boolean;
  canScrollPrevious: boolean;
  firstVisible: number;
  visibleCount: number;
};

const initialRailState: RailState = {
  canScrollNext: false,
  canScrollPrevious: false,
  firstVisible: 0,
  visibleCount: 1
};

export function HomeProductRail({ children, label }: { children: ReactNode; label: string }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const railLayoutRef = useRef({ itemStep: 1, visibleCount: 1 });
  const [state, setState] = useState<RailState>(initialRailState);
  const items = Children.toArray(children);

  // Reading offsets on every smooth-scroll frame forces layout. Measure only
  // when the rail is mounted, its contents change, or an observed size changes.
  const measureRailLayout = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const firstItem = viewport.querySelector<HTMLElement>("[data-home-product-rail-item]");
    if (!firstItem) {
      railLayoutRef.current = { itemStep: 1, visibleCount: 1 };
      return;
    }

    const sibling = firstItem.nextElementSibling as HTMLElement | null;
    const secondItem = sibling?.hasAttribute("data-home-product-rail-item") ? sibling : null;
    const itemStep = secondItem
      ? Math.max(1, secondItem.offsetLeft - firstItem.offsetLeft)
      : Math.max(1, firstItem.offsetWidth);

    railLayoutRef.current = {
      itemStep,
      visibleCount: Math.max(1, Math.round(viewport.clientWidth / itemStep))
    };
  }, []);

  const syncRailState = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (!items.length) {
      setState((current) =>
        current.canScrollNext || current.canScrollPrevious || current.firstVisible !== 0 ||
        current.visibleCount !== 1 ? initialRailState : current
      );
      return;
    }

    const { itemStep, visibleCount } = railLayoutRef.current;
    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const scrollLeft = Math.max(0, viewport.scrollLeft);
    const firstVisible = Math.min(
      Math.max(0, Math.round(scrollLeft / itemStep)),
      Math.max(0, items.length - 1)
    );
    const nextState: RailState = {
      canScrollNext: scrollLeft < maxScrollLeft - 2,
      canScrollPrevious: scrollLeft > 2,
      firstVisible,
      visibleCount
    };

    // Scroll may emit dozens of events while the same cards remain visible;
    // avoid committing identical React state and repainting product cards.
    setState((current) =>
      current.canScrollNext === nextState.canScrollNext &&
      current.canScrollPrevious === nextState.canScrollPrevious &&
      current.firstVisible === nextState.firstVisible &&
      current.visibleCount === nextState.visibleCount
        ? current
        : nextState
    );
  }, [items.length]);

  const scheduleSync = useCallback(() => {
    // One pending RAF is enough; repeatedly cancelling it can delay updates.
    if (animationFrameRef.current !== null) return;

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;
      syncRailState();
    });
  }, [syncRailState]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const resizeObserver = new ResizeObserver(() => {
      measureRailLayout();
      scheduleSync();
    });
    resizeObserver.observe(viewport);
    const firstItem = viewport.querySelector<HTMLElement>("[data-home-product-rail-item]");
    if (firstItem) resizeObserver.observe(firstItem);
    viewport.addEventListener("scroll", scheduleSync, { passive: true });
    measureRailLayout();
    scheduleSync();

    return () => {
      viewport.removeEventListener("scroll", scheduleSync);
      resizeObserver.disconnect();
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [items.length, measureRailLayout, scheduleSync]);

  function scroll(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport || !items.length) return;

    const { itemStep, visibleCount } = railLayoutRef.current;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    viewport.scrollBy({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      left: direction * itemStep * visibleCount
    });
  }

  const visibleStart = items.length ? state.firstVisible + 1 : 0;
  const visibleEnd = Math.min(items.length, state.firstVisible + state.visibleCount);

  return (
    <div
      className="home-product-rail"
      data-can-scroll-next={state.canScrollNext ? "true" : "false"}
      data-can-scroll-previous={state.canScrollPrevious ? "true" : "false"}
    >
      <button
        aria-label={`Previous ${label}`}
        className="home-product-rail__control home-product-rail__control--previous"
        disabled={!state.canScrollPrevious}
        onClick={() => scroll(-1)}
        type="button"
      >
        <ChevronLeft aria-hidden="true" />
      </button>

      <div
        aria-label={label}
        className="home-product-rail__viewport"
        ref={viewportRef}
        role="region"
      >
        <div className="home-product-rail__track">
          {items.map((item, index) => (
            <div className="home-product-rail__item" data-home-product-rail-item key={index}>
              {item}
            </div>
          ))}
        </div>
      </div>

      <button
        aria-label={`Next ${label}`}
        className="home-product-rail__control home-product-rail__control--next"
        disabled={!state.canScrollNext}
        onClick={() => scroll(1)}
        type="button"
      >
        <ChevronRight aria-hidden="true" />
      </button>

      <span aria-live="polite" className="home-product-rail__status">
        {items.length
          ? `Showing products ${visibleStart} to ${visibleEnd} of ${items.length}.`
          : ""}
      </span>
    </div>
  );
}
