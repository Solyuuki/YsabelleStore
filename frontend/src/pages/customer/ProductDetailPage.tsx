import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  ShoppingBasket,
  Star
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { ProductCard, formatCurrency, formatUnit } from "@/components/customer/ProductCard";
import { ProductSizeSelector } from "@/components/customer/ProductSizeSelector";
import { ProductVisual } from "@/components/customer/ProductVisual";
import { QuantityControl } from "@/components/customer/QuantityControl";
import { useCart } from "@/context/CartContext";
import { useRevealOnView } from "@/hooks/useRevealOnView";
import {
  fetchStorefrontProduct,
  fetchStorefrontProductReviews,
  fetchStorefrontRelatedProducts
} from "@/services/storefrontService";
import type {
  StorefrontProduct,
  StorefrontProductDetail,
  StorefrontProductReviews,
  StorefrontRelatedProducts
} from "@/types/storefront";

type Resource<T> = {
  data: T | null;
  error: string;
  status: "error" | "loading" | "success";
};

const reviewFilters = [null, 5, 4, 3, 2, 1] as const;

export function ProductDetailPage({
  productId,
  navigate
}: {
  productId: string;
  navigate: (path: string) => void;
}) {
  const { addItem } = useCart();
  const [product, setProduct] = useState<StorefrontProductDetail | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewReload, setReviewReload] = useState(0);
  const [relatedReload, setRelatedReload] = useState(0);
  const [reviewResource, setReviewResource] = useState<Resource<StorefrontProductReviews>>({
    data: null,
    error: "",
    status: "loading"
  });
  const [relatedResource, setRelatedResource] = useState<Resource<StorefrontRelatedProducts>>({
    data: null,
    error: "",
    status: "loading"
  });

  useEffect(() => {
    const controller = new AbortController();
    setProduct(null);
    setError("");
    setQuantity(1);
    setRatingFilter(null);
    setReviewPage(1);
    setReviewResource({ data: null, error: "", status: "loading" });
    fetchStorefrontProduct(productId, controller.signal)
      .then(setProduct)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Product could not be loaded.");
      });
    return () => controller.abort();
  }, [productId]);

  useEffect(() => {
    const controller = new AbortController();
    setReviewResource((current) => ({ ...current, error: "", status: "loading" }));
    fetchStorefrontProductReviews(
      productId,
      { page: reviewPage, pageSize: 10, ...(ratingFilter ? { rating: ratingFilter } : {}) },
      controller.signal
    )
      .then((data) => setReviewResource({ data, error: "", status: "success" }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setReviewResource({
            data: null,
            error: reason instanceof Error ? reason.message : "Reviews could not be loaded.",
            status: "error"
          });
        }
      });
    return () => controller.abort();
  }, [productId, ratingFilter, reviewPage, reviewReload]);

  useEffect(() => {
    const controller = new AbortController();
    setRelatedResource({ data: null, error: "", status: "loading" });
    fetchStorefrontRelatedProducts(productId, 4, controller.signal)
      .then((data) => setRelatedResource({ data, error: "", status: "success" }))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setRelatedResource({
            data: null,
            error:
              reason instanceof Error ? reason.message : "Related products could not be loaded.",
            status: "error"
          });
        }
      });
    return () => controller.abort();
  }, [productId, relatedReload]);

  if (error) {
    const productMissing = /(?:not found|404)/i.test(error);

    return (
      <div className="customer-page customer-container customer-product-error-page">
        <section
          aria-labelledby="product-load-error-title"
          className="customer-product-error-state"
          role="status"
        >
          <div aria-hidden="true" className="customer-product-error-state__icon">
            <RefreshCw size={24} />
          </div>

          <p className="customer-product-error-state__eyebrow">
            {productMissing ? "Product status" : "Store connection"}
          </p>
          <h1 id="product-load-error-title">
            {productMissing ? "This product isn’t available" : "We couldn’t load this product"}
          </h1>
          <p className="customer-product-error-state__description">
            {productMissing
              ? "It may have been removed from the storefront or is no longer available."
              : "The store connection is temporarily unavailable. Please try again in a moment."}
          </p>

          <div className="customer-product-error-state__actions">
            <button
              className="customer-button"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={18} />
              Try again
            </button>
            <CustomerLink
              className="customer-button customer-button--secondary"
              href="/shop"
              navigate={navigate}
            >
              <ArrowLeft aria-hidden="true" size={18} />
              Back to shop
            </CustomerLink>
          </div>
        </section>
      </div>
    );
  }
  if (!product)
    return (
      <div className="customer-page customer-container">
        <div className="customer-inline-state">Loading product...</div>
      </div>
    );
  const outOfStock = product.availableStock <= 0;

  return (
    <div className="customer-page customer-product-page">
      <div className="customer-container">
        <CustomerLink
          className="customer-back-link"
          href={`/shop/category/${product.category.slug}`}
          navigate={navigate}
        >
          <ArrowLeft aria-hidden="true" size={17} /> Back to {product.category.name}
        </CustomerLink>
        <section className="customer-product-detail">
          <div className="customer-product-detail__media">
            <ProductVisual
              category={product.category.name}
              imageUrl={product.detailImageUrl ?? product.imageUrl}
              large
              name={product.name}
            />
            <ProductSizeSelector
              currentProductId={product.id}
              navigate={navigate}
              variants={product.sizeVariants}
            />
          </div>
          <div className="customer-product-detail__copy">
            <p className="customer-kicker">{product.category.name}</p>
            <h1>{product.name}</h1>
            <p className="customer-product-detail__description">
              {product.description || "An everyday essential from Ysabelle's Store."}
            </p>
            <div className="customer-product-detail__price">
              <strong>{formatCurrency(product.sellingPrice)}</strong>
              <span>per {formatUnit(product.unit)}</span>
            </div>
            <p className={`customer-stock customer-stock--${product.stockStatus.toLowerCase()}`}>
              {outOfStock
                ? "Currently out of stock"
                : product.stockStatus === "LOW_STOCK"
                  ? `Only ${product.availableStock} left in stock`
                  : `${product.availableStock} available`}
            </p>
            {!outOfStock ? (
              <div className="customer-product-detail__buy">
                <QuantityControl
                  label={`Quantity for ${product.name}`}
                  max={product.availableStock}
                  onChange={setQuantity}
                  value={quantity}
                />
                <button
                  className="customer-button"
                  onClick={() => addItem(product, quantity)}
                  type="button"
                >
                  <ShoppingBasket aria-hidden="true" size={19} /> Add to cart
                </button>
              </div>
            ) : null}
            <div className="customer-product-detail__notes">
              <span>
                <CheckCircle2 aria-hidden="true" size={18} /> Price and stock checked from the store
                catalog
              </span>
              <span>
                <MapPin aria-hidden="true" size={18} /> Pickup at 110 A. Mabini Street, Pasig City
              </span>
            </div>
          </div>
        </section>

        <ReviewsSection
          onFilterChange={(rating) => {
            setRatingFilter(rating);
            setReviewPage(1);
          }}
          onPageChange={setReviewPage}
          onRetry={() => setReviewReload((value) => value + 1)}
          page={reviewPage}
          ratingFilter={ratingFilter}
          resource={reviewResource}
        />

        <RelatedProductsSection
          navigate={navigate}
          onRetry={() => setRelatedReload((value) => value + 1)}
          productCategory={product.category}
          resource={relatedResource}
        />
      </div>
    </div>
  );
}

