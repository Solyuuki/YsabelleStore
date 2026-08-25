import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  MapPin,
  PackageCheck,
  ShoppingBasket,
  Sparkles,
  Store
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { ProductCard } from "@/components/customer/ProductCard";
import { ProductImage } from "@/components/customer/ProductImage";
import { useRevealOnView } from "@/hooks/useRevealOnView";
import {
  fetchStorefrontCategories,
  fetchStorefrontMerchandising,
  fetchStorefrontProducts
} from "@/services/storefrontService";
import type {
  StorefrontCategory,
  StorefrontMerchandising,
  StorefrontMerchandisingEntry,
  StorefrontProduct
} from "@/types/storefront";
import { getCategoryRepresentativeProducts } from "@/utils/storefrontImages";
import {
  getCategoryPresentation,
  getEssentialShelfItems
} from "@/utils/storefrontCategoryPresentation";
import {
  getStorefrontProductBadge,
  type StorefrontProductBadge
} from "@/utils/storefrontMerchandising";

type Resource<T> = {
  data: T;
  error: string;
  status: "error" | "loading" | "success";
};

type HomeShowcaseItem = {
  alt: string;
  category: string;
  imageUrl: string;
  slug: string;
};

const homeShowcaseOrder = ["beverages", "snacks", "instant-food"];

const emptyMerchandising: StorefrontMerchandising = {
  bestSellers: [],
  generatedAt: "",
  trending: [],
  trendingWindowDays: 30
};

