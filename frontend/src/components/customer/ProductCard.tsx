import { CircleAlert, Flame, Heart, ShoppingCart, Star } from "lucide-react";

import { useState } from "react";

import { useCart } from "@/context/CartContext";
import { useCustomerFavorites } from "@/context/CustomerFavoritesContext";
import type { StorefrontProduct } from "@/types/storefront";
import { buildCustomerAuthPath } from "@/utils/customerRoutes";
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
  presentation = "catalog",
  tourTarget = false
}: {
  badge?: StorefrontProductBadge | null;
  product: StorefrontProduct;
  navigate: (path: string) => void;
  presentation?: "catalog" | "editorial";
  tourTarget?: boolean;
}) {
  const { addItem, isReady } = useCart();
  const { favoriteIds, toggleFavorite } = useCustomerFavorites();
  const outOfStock = product.availableStock <= 0;
  const isFavorite = favoriteIds.has(product.id);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const resolvedBadge = badge === undefined ? getStorefrontProductBadge(product) : badge;
  const showStockMessage =
    outOfStock || (product.stockStatus === "LOW_STOCK" && resolvedBadge?.tone !== "low-stock");
  const hasReviewSummary =
    Number.isFinite(product.averageRating) &&
    Number.isInteger(product.reviewCount) &&
    product.reviewCount >= 0 &&
    ((product.reviewCount === 0 && product.averageRating === 0) ||
      (product.reviewCount > 0 && product.averageRating > 0 && product.averageRating <= 5));
  const hasReviews = hasReviewSummary && product.reviewCount > 0;
  const formattedRating = hasReviewSummary ? product.averageRating.toFixed(1) : "";
  const ratingLabel = hasReviews
    ? `Rated ${formattedRating} out of 5 from ${product.reviewCount} ${product.reviewCount === 1 ? "review" : "reviews"}.`
    : "No reviews yet.";

  async function handleFavorite() {
    const result = await toggleFavorite(product.id);
    if (result === "auth-required") {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(buildCustomerAuthPath("/login", returnTo));
    }
  }

  function handleAddToCart() {
    addItem(product, selectedQuantity);
  }

  function handleQuantityChange(nextQuantity: number) {
    setSelectedQuantity(Math.min(product.availableStock, Math.max(1, nextQuantity)));
  }

  return (
    <article
      className={`customer-product-card customer-product-card--${presentation}`}
      data-stock={product.stockStatus.toLowerCase()}
      data-tour={tourTarget ? "product" : undefined}
    >
      <div className="customer-product-card__media">
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
            showCategory={false}
          />
          {resolvedBadge ? (
            <span
              className={`customer-product-badge customer-product-badge--${resolvedBadge.tone}`}
            >
              {resolvedBadge.tone === "trending" ? (
                <span aria-hidden="true" className="customer-product-badge__fire">
                  <Flame
                    className="customer-product-badge__fire-outer"
                    fill="currentColor"
                  />
                  <Flame
                    className="customer-product-badge__fire-inner"
                    fill="currentColor"
                  />
                </span>
              ) : resolvedBadge.tone === "best-seller" ? (
                <span aria-hidden="true" className="customer-product-badge__medal">
                  <span className="customer-product-badge__medal-center" />
                </span>
              ) : (
                <CircleAlert aria-hidden="true" className="customer-product-badge__icon" />
              )}
              <span>{resolvedBadge.label}</span>
            </span>
          ) : null}
        </CustomerLink>
        <button
          aria-label={
            isFavorite
              ? `Remove ${product.name} from favorites`
              : `Save ${product.name} to favorites`
          }
          aria-pressed={isFavorite}
          className="customer-product-card__favorite"
          data-tooltip={isFavorite ? "Remove from favorites" : "Save to favorites"}
          onClick={() => void handleFavorite()}
          type="button"
        >
          <Heart aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="customer-product-card__body">
        <p className="customer-eyebrow">{product.category.name}</p>
        <CustomerLink href={`/product/${product.id}`} navigate={navigate}>
          <h3>{product.name}</h3>
        </CustomerLink>

        <div
          aria-label={ratingLabel}
          className={`customer-product-card__rating ${hasReviews ? "" : "is-empty"}`.trim()}
          role="img"
        >
          <Star aria-hidden="true" fill={hasReviews ? "currentColor" : "none"} />
          {hasReviews ? <strong>{formattedRating}</strong> : null}
          <span>
            {hasReviews
              ? `(${product.reviewCount} ${product.reviewCount === 1 ? "review" : "reviews"})`
              : "No reviews yet"}
          </span>
        </div>

        <div className="customer-product-card__price-row">
          <strong>{formatCurrency(product.sellingPrice)}</strong>
          <span>per {formatUnit(product.unit)}</span>
        </div>

        {showStockMessage ? (
          <p className={`customer-stock customer-stock--${product.stockStatus.toLowerCase()}`}>
            <span aria-hidden="true" className="customer-stock__dot" />
            {outOfStock ? "Out of stock" : `Only ${product.availableStock} left`}
          </p>
        ) : null}

        <div className="customer-product-card__actions">
          {!outOfStock ? (
            <div className="customer-product-card__purchase-row">
              <QuantityControl
                label={`Quantity for ${product.name}`}
                max={product.availableStock}
                min={1}
                onChange={handleQuantityChange}
                value={selectedQuantity}
              />
              <button
                className="customer-button customer-button--compact customer-product-card__cart-button"
                data-tour={tourTarget ? "add-to-cart" : undefined}
                disabled={!isReady}
                onClick={handleAddToCart}
                type="button"
              >
                <ShoppingCart aria-hidden="true" size={17} strokeWidth={2} />
                {isReady ? "Add to cart" : "Cart loading"}
              </button>
            </div>
          ) : (
            <button
              className="customer-button customer-button--compact customer-product-card__cart-button"
              disabled
              type="button"
            >
              <CircleAlert aria-hidden="true" size={17} />
              Out of stock
            </button>
          )}
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
