import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  MapPin,
  PackageCheck,
  Search,
  ShoppingBasket,
  Sparkles,
  Store
} from "lucide-react";
import { useEffect, useState, type CSSProperties, type FormEvent } from "react";

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
  const [search, setSearch] = useState("");
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

    void fetchStorefrontProducts({ availability: "in-stock", pageSize: 48 }, controller.signal)
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

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/shop?search=${encodeURIComponent(query)}` : "/shop");
  }

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
  const everydayProducts = selectEverydayProducts(products.data, categories.data, 4);
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
              <span>Your Everyday List,</span>
              <em>Ready When You Are.</em>
            </h1>
            <p className="home-hero__lead">
              Find groceries, pantry staples, and home essentials with live store availability from
              Ysabelle&apos;s Store in Pasig City.
            </p>

            <form className="home-hero__search" onSubmit={submitSearch} role="search">
              <Search aria-hidden="true" size={21} />
              <label className="sr-only" htmlFor="home-product-search">
                Search the grocery catalog
              </label>
              <input
                autoComplete="off"
                id="home-product-search"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search drinks, snacks, household items..."
                type="search"
                value={search}
              />
              <button type="submit">Find products</button>
            </form>

            <div className="home-hero__actions">
              <CustomerLink
                className="customer-button home-hero__primary-action"
                data-tour="start-shopping"
                href="/shop"
                navigate={navigate}
              >
                Shop groceries <ArrowRight aria-hidden="true" size={18} />
              </CustomerLink>
              <a
                className="home-hero__category-link home-hero__secondary-action"
                href="#shop-by-category"
              >
                Browse categories <ArrowRight aria-hidden="true" size={16} />
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

      <MerchandisingArea navigate={navigate} onRetry={retry} resource={merchandising} />

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

      <section className="customer-section home-essentials">
        <div className="customer-container">
          <SectionHeading
            action="Shop all products"
            actionHref="/shop"
            eyebrow="Ready for pickup"
            navigate={navigate}
            title="Everyday Essentials"
          >
            A balanced selection of currently available products from the live catalog.
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
              message="There are no in-stock products to show right now. Browse the full catalog for updates."
              title="The Shelf Is Being Restocked"
            />
          ) : null}
        </div>
      </section>

      <section className="customer-section home-next-step">
        <div className="customer-container home-next-step__grid">
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
            <CustomerLink href="/about" navigate={navigate}>
              Explore our story <ArrowRight aria-hidden="true" size={17} />
            </CustomerLink>
          </article>
        </div>
      </section>
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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener?.("change", syncPreference);
    return () => mediaQuery.removeEventListener?.("change", syncPreference);
  }, []);

  useEffect(() => {
    setActiveIndex((current) => (items.length ? current % items.length : 0));
  }, [items.length]);

  useEffect(() => {
    if (isPaused || prefersReducedMotion || items.length < 2) return;

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setActiveIndex((current) => (current + 1) % items.length);
      }
    }, 7000);

    return () => window.clearInterval(interval);
  }, [isPaused, items.length, prefersReducedMotion]);

  const item = items[activeIndex] ?? items[0];
  if (!item) return null;

  return (
    <div className="home-hero__merchandise home-hero__merchandise--animated">
      <CustomerLink
        aria-label={`Browse the ${item.category} category`}
        className="home-showcase"
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
            <ArrowRight aria-hidden="true" className="home-showcase__arrow" size={19} />
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
  if (resource.status === "error") {
    return (
      <section className="customer-section home-merchandising-status">
        <div className="customer-container">
          <CompactSectionState
            message={resource.error}
            onRetry={onRetry}
            title="Sales-Backed Picks Could Not Be Loaded"
          />
        </div>
      </section>
    );
  }

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

  if (!resource.data.trending.length && !resource.data.bestSellers.length) return null;

  return (
    <>
      {resource.data.trending.length ? (
        <MerchandisingShelf
          entries={resource.data.trending}
          eyebrow="What shoppers are choosing"
          navigate={navigate}
          placement="trending"
          title="Hot Right Now"
        >
          {`Ranked by completed sales in the last ${resource.data.trendingWindowDays} days.`}
        </MerchandisingShelf>
      ) : null}
      {resource.data.bestSellers.length ? (
        <MerchandisingShelf
          entries={resource.data.bestSellers}
          eyebrow="Proven store favorites"
          navigate={navigate}
          placement="best-seller"
          title="Best Sellers"
        >
          Ranked by recorded units sold across completed and imported historical sales.
        </MerchandisingShelf>
      ) : null}
    </>
  );
}

function MerchandisingShelf({
  children,
  entries,
  eyebrow,
  navigate,
  placement,
  title
}: {
  children: string;
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
          navigate={navigate}
          title={title}
        >
          {children}
        </SectionHeading>
        <div className="customer-product-grid home-product-grid">
          {entries.map((entry) => (
            <HomeProductCard
              badge={getStorefrontProductBadge(entry.product, placement, entry.rank)}
              key={entry.product.id}
              navigate={navigate}
              product={entry.product}
              revealIndex={entry.rank - 1}
            />
          ))}
        </div>
      </div>
    </section>
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
  const reveal = useRevealOnView<HTMLDivElement>();

  return (
    <div
      className={`home-reveal home-reveal--card ${reveal.isVisible ? "is-visible" : ""}`}
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
              loading="eager"
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
          <ArrowRight aria-hidden="true" size={18} />
        </span>
      </CustomerLink>
    </div>
  );
}

function HomeProductCard({
  badge,
  navigate,
  product,
  revealIndex,
  tourTarget
}: {
  badge?: StorefrontProductBadge | null;
  navigate: (path: string) => void;
  product: StorefrontProduct;
  revealIndex: number;
  tourTarget?: boolean;
}) {
  const reveal = useRevealOnView<HTMLDivElement>();

  return (
    <div
      className={`home-reveal home-reveal--product ${reveal.isVisible ? "is-visible" : ""}`}
      ref={reveal.ref}
      style={{ "--home-reveal-index": Math.min(revealIndex, 4) } as CSSProperties}
    >
      <ProductCard badge={badge} navigate={navigate} product={product} tourTarget={tourTarget} />
    </div>
  );
}

function SectionHeading({
  action,
  actionHref,
  children,
  eyebrow,
  navigate,
  title
}: {
  action?: string;
  actionHref?: string;
  children: string;
  eyebrow: string;
  navigate?: (path: string) => void;
  title: string;
}) {
  const reveal = useRevealOnView<HTMLDivElement>();

  return (
    <div
      className={`customer-section-heading home-section-heading home-reveal ${reveal.isVisible ? "is-visible" : ""}`}
      ref={reveal.ref}
    >
      <div>
        <p className="customer-kicker">{eyebrow}</p>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
      {action && actionHref && navigate ? (
        <CustomerLink href={actionHref} navigate={navigate}>
          {action} <ArrowRight aria-hidden="true" size={16} />
        </CustomerLink>
      ) : null}
    </div>
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