export function CustomerHomePage({ navigate }: { navigate: (path: string) => void }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [categories, setCategories] = useState<Resource<StorefrontCategory[]>>({
    data: [],
    error: "",
    status: "loading"
  });
  const [products, setProducts] = useState<Resource<StorefrontProduct[]>>({
    data: [],
    error: "",
    status: "loading"
  });
  const [merchandising, setMerchandising] = useState<Resource<StorefrontMerchandising>>({
    data: emptyMerchandising,
    error: "",
    status: "loading"
  });

  useEffect(() => {
    const controller = new AbortController();
    setCategories((current) => ({ ...current, error: "", status: "loading" }));
    setProducts((current) => ({ ...current, error: "", status: "loading" }));
    setMerchandising((current) => ({ ...current, error: "", status: "loading" }));

    void fetchStorefrontCategories(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCategories({ data, error: "", status: "success" });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setCategories({
            data: [],
            error: homeError(reason, "Categories are temporarily unavailable."),
            status: "error"
          });
        }
      });

    void fetchStorefrontProducts({ availability: "all", pageSize: 48 }, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProducts({ data: result.items, error: "", status: "success" });
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setProducts({
            data: [],
            error: homeError(reason, "Products are temporarily unavailable."),
            status: "error"
          });
        }
      });

    void fetchStorefrontMerchandising(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setMerchandising({ data, error: "", status: "success" });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setMerchandising({
            data: emptyMerchandising,
            error: homeError(reason, "Sales-backed picks are temporarily unavailable."),
            status: "error"
          });
        }
      });

    return () => controller.abort();
  }, [reloadKey]);

  const featuredCategories = [...categories.data]
    .sort(
      (left, right) =>
        right.representativeProducts.length - left.representativeProducts.length ||
        right.productCount - left.productCount ||
        left.name.localeCompare(right.name)
    )
    .slice(0, 8);
  const showcaseCategories = [...categories.data]
    .filter((category) => getCategoryPresentation(category.slug))
    .sort(
      (left, right) =>
        showcaseRank(left.slug) - showcaseRank(right.slug) ||
        right.productCount - left.productCount ||
        left.name.localeCompare(right.name)
    )
    .slice(0, 3);
  const showcaseItems: HomeShowcaseItem[] = showcaseCategories.length
    ? showcaseCategories.flatMap((category) => {
        const presentation = getCategoryPresentation(category.slug);
        return presentation
          ? [
              {
                alt: presentation.alt,
                category: category.name,
                imageUrl: presentation.imageUrl,
                slug: category.slug
              }
            ]
          : [];
      })
    : getEssentialShelfItems()
        .slice(0, 3)
        .map((item) => ({
          alt: item.alt,
          category: item.category,
          imageUrl: item.imageUrl,
          slug: item.slug
        }));
  const everydayProducts = selectEverydayProducts(products.data, categories.data, 3);
  const catalogProductCount = categories.data.reduce(
    (total, category) => total + category.productCount,
    0
  );
  const retry = () => setReloadKey((current) => current + 1);

  return (
    <div className="customer-home">
      <section className="home-hero">
        <div className="customer-container home-hero__grid">
          <div className="home-hero__copy home-hero__copy--animated">
            <p className="customer-kicker">
              <span /> Your neighborhood grocery, online
            </p>
            <h1>
              <span className="home-hero__headline-primary">Your Everyday List,</span>
              <em className="home-hero__headline-accent">Ready When You Are.</em>
            </h1>
            <p className="home-hero__lead">
              Find groceries, pantry staples, and home essentials with live store availability from
              Ysabelle&apos;s Store in Pasig City.
            </p>

            <div className="home-hero__actions">
              <span className="home-hero__primary-action-reveal">
                <CustomerLink
                  className="customer-button home-hero__primary-action"
                  data-tour="start-shopping"
                  href="/shop"
                  navigate={navigate}
                >
                  <span>Shop groceries</span>
                  <ArrowRight aria-hidden="true" size={18} />
                </CustomerLink>
              </span>
              <a
                className="home-hero__category-link home-hero__secondary-action home-secondary-link"
                href="#shop-by-category"
              >
                Browse categories
              </a>
            </div>

            <div className="home-hero__trust" aria-label="Store information">
              <span>
                <BadgeCheck aria-hidden="true" />
                {catalogProductCount > 0
                  ? `${catalogProductCount} catalog products`
                  : "Live catalog"}
              </span>
              <span>
                <PackageCheck aria-hidden="true" /> Store pickup
              </span>
              <span>
                <Clock3 aria-hidden="true" /> Established 2019
              </span>
            </div>
          </div>

          <HomeCategoryShowcase items={showcaseItems} navigate={navigate} />
        </div>
      </section>

      <section
        className="customer-section home-categories"
        data-tour="categories"
        id="shop-by-category"
      >
        <div className="customer-container">
          <SectionHeading
            action="View all categories"
            actionHref="/shop#categories"
            eyebrow="Find your aisle"
            motion="categories"
            navigate={navigate}
            title="Shop by Category"
          >
            Browse the real store catalog by the kind of item you need.
          </SectionHeading>

          {categories.status === "loading" ? <CategorySkeletons /> : null}
          {categories.status === "error" ? (
            <CompactSectionState
              message={categories.error}
              onRetry={retry}
              title="Categories Could Not Be Loaded"
            />
          ) : null}
          {categories.status === "success" && featuredCategories.length ? (
            <div className="home-category-grid">
              {featuredCategories.map((category, index) => (
                <CategoryCard
                  category={category}
                  index={index}
                  key={category.id}
                  navigate={navigate}
                />
              ))}
            </div>
          ) : null}
          {categories.status === "success" && !featuredCategories.length ? (
            <CompactSectionState
              message="Store categories will appear here when catalog items are available."
              title="No Categories Yet"
            />
          ) : null}
        </div>
      </section>

      <MerchandisingArea navigate={navigate} onRetry={retry} resource={merchandising} />

      <section className="customer-section home-essentials">
        <div className="customer-container">
          <SectionHeading
            action="Shop all products"
            actionHref="/shop"
            eyebrow="Everyday picks"
            motion="essentials"
            navigate={navigate}
            title="Everyday Essentials"
          >
            A curated selection of everyday products from Ysabelle&apos;s catalog.
          </SectionHeading>

          {products.status === "loading" ? <ProductSkeletons /> : null}
          {products.status === "error" ? (
            <CompactSectionState
              message={products.error}
              onRetry={retry}
              title="The Essentials Shelf Could Not Be Loaded"
            />
          ) : null}
          {products.status === "success" && everydayProducts.length ? (
            <div className="customer-product-grid home-product-grid">
              {everydayProducts.map((product, index) => (
                <HomeProductCard
                  key={product.id}
                  motion="essentials"
                  navigate={navigate}
                  product={product}
                  tourTarget={index === 0}
                  revealIndex={index}
                />
              ))}
            </div>
          ) : null}
          {products.status === "success" && !everydayProducts.length ? (
            <CompactSectionState
              message="Verified product imagery is still being added. Browse again as the catalog expands."
              title="More Everyday Picks Are Coming"
            />
          ) : null}
        </div>
      </section>

      <HomeNextStep navigate={navigate} />
    </div>
  );
}

