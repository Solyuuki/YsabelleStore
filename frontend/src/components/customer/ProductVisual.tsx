import {
  Baby,
  Cookie,
  CookingPot,
  CupSoda,
  Milk,
  Package,
  PawPrint,
  Snowflake,
  Sparkles,
  SprayCan,
  Soup,
  Utensils,
  Wheat
} from "lucide-react";
import { useEffect, useState } from "react";

const icons = [
  CupSoda,
  Cookie,
  Soup,
  Wheat,
  CookingPot,
  Milk,
  Snowflake,
  Sparkles,
  SprayCan,
  Utensils,
  Baby,
  PawPrint
];

function hash(value: string) {
  return [...value].reduce((total, character) => total + character.charCodeAt(0), 0);
}

export function ProductVisual({
  category,
  imageUrl,
  name,
  large = false
}: {
  category: string;
  imageUrl?: string | null;
  name: string;
  large?: boolean;
}) {
  const productHash = hash(`${category}-${name}`);
  const Icon = icons[productHash % icons.length] ?? Package;
  const [imageAvailable, setImageAvailable] = useState(Boolean(imageUrl));

  useEffect(() => setImageAvailable(Boolean(imageUrl)), [imageUrl]);

  return (
    <div
      aria-label={imageAvailable ? `${name} product image` : `Illustrated package for ${name}`}
      className={`customer-product-visual ${large ? "customer-product-visual--large" : ""}`}
      data-product-variant={(productHash % 4) + 1}
      role="img"
    >
      <span className="customer-product-visual__halo" />
      {imageAvailable && imageUrl ? (
        <img
          alt=""
          decoding="async"
          loading="lazy"
          onError={() => setImageAvailable(false)}
          src={imageUrl}
        />
      ) : (
        <span aria-hidden="true" className="customer-product-visual__package">
          <small>Ysabelle&apos;s</small>
          <Icon />
          <strong>{name}</strong>
        </span>
      )}
      <span className="customer-product-visual__category">{category}</span>
    </div>
  );
}
