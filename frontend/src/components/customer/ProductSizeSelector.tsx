import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProductImage } from "@/components/customer/ProductImage";
import type { StorefrontSizeVariant } from "@/types/storefront";

export function ProductSizeSelector({
  currentProductId,
  navigate,
  variants
}: {
  currentProductId: string;
  navigate: (path: string) => void;
  variants: StorefrontSizeVariant[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateRailState = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const overflow = rail.scrollWidth > rail.clientWidth + 2;
    setHasOverflow(overflow);
    setCanScrollLeft(overflow && rail.scrollLeft > 2);
    setCanScrollRight(
      overflow && rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2
    );
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    updateRailState();
    const observer = new ResizeObserver(updateRailState);
    observer.observe(rail);
    rail.addEventListener("scroll", updateRailState, { passive: true });
    window.addEventListener("resize", updateRailState);

    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", updateRailState);
      window.removeEventListener("resize", updateRailState);
    };
  }, [updateRailState, variants.length]);

  useEffect(() => {
    const selected = railRef.current?.querySelector<HTMLElement>("[data-selected]");
    selected?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [currentProductId]);

  if (variants.length < 2) return null;

  const selected = variants.find((variant) => variant.id === currentProductId) ?? null;

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(180, rail.clientWidth * 0.72)
    });
  }

  return (
    <fieldset className="customer-product-size-selector">
      <legend className="customer-product-size-selector__legend">
        <span>Pack size</span>
        <strong>{selected ? formatProductSize(selected) : "Available sizes"}</strong>
      </legend>

      <div className="customer-product-size-selector__rail-shell">
        {hasOverflow ? (
          <button
            aria-label="Show previous sizes"
            className="customer-product-size-selector__arrow customer-product-size-selector__arrow--previous"
            disabled={!canScrollLeft}
            onClick={() => scroll(-1)}
            type="button"
          >
            <ChevronLeft aria-hidden="true" />
          </button>
        ) : null}

        <div
          aria-label="Available pack sizes"
          className="customer-product-size-selector__options"
          ref={railRef}
        >
          {variants.map((variant) => {
            const isSelected = variant.id === currentProductId;
            const soldOut = variant.availableStock <= 0;
            const label = formatProductSize(variant);
            const meta = variant.sizeTier
              ? formatSizeTier(variant.sizeTier)
              : variant.packagingLabel;

            return (
              <label
                className="customer-product-size-option"
                data-selected={isSelected || undefined}
                data-sold-out={soldOut || undefined}
                key={variant.id}
                title={variant.name}
              >
                <input
                  aria-label={`Select ${label}${soldOut ? ", sold out" : ""}`}
                  checked={isSelected}
                  className="customer-product-size-option__input"
                  disabled={soldOut && !isSelected}
                  name={`product-size-${currentProductId}`}
                  onChange={() => {
                    if (!isSelected && !soldOut) navigate(`/product/${variant.id}`);
                  }}
                  type="radio"
                  value={variant.id}
                />
                <span className="customer-product-size-option__visual">
                  <ProductImage
                    alt=""
                    className="customer-product-size-option__image"
                    imageUrl={variant.imageUrl}
                  />
                </span>
                <span className="customer-product-size-option__copy">
                  <strong>{label}</strong>
                  <small>{soldOut ? "Sold out" : meta}</small>
                </span>
                {isSelected ? (
                  <span aria-hidden="true" className="customer-product-size-option__check">
                    <Check />
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>

        {hasOverflow ? (
          <button
            aria-label="Show more sizes"
            className="customer-product-size-selector__arrow customer-product-size-selector__arrow--next"
            disabled={!canScrollRight}
            onClick={() => scroll(1)}
            type="button"
          >
            <ChevronRight aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </fieldset>
  );
}

function formatSizeTier(tier: NonNullable<StorefrontSizeVariant["sizeTier"]>) {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}

export function formatProductSize(variant: Pick<StorefrontSizeVariant, "sizeUnit" | "sizeValue">) {
  const numericValue = Number(variant.sizeValue);
  const value = Number.isFinite(numericValue)
    ? new Intl.NumberFormat("en-PH", { maximumFractionDigits: 3 }).format(numericValue)
    : variant.sizeValue;

  switch (variant.sizeUnit) {
    case "MILLILITER":
      return `${value} mL`;
    case "LITER":
      return `${value} L`;
    case "GRAM":
      return `${value} g`;
    case "KILOGRAM":
      return `${value} kg`;
    case "PIECE":
      return `${value} ${numericValue === 1 ? "pc" : "pcs"}`;
  }
}
