import { Check } from "lucide-react";

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
  if (variants.length < 2) return null;

  const selected = variants.find((variant) => variant.id === currentProductId) ?? null;

  return (
    <fieldset className="customer-product-size-selector">
      <legend className="customer-product-size-selector__legend">
        <span>Size</span>
        <strong>{selected ? formatProductSize(selected) : "Available sizes"}</strong>
      </legend>

      <div className="customer-product-size-selector__options">
        {variants.map((variant) => {
          const isSelected = variant.id === currentProductId;
          const label = formatProductSize(variant);

          return (
            <label
              className="customer-product-size-option"
              data-selected={isSelected || undefined}
              key={variant.id}
              title={variant.name}
            >
              <input
                aria-label={`Select ${label}`}
                checked={isSelected}
                className="customer-product-size-option__input"
                name={`product-size-${currentProductId}`}
                onChange={() => {
                  if (!isSelected) navigate(`/product/${variant.id}`);
                }}
                type="radio"
                value={variant.id}
              />
              <span className="customer-product-size-option__visual">
                <ProductImage
                  alt={variant.name}
                  className="customer-product-size-option__image"
                  imageUrl={variant.imageUrl}
                />
              </span>
              <span className="customer-product-size-option__label">{label}</span>
              {isSelected ? (
                <span aria-hidden="true" className="customer-product-size-option__check">
                  <Check />
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
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