function ReviewsSection({
  onFilterChange,
  onPageChange,
  onRetry,
  page,
  ratingFilter,
  resource
}: {
  onFilterChange: (rating: number | null) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  page: number;
  ratingFilter: number | null;
  resource: Resource<StorefrontProductReviews>;
}) {
  const summary = resource.data?.summary;

  return (
    <section
      aria-busy={resource.status === "loading"}
      aria-labelledby="product-reviews-heading"
      className="customer-product-reviews"
    >
      <ProductDetailReveal className="product-detail-reveal--heading">
        <header className="customer-product-section-heading">
          <div>
            <p className="customer-kicker">Customer feedback</p>
            <h2 id="product-reviews-heading">Ratings &amp; Reviews</h2>
          </div>
          <span className="customer-product-section-heading__icon" aria-hidden="true">
            <MessageSquareText />
          </span>
        </header>
      </ProductDetailReveal>

      {resource.status === "loading" && !resource.data ? (
        <div aria-live="polite" className="customer-product-section-state">
          Loading ratings and reviews...
        </div>
      ) : null}
      {resource.status === "error" ? (
        <div className="customer-product-section-state customer-product-section-state--error">
          <div>
            <strong>Ratings and reviews could not be loaded.</strong>
            <p>{resource.error}</p>
          </div>
          <button
            className="customer-button customer-button--compact"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}
      {resource.data && summary ? (
        <>
          <ProductDetailReveal className="product-detail-reveal--summary">
            <div className="customer-review-overview">
              <div className="customer-review-score">
                <strong>
                  {summary.averageRating === null ? "—" : summary.averageRating.toFixed(1)}
                </strong>
                <span>/ 5</span>
                <RatingStars rating={summary.averageRating ?? 0} />
                <p>
                  {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}
                </p>
              </div>
              <div className="customer-review-distribution" aria-label="Rating distribution">
                {summary.distribution.map((entry) => (
                  <div className="customer-review-distribution__row" key={entry.rating}>
                    <span>
                      {entry.rating} <Star aria-hidden="true" fill="currentColor" size={13} />
                    </span>
                    <progress
                      aria-label={`${entry.rating} star reviews: ${entry.percentage}%`}
                      max="100"
                      value={entry.percentage}
                    />
                    <small>{entry.count}</small>
                  </div>
                ))}
              </div>
            </div>
          </ProductDetailReveal>

          <ProductDetailReveal className="product-detail-reveal--controls">
            <div
              aria-label="Filter customer reviews"
              className="customer-review-filters"
              role="group"
            >
              {reviewFilters.map((rating) => {
                const count =
                  rating === null
                    ? summary.totalReviews
                    : (summary.distribution.find((entry) => entry.rating === rating)?.count ?? 0);
                return (
                  <button
                    aria-pressed={ratingFilter === rating}
                    className={ratingFilter === rating ? "is-active" : ""}
                    key={rating ?? "all"}
                    onClick={() => onFilterChange(rating)}
                    type="button"
                  >
                    {rating === null ? "All" : `${rating} Star`} <span>{count}</span>
                  </button>
                );
              })}
            </div>
          </ProductDetailReveal>

          {resource.data.reviews.length ? (
            <ProductDetailReveal className="customer-review-list" stagger>
              {resource.data.reviews.map((review) => (
                <article className="customer-review" key={review.id}>
                  <header>
                    <span className="customer-review__avatar" aria-hidden="true">
                      {review.reviewerDisplayName.trim().charAt(0).toUpperCase() || "C"}
                    </span>
                    <div>
                      <strong>{review.reviewerDisplayName}</strong>
                      <time dateTime={review.createdAt}>{formatReviewDate(review.createdAt)}</time>
                    </div>
                    <RatingStars rating={review.rating} />
                  </header>
                  <p>{review.comment}</p>
                </article>
              ))}
            </ProductDetailReveal>
          ) : (
            <ProductDetailReveal className="customer-review-empty">
              <MessageSquareText aria-hidden="true" />
              <strong>
                {summary.totalReviews === 0
                  ? "No reviews yet."
                  : `No ${ratingFilter}-star reviews yet.`}
              </strong>
              <p>
                {summary.totalReviews === 0
                  ? "Customer feedback will appear here when verified review data is available."
                  : "Choose another rating to read more customer feedback."}
              </p>
            </ProductDetailReveal>
          )}

          {resource.data.meta.totalPages > 1 ? (
            <nav aria-label="Review pages" className="customer-review-pagination">
              <button
                aria-label="Previous review page"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" /> Previous
              </button>
              <span>
                Page {page} of {resource.data.meta.totalPages}
              </span>
              <button
                aria-label="Next review page"
                disabled={page >= resource.data.meta.totalPages}
                onClick={() => onPageChange(page + 1)}
                type="button"
              >
                Next <ChevronRight aria-hidden="true" />
              </button>
            </nav>
          ) : null}

          <p className="customer-review-policy-note">
            <ShieldCheck aria-hidden="true" /> Review posting is unavailable until completed
            customer purchases can be securely verified.
          </p>
        </>
      ) : null}
    </section>
  );
}

function RelatedProductsSection({
  navigate,
  onRetry,
  productCategory,
  resource
}: {
  navigate: (path: string) => void;
  onRetry: () => void;
  productCategory: StorefrontProduct["category"];
  resource: Resource<StorefrontRelatedProducts>;
}) {
  const sameCategory = resource.data?.sameCategory ?? [];
  const hasProducts = sameCategory.length > 0;

  return (
    <section aria-labelledby="related-products-heading" className="customer-related-products">
      <ProductDetailReveal className="product-detail-reveal--heading">
        <header className="customer-product-section-heading customer-product-section-heading--related">
          <div>
            <p className="customer-kicker">Keep browsing</p>
            <h2 id="related-products-heading">More from {productCategory.name}</h2>
          </div>
          <CustomerLink
            className="customer-related-products__link"
            href={`/shop/category/${productCategory.slug}`}
            navigate={navigate}
          >
            View all {productCategory.name} <ChevronRight aria-hidden="true" size={17} />
          </CustomerLink>
        </header>
      </ProductDetailReveal>

      {resource.status === "loading" ? (
        <div aria-live="polite" className="customer-related-products__loading">
          <span>Loading related products...</span>
          <div className="customer-related-products__skeleton-grid" aria-hidden="true">
            {Array.from({ length: 4 }, (_, index) => (
              <i key={index} />
            ))}
          </div>
        </div>
      ) : null}
      {resource.status === "error" ? (
        <div className="customer-product-section-state customer-product-section-state--error">
          <div>
            <strong>Related products could not be loaded.</strong>
            <p>{resource.error}</p>
          </div>
          <button
            className="customer-button customer-button--compact"
            onClick={onRetry}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : null}
      {resource.status === "success" && hasProducts ? (
        <RelatedProductsRail navigate={navigate} products={sameCategory} />
      ) : null}
      {resource.status === "success" && !hasProducts ? (
        <div className="customer-product-section-state">
          <strong>No more products are available in this category right now.</strong>
          <p>Use “View all {productCategory.name}” to return to the full category.</p>
        </div>
      ) : null}
    </section>
  );
}

function RelatedProductsRail({
  navigate,
  products
}: {
  navigate: (path: string) => void;
  products: StorefrontProduct[];
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateState = useCallback(() => {
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

    updateState();
    const observer = new ResizeObserver(updateState);
    observer.observe(rail);
    rail.addEventListener("scroll", updateState, { passive: true });
    window.addEventListener("resize", updateState);
    return () => {
      observer.disconnect();
      rail.removeEventListener("scroll", updateState);
      window.removeEventListener("resize", updateState);
    };
  }, [products.length, updateState]);

  function scroll(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(280, rail.clientWidth * 0.82)
    });
  }

  return (
    <ProductDetailReveal className="customer-related-products__rail-shell">
      {hasOverflow ? (
        <button
          aria-label="Previous related products"
          className="customer-related-products__arrow customer-related-products__arrow--previous"
          disabled={!canScrollLeft}
          onClick={() => scroll(-1)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      ) : null}

      <div className="customer-related-products__viewport" ref={railRef}>
        {products.map((relatedProduct) => (
          <ProductCard key={relatedProduct.id} navigate={navigate} product={relatedProduct} />
        ))}
      </div>

      {hasOverflow ? (
        <button
          aria-label="Next related products"
          className="customer-related-products__arrow customer-related-products__arrow--next"
          disabled={!canScrollRight}
          onClick={() => scroll(1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      ) : null}
    </ProductDetailReveal>
  );
}

function ProductDetailReveal({
  children,
  className = "",
  stagger = false
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
}) {
  const reveal = useRevealOnView<HTMLDivElement>({
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.16
  });

  return (
    <div
      className={`product-detail-reveal ${stagger ? "product-detail-reveal--stagger" : ""} ${reveal.isVisible ? "is-visible" : ""} ${className}`.trim()}
      ref={reveal.ref}
    >
      {children}
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  const roundedRating = Math.round(rating);
  return (
    <span aria-label={`${rating} out of 5 stars`} className="customer-rating-stars" role="img">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          aria-hidden="true"
          data-filled={star <= roundedRating || undefined}
          fill={star <= roundedRating ? "currentColor" : "none"}
          key={star}
        />
      ))}
    </span>
  );
}

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium" }).format(new Date(value));
}
