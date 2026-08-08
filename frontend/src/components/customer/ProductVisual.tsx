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
  name,
  large = false
}: {
  category: string;
  name: string;
  large?: boolean;
}) {
  const Icon = icons[hash(category) % icons.length] ?? Package;

  return (
    <div
      aria-label={`${name} product image placeholder`}
      className={`customer-product-visual ${large ? "customer-product-visual--large" : ""}`}
      role="img"
    >
      <span className="customer-product-visual__halo" />
      <Icon aria-hidden="true" />
      <span>{category}</span>
    </div>
  );
}