function HomeCategoryShowcase({
  items,
  navigate
}: {
  items: HomeShowcaseItem[];
  navigate: (path: string) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const transitionTimeout = useRef<number | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener?.("change", syncPreference);
    return () => mediaQuery.removeEventListener?.("change", syncPreference);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => (items.length ? current % items.length : 0));
    setIsTransitioning(false);
  }, [items.length]);

  useEffect(
    () => () => {
      if (transitionTimeout.current !== null) window.clearTimeout(transitionTimeout.current);
    },
    []
  );

  const advanceCategory = useCallback(() => {
    if (isTransitioning || items.length < 2) return;

    setIsTransitioning(true);
    transitionTimeout.current = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % items.length);
      setIsTransitioning(false);
      transitionTimeout.current = null;
    }, 160);
  }, [isTransitioning, items.length]);

  useEffect(() => {
    if (isPaused || prefersReducedMotion || items.length < 2) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        advanceCategory();
      }
    }, 7000);

    return () => window.clearInterval(interval);
  }, [advanceCategory, isPaused, items.length, prefersReducedMotion]);

  const item = items[activeIndex] ?? items[0];
  if (!item) return null;

  return (
    <div className="home-hero__merchandise home-hero__merchandise--animated">
      <CustomerLink
        aria-label={`Browse the ${item.category} category`}
        className={`home-showcase ${isTransitioning ? "is-transitioning" : ""}`}
        href={`/shop/category/${item.slug}`}
        navigate={navigate}
        onBlur={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <span className="home-showcase__media">
          <ProductImage
            alt={item.alt}
            className="home-showcase__image"
            fetchPriority="high"
            imageUrl={item.imageUrl}
            key={item.slug}
            loading="eager"
          />
          <span className="home-showcase__media-label">Featured aisle</span>
        </span>
        <span className="home-showcase__content" key={item.slug}>
          <strong className="home-showcase__category">{item.category}</strong>
          <span className="home-showcase__title">{getShowcaseTitle(item.category)}</span>
          <span className="home-showcase__footer">
            <span className="home-showcase__availability">
              <span aria-hidden="true" /> Live availability
            </span>
            <ArrowRight aria-hidden="true" className="home-showcase__arrow" size={17} />
          </span>
        </span>
      </CustomerLink>
    </div>
  );
}

function MerchandisingArea({
  navigate,
  onRetry,
  resource
}: {
  navigate: (path: string) => void;
  onRetry: () => void;
  resource: Resource<StorefrontMerchandising>;
}) {
  if (resource.status === "loading") {
    return (
      <section className="customer-section home-merchandising home-merchandising--loading">
        <div className="customer-container">
          <SectionHeading eyebrow="What shoppers are choosing" title="Hot Right Now">
            Checking recent completed sales for the products customers are choosing now.
          </SectionHeading>
          <ProductSkeletons />
        </div>
      </section>
    );
  }

  const trendingState =
    resource.status === "error"
      ? {
          message: resource.error,
          onRetry,
          title: "Trending Could Not Be Loaded"
        }
      : {
          message: `Fresh customer activity will appear here after completed sales are recorded in the last ${resource.data.trendingWindowDays} days.`,
          title: "Trending Is Building"
        };
  const bestSellerState =
    resource.status === "error"
      ? {
          message: resource.error,
          onRetry,
          title: "Best Sellers Could Not Be Loaded"
        }
      : {
          message:
            "Sales-backed favorites will appear here once eligible products have recorded completed or imported historical sales.",
          title: "Best Sellers Are Building"
        };

  return (
    <>
      <MerchandisingShelf
        emptyState={trendingState}
        entries={resource.data.trending}
        eyebrow="What shoppers are choosing"
        navigate={navigate}
        placement="trending"
        title="Hot Right Now"
      >
        {`Ranked by completed sales in the last ${resource.data.trendingWindowDays} days.`}
      </MerchandisingShelf>
      <MerchandisingShelf
        emptyState={bestSellerState}
        entries={resource.data.bestSellers}
        eyebrow="Proven store favorites"
        navigate={navigate}
        placement="best-seller"
        title="Best Sellers"
      >
        Ranked by recorded units sold across completed and imported historical sales.
      </MerchandisingShelf>
    </>
  );
}

function MerchandisingShelf({
  children,
  emptyState,
  entries,
  eyebrow,
  navigate,
  placement,
  title
}: {
  children: string;
  emptyState: {
    message: string;
    onRetry?: () => void;
    title: string;
  };
  entries: StorefrontMerchandisingEntry[];
  eyebrow: string;
  navigate: (path: string) => void;
  placement: "best-seller" | "trending";
  title: string;
}) {
  return (
    <section className={`customer-section home-merchandising home-merchandising--${placement}`}>
      <div className="customer-container">
        <SectionHeading
          action="Browse the full shop"
          actionHref="/shop"
          eyebrow={eyebrow}
          motion={placement === "trending" ? "trending" : "best-seller"}
          navigate={navigate}
          title={title}
        >
          {children}
        </SectionHeading>
        {entries.length ? (
          <div className="customer-product-grid home-product-grid">
            {entries.map((entry) => (
              <HomeProductCard
                badge={getStorefrontProductBadge(entry.product, placement, entry.rank)}
                key={entry.product.id}
                motion={placement}
                navigate={navigate}
                product={entry.product}
                revealIndex={entry.rank - 1}
              />
            ))}
          </div>
        ) : (
          <MerchandisingShelfState placement={placement} {...emptyState} />
        )}
      </div>
    </section>
  );
}

