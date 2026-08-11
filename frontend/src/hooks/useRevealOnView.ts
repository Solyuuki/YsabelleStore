import { useEffect, useRef, useState, type RefObject } from "react";

type RevealOptions = {
  rootMargin?: string;
  threshold?: number;
};

type RevealResult<T extends Element> = {
  isVisible: boolean;
  ref: RefObject<T | null>;
};

/**
 * Reveals content once when it enters the viewport. Content remains usable
 * before observation and immediately falls back to visible when observers are
 * unavailable (for example, in a constrained WebView or test environment).
 */
export function useRevealOnView<T extends Element>({
  rootMargin = "0px 0px -10% 0px",
  threshold = 0.12
}: RevealOptions = {}): RevealResult<T> {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsVisible(true);
        observer.unobserve(entry.target);
      },
      { rootMargin, threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, threshold]);

  return { isVisible, ref };
}
