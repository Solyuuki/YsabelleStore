import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  MapPin,
  MessageSquareText,
  ShieldCheck,
  ShoppingBasket,
  Star
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { ProductCard, formatCurrency, formatUnit } from "@/components/customer/ProductCard";
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
  const [product, setProduct] = useState<StorefrontProduct | null>(null);
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

  if (error)
    return (
      <div className="customer-page customer-container">
        <div className="customer-empty-state">
          <h1>Product Unavailable</h1>
          <p>{error}</p>
          <button
            className="customer-button"
            onClick={() => window.location.reload()}
            type="button"
          >
            Try again
          </button>
          <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
            Back to shop
          </CustomerLink>
        </div>
      </div>
    );
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
          <ProductVisual
            category={product.category.name}
            imageUrl={product.imageUrl}
            large
            name={product.name}
          />
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
  const fallback = resource.data?.fallback ?? [];
  const hasProducts = sameCategory.length + fallback.length > 0;

  return (
    <section aria-labelledby="related-products-heading" className="customer-related-products">
      <ProductDetailReveal className="product-detail-reveal--heading">
        <header className="customer-product-section-heading customer-product-section-heading--related">
          <div>
            <p className="customer-kicker">Keep browsing</p>
            <h2 id="related-products-heading">
              {sameCategory.length ? `More from ${productCategory.name}` : "More store picks"}
            </h2>
          </div>
          {sameCategory.length ? (
            <CustomerLink
              className="customer-related-products__link"
              href={`/shop/category/${productCategory.slug}`}
              navigate={navigate}
            >
              View all {productCategory.name} <ChevronRight aria-hidden="true" size={17} />
            </CustomerLink>
          ) : (
            <CustomerLink
              className="customer-related-products__link"
              href="/shop"
              navigate={navigate}
            >
              Browse the shop <ChevronRight aria-hidden="true" size={17} />
            </CustomerLink>
          )}
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
        <>
          {sameCategory.length ? (
            <ProductDetailReveal
              className="customer-product-grid customer-related-products__grid"
              stagger
            >
              {sameCategory.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} navigate={navigate} product={relatedProduct} />
              ))}
            </ProductDetailReveal>
          ) : null}
          {fallback.length ? (
            <div
              className={sameCategory.length ? "customer-related-products__fallback" : undefined}
            >
              {sameCategory.length ? (
                <div>
                  <p className="customer-kicker">From other aisles</p>
                  <h3>You may also like</h3>
                </div>
              ) : null}
              <ProductDetailReveal
                className="customer-product-grid customer-related-products__grid"
                stagger
              >
                {fallback.map((relatedProduct) => (
                  <ProductCard
                    key={relatedProduct.id}
                    navigate={navigate}
                    product={relatedProduct}
                  />
                ))}
              </ProductDetailReveal>
            </div>
          ) : null}
        </>
      ) : null}
      {resource.status === "success" && !hasProducts ? (
        <div className="customer-product-section-state">
          <strong>No related products are available right now.</strong>
          <p>Browse the full shop to continue exploring the live catalog.</p>
        </div>
      ) : null}
    </section>
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
