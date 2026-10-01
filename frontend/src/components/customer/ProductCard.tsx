import { CircleAlert, Heart, ShoppingBasket, Star } from "lucide-react";

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
  const { addItem, isReady, items, updateQuantity } = useCart();
  const { favoriteIds, toggleFavorite } = useCustomerFavorites();
  const outOfStock = product.availableStock <= 0;
  const isFavorite = favoriteIds.has(product.id);
  const cartQuantity = items.find((item) => item.product.id === product.id)?.quantity ?? 0;
  const resolvedBadge = badge === undefined ? getStorefrontProductBadge(product) : badge;
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
    addItem(product, 1);
  }

  function handleQuantityChange(nextQuantity: number) {
    updateQuantity(product.id, nextQuantity);
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
              {resolvedBadge.label}
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

        {hasReviews ? (
          <div aria-label={ratingLabel} className="customer-product-card__rating" role="img">
            <Star aria-hidden="true" fill="currentColor" />
            <strong>{formattedRating}</strong>
            <span>
              · {product.reviewCount} {product.reviewCount === 1 ? "review" : "reviews"}
            </span>
          </div>
        ) : null}

        <div className="customer-product-card__price-row">
          <strong>{formatCurrency(product.sellingPrice)}</strong>
          <span>per {formatUnit(product.unit)}</span>
        </div>

        {product.stockStatus !== "IN_STOCK" ? (
          <p className={`customer-stock customer-stock--${product.stockStatus.toLowerCase()}`}>
            <span aria-hidden="true" className="customer-stock__dot" />
            {outOfStock ? "Out of stock" : `Only ${product.availableStock} left`}
          </p>
        ) : null}

        <div className="customer-product-card__actions">
          {!outOfStock && cartQuantity > 0 ? (
            <QuantityControl
              label={`Quantity for ${product.name}`}
              max={product.availableStock}
              min={0}
              onChange={handleQuantityChange}
              value={cartQuantity}
            />
          ) : (
            <button
              className="customer-button customer-button--compact"
              data-tour={tourTarget ? "add-to-cart" : undefined}
              disabled={outOfStock || !isReady}
              onClick={handleAddToCart}
              type="button"
            >
              {outOfStock ? (
                <CircleAlert aria-hidden="true" size={17} />
              ) : (
                <ShoppingBasket aria-hidden="true" size={17} />
              )}
              {outOfStock ? "Out of stock" : isReady ? "Add to cart" : "Cart loading"}
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