function MerchandisingShelfState({
  message,
  onRetry,
  placement,
  title
}: {
  message: string;
  onRetry?: () => void;
  placement: "best-seller" | "trending";
  title: string;
}) {
  const reveal = useRevealOnView<HTMLDivElement>({
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.18
  });

  return (
    <div
      className={`home-reveal home-reveal--merchandising-state home-reveal--${placement} ${reveal.isVisible ? "is-visible" : ""}`}
      ref={reveal.ref}
    >
      <CompactSectionState message={message} onRetry={onRetry} title={title} />
    </div>
  );
}

function CategoryCard({
  category,
  index,
  navigate
}: {
  category: StorefrontCategory;
  index: number;
  navigate: (path: string) => void;
}) {
  const categoryPresentation = getCategoryPresentation(category.slug);
  const representativeProducts = getCategoryRepresentativeProducts(category);
  const reveal = useRevealOnView<HTMLDivElement>({
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.18
  });

  return (
    <div
      className={`home-reveal home-reveal--card home-reveal--category ${reveal.isVisible ? "is-visible" : ""}`}
      ref={reveal.ref}
      style={{ "--home-reveal-index": index } as CSSProperties}
    >
      <CustomerLink
        className="home-category-card"
        data-category-variant={(index % 4) + 1}
        href={`/shop/category/${category.slug}`}
        navigate={navigate}
      >
        <span className="home-category-card__visual">
          {categoryPresentation ? (
            <ProductImage
              alt={categoryPresentation.alt}
              fallbackLabel="Category image unavailable"
              imageUrl={categoryPresentation.imageUrl}
              loading="lazy"
            />
          ) : representativeProducts.length ? (
            <span
              className="home-category-card__assortment"
              data-image-count={representativeProducts.length}
            >
              {representativeProducts.map((product) => (
                <ProductImage
                  alt={`${product.name} product photo`}
                  imageUrl={product.imageUrl}
                  key={product.id}
                />
              ))}
            </span>
          ) : (
            <ProductImage
              alt={`${category.name} category`}
              className="home-category-card__image-pending"
              fallbackLabel="Verified category imagery pending"
            />
          )}
          <span className="home-category-card__count">
            {category.productCount} product{category.productCount === 1 ? "" : "s"}
          </span>
        </span>
        <span className="home-category-card__body">
          <span>
            <strong>{category.name}</strong>
            <small>{category.description || "Explore this aisle"}</small>
          </span>
        </span>
      </CustomerLink>
    </div>
  );
}

function HomeProductCard({
  badge,
  motion = "best-seller",
  navigate,
  product,
  revealIndex,
  tourTarget
}: {
  badge?: StorefrontProductBadge | null;
  motion?: "best-seller" | "essentials" | "trending";
  navigate: (path: string) => void;
  product: StorefrontProduct;
  revealIndex: number;
  tourTarget?: boolean;
}) {
  const reveal = useRevealOnView<HTMLDivElement>({
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.18
  });

  return (
    <div
      className={`home-reveal home-reveal--product home-reveal--${motion} ${reveal.isVisible ? "is-visible" : ""}`}
      ref={reveal.ref}
      style={{ "--home-reveal-index": Math.min(revealIndex, 4) } as CSSProperties}
    >
      <ProductCard
        badge={badge}
        navigate={navigate}
        presentation="editorial"
        product={product}
        tourTarget={tourTarget}
      />
    </div>
  );
}

function SectionHeading({
  action,
  actionHref,
  children,
  eyebrow,
  motion = "best-seller",
  navigate,
  title
}: {
  action?: string;
  actionHref?: string;
  children: string;
  eyebrow: string;
  navigate?: (path: string) => void;
  motion?: "best-seller" | "categories" | "essentials" | "trending";
  title: string;
}) {
  const reveal = useRevealOnView<HTMLDivElement>({
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.2
  });

  return (
    <div
      className={`customer-section-heading home-section-heading home-section-heading--${motion} ${reveal.isVisible ? "is-visible" : ""}`}
      ref={reveal.ref}
    >
      <div>
        <p className="customer-kicker home-section-heading__eyebrow">{eyebrow}</p>
        <h2 className="home-section-heading__title">{title}</h2>
        <p className="home-section-heading__description">{children}</p>
      </div>
      {action && actionHref && navigate ? (
        <CustomerLink
          className="home-section-heading__action"
          href={actionHref}
          navigate={navigate}
        >
          {action} <ArrowRight aria-hidden="true" size={16} />
        </CustomerLink>
      ) : null}
    </div>
  );
}

