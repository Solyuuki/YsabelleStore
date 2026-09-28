import { useLayoutEffect, useRef, useState } from "react";

const PRODUCT_TITLE_DENSITIES = [
  "display",
  "balanced",
  "compact",
  "dense",
  "minimum"
] as const;

type ProductTitleDensity = (typeof PRODUCT_TITLE_DENSITIES)[number];

const DESKTOP_MAX_LINES = 3;
const MOBILE_MAX_LINES = 4;
const DESKTOP_MAX_BLOCK_HEIGHT = 236;
const MOBILE_MAX_BLOCK_HEIGHT = 196;

function titleLineCount(element: HTMLHeadingElement) {
  const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
  if (!Number.isFinite(lineHeight) || lineHeight <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(1, Math.ceil((element.getBoundingClientRect().height - 0.5) / lineHeight));
}

export function AdaptiveProductTitle({ name }: { name: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [density, setDensity] = useState<ProductTitleDensity>("display");

  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title) return;

    const container = title.parentElement ?? title;
    let active = true;
    let observedWidth = container.getBoundingClientRect().width;

    const fitTitle = () => {
      if (!active) return;

      const mobile = window.matchMedia("(max-width: 700px)").matches;
      const maxLines = mobile ? MOBILE_MAX_LINES : DESKTOP_MAX_LINES;
      const maxBlockHeight = mobile ? MOBILE_MAX_BLOCK_HEIGHT : DESKTOP_MAX_BLOCK_HEIGHT;
      let selected: ProductTitleDensity = "minimum";

      for (const candidate of PRODUCT_TITLE_DENSITIES) {
        title.dataset.titleDensity = candidate;
        const blockHeight = title.getBoundingClientRect().height;
        if (titleLineCount(title) <= maxLines && blockHeight <= maxBlockHeight) {
          selected = candidate;
          break;
        }
      }

      title.dataset.titleDensity = selected;
      setDensity((current) => (current === selected ? current : selected));
    };

    fitTitle();

    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = entry?.contentRect.width ?? container.getBoundingClientRect().width;
      if (Math.abs(nextWidth - observedWidth) < 0.5) return;
      observedWidth = nextWidth;
      fitTitle();
    });
    observer.observe(container);

    void document.fonts.ready.then(() => {
      if (active) fitTitle();
    });

    return () => {
      active = false;
      observer.disconnect();
    };
  }, [name]);

  return (
    <h1
      className="customer-product-detail__title"
      data-title-density={density}
      ref={titleRef}
    >
      {name}
    </h1>
  );
}
