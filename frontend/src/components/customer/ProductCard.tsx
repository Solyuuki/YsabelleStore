import { ShoppingBasket } from "lucide-react";
import { useState } from "react";

import { useCart } from "@/context/CartContext";
import type { StorefrontProduct } from "@/types/storefront";
import {
  getStorefrontProductBadge,
  type StorefrontProductBadge
} from "@/utils/storefrontMerchandising";
import { CustomerLink } from "./CustomerLink";
import { ProductVisual } from "./ProductVisual";
import { QuantityControl } from "./QuantityControl";

export function ProductCard({
  product,
  navigate,
  badge,
  tourTarget = false
}: {
  badge?: StorefrontProductBadge | null;
  product: StorefrontProduct;
  navigate: (path: string) => void;
  tourTarget?: boolean;
}) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const outOfStock = product.availableStock <= 0;
  const resolvedBadge = badge === undefined ? getStorefrontProductBadge(product) : badge;

  return (
    <article className="customer-product-card" data-tour={tourTarget ? "product" : undefined}>
      <CustomerLink
        aria-label={`View ${product.name}`}
        className="customer-product-card__visual-link"
        href={`/product/${product.id}`}
        navigate={navigate}
      >
        <ProductVisual
          category={product.category.name}
          imageUrl={product.imageUrl}
          name={product.name}
        />
        {resolvedBadge ? (
          <span className={`customer-product-badge customer-product-badge--${resolvedBadge.tone}`}>
            {resolvedBadge.label}
          </span>
        ) : null}
      </CustomerLink>
      <div className="customer-product-card__body">
        <p className="customer-eyebrow">{product.category.name}</p>
        <CustomerLink href={`/product/${product.id}`} navigate={navigate}>
          <h3>{product.name}</h3>
        </CustomerLink>
        <div className="customer-product-card__price-row">
          <strong>{formatCurrency(product.sellingPrice)}</strong>
          <span>per {formatUnit(product.unit)}</span>
        </div>
        <p className={`customer-stock customer-stock--${product.stockStatus.toLowerCase()}`}>
          {outOfStock
            ? "Out of stock"
            : product.stockStatus === "LOW_STOCK"
              ? `Only ${product.availableStock} left`
              : "In stock"}
        </p>
        <div className="customer-product-card__actions">
          {!outOfStock ? (
            <QuantityControl
              label={`Quantity for ${product.name}`}
              max={product.availableStock}
              onChange={setQuantity}
              value={quantity}
            />
          ) : null}
          <button
            className="customer-button customer-button--compact"
            data-tour={tourTarget ? "add-to-cart" : undefined}
            disabled={outOfStock}
            onClick={() => addItem(product, quantity)}
            type="button"
          >
            <ShoppingBasket aria-hidden="true" size={17} />
            {outOfStock ? "Unavailable" : "Add"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(value)
  );
}

export function formatUnit(unit: string) {
  return unit.toLowerCase().replaceAll("_", " ");
}