function HomeNextStep({ navigate }: { navigate: (path: string) => void }) {
  const reveal = useRevealOnView<HTMLDivElement>({
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.2
  });

  return (
    <section className="customer-section home-next-step">
      <div
        className={`customer-container home-next-step__grid ${reveal.isVisible ? "is-visible" : ""}`}
        ref={reveal.ref}
      >
        <article className="home-pickup-card" data-tour="checkout">
          <span className="home-next-step__icon">
            <ShoppingBasket aria-hidden="true" />
          </span>
          <p className="customer-kicker">Simple store pickup</p>
          <h2>Build Your Basket Now. Pay When You Collect It.</h2>
          <p>
            Send your grocery request online, then pick it up at 110 A. Mabini Street, Pasig City.
          </p>
          <div className="home-pickup-card__meta">
            <span>
              <MapPin aria-hidden="true" /> Pasig City
            </span>
            <span>
              <Store aria-hidden="true" /> Cash on pickup
            </span>
          </div>
          <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
            Build your basket <ArrowRight aria-hidden="true" size={18} />
          </CustomerLink>
        </article>

        <article className="home-discover-card">
          <span className="home-next-step__icon">
            <Sparkles aria-hidden="true" />
          </span>
          <p className="customer-kicker">Discover Ysabelle</p>
          <h2>See the Story Behind the Shelves.</h2>
          <p>
            Step into the store&apos;s journey from a local beginning to smarter everyday retail.
          </p>
          <CustomerLink className="home-secondary-link" href="/about" navigate={navigate}>
            Explore our story
          </CustomerLink>
        </article>
      </div>
    </section>
  );
}

function CompactSectionState({
  message,
  onRetry,
  title
}: {
  message: string;
  onRetry?: () => void;
  title: string;
}) {
  return (
    <div className="home-compact-state" role={onRetry ? "alert" : "status"}>
      <span className="home-compact-state__icon">
        <ShoppingBasket aria-hidden="true" size={19} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button onClick={onRetry} type="button">
          Try again
        </button>
      ) : null}
    </div>
  );
}

function ProductSkeletons() {
  return (
    <div
      aria-label="Loading products"
      className="customer-product-grid home-product-grid"
      role="status"
    >
      {Array.from({ length: 4 }, (_, index) => (
        <div aria-hidden="true" className="home-product-skeleton" key={index}>
          <span />
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}

function CategorySkeletons() {
  return (
    <div aria-label="Loading categories" className="home-category-grid" role="status">
      {Array.from({ length: 8 }, (_, index) => (
        <div aria-hidden="true" className="home-category-skeleton" key={index} />
      ))}
    </div>
  );
}

function selectEverydayProducts(
  products: StorefrontProduct[],
  categories: StorefrontCategory[],
  limit: number
) {
  const categoryCounts = new Map(
    categories.map((category) => [category.id, category.productCount])
  );
  const selectedByCategory = new Map<string, number>();

  return [...products]
    .sort(
      (left, right) =>
        (categoryCounts.get(right.category.id) ?? 0) -
          (categoryCounts.get(left.category.id) ?? 0) ||
        left.category.name.localeCompare(right.category.name) ||
        left.name.localeCompare(right.name)
    )
    .filter((product) => {
      const selected = selectedByCategory.get(product.category.id) ?? 0;
      if (selected >= 2) return false;
      selectedByCategory.set(product.category.id, selected + 1);
      return true;
    })
    .slice(0, limit);
}

function homeError(reason: unknown, fallback: string) {
  if (!(reason instanceof Error) || /^failed to fetch$/i.test(reason.message.trim()))
    return fallback;
  return reason.message;
}

function showcaseRank(slug: string) {
  const rank = homeShowcaseOrder.indexOf(slug);
  return rank === -1 ? homeShowcaseOrder.length : rank;
}

function getShowcaseTitle(category: string) {
  const titles: Record<string, string> = {
    Beverages: "Everyday refreshments, ready when you are.",
    "Instant Food": "Quick pantry favorites for busy days.",
    Snacks: "Easy-to-reach favorites for every little break."
  };

  return titles[category] ?? "Everyday essentials, ready for your next shop.";
}
