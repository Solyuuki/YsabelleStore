import {
  ArrowRight,
  MapPin,
  ShoppingBasket,
  Sparkles,
  Store
} from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { HomeProductRail } from "@/components/customer/HomeProductRail";
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
import { getCategoryPresentation } from "@/utils/storefrontCategoryPresentation";
import { categoryCoverObjectPosition } from "@/utils/categoryCoverPosition";
import {
  getStorefrontProductBadge,
  type StorefrontProductBadge
} from "@/utils/storefrontMerchandising";

type Resource<T> = {
  data: T;
  error: string;
  status: "error" | "loading" | "success";
};

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
        Number(Boolean(right.storefrontCover || getCategoryPresentation(right.slug))) -
          Number(Boolean(left.storefrontCover || getCategoryPresentation(left.slug))) ||
        right.productCount - left.productCount ||
        left.name.localeCompare(right.name)
    )
    .slice(0, 8);
  const everydayProducts = selectEverydayProducts(products.data, categories.data, 12);
  const retry = () => setReloadKey((current) => current + 1);

  return (
    <div className="customer-home">
      <section
        className="customer-section home-categories"
        data-tour="categories"
        id="shop-by-category"
      >
        <CategoryRetailBackdrop />
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

      <div className="home-merchandising-stage">
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
              <HomeProductRail label="Everyday Essentials products">
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
              </HomeProductRail>
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
    </div>
  );
}

function CategoryRetailBackdrop() {
  return (
    <div aria-hidden="true" className="home-categories__backdrop">
      <svg
        className="home-categories__backdrop-side home-categories__backdrop-side--left"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 360 780"
      >
        <path
          className="home-categories__light-arc"
          d="M-30 88C72 14 208 18 390 116"
        />
        <path
          className="home-categories__light-arc home-categories__light-arc--soft"
          d="M-42 122C92 44 230 56 392 152"
        />

        <g className="home-categories__shelf" transform="translate(-10 150)">
          <rect className="home-categories__shelf-rail" height="8" rx="4" width="330" x="0" y="84" />
          <rect className="home-categories__product-box home-categories__product-box--blue" height="70" rx="9" width="50" x="20" y="10" />
          <rect className="home-categories__product-box" height="56" rx="9" width="42" x="78" y="24" />
          <rect className="home-categories__product-box home-categories__product-box--violet" height="64" rx="8" width="54" x="132" y="16" />
          <g className="home-categories__product-bottle" transform="translate(208 2)">
            <rect height="15" rx="4" width="22" x="11" y="0" />
            <rect height="64" rx="12" width="44" x="0" y="14" />
          </g>
          <g className="home-categories__product-bottle home-categories__product-bottle--indigo" transform="translate(266 14)">
            <rect height="13" rx="4" width="20" x="10" y="0" />
            <rect height="52" rx="11" width="40" x="0" y="12" />
          </g>
        </g>

        <g className="home-categories__shelf home-categories__shelf--secondary" transform="translate(-34 352)">
          <rect className="home-categories__shelf-rail" height="8" rx="4" width="340" x="0" y="88" />
          <g className="home-categories__product-bottle" transform="translate(34 12)">
            <rect height="14" rx="4" width="21" x="11" y="0" />
            <rect height="60" rx="12" width="43" x="0" y="13" />
          </g>
          <rect className="home-categories__product-box home-categories__product-box--violet" height="70" rx="10" width="58" x="94" y="8" />
          <rect className="home-categories__product-box" height="54" rx="8" width="46" x="164" y="24" />
          <rect className="home-categories__product-box home-categories__product-box--blue" height="64" rx="9" width="54" x="224" y="14" />
        </g>

        <g className="home-categories__podiums" transform="translate(-34 610)">
          <rect height="140" rx="20" width="118" x="0" y="32" />
          <rect className="home-categories__podium--violet" height="112" rx="18" width="104" x="102" y="60" />
          <rect className="home-categories__podium--soft" height="86" rx="16" width="92" x="196" y="86" />
        </g>

        <g className="home-categories__leaves" transform="translate(52 564)">
          <path d="M0 56C6 20 24 2 54 0C50 32 34 50 0 56Z" />
          <path d="M34 64C50 28 72 14 100 20C88 50 66 66 34 64Z" />
        </g>
      </svg>

      <svg
        className="home-categories__backdrop-side home-categories__backdrop-side--right"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 360 780"
      >
        <path
          className="home-categories__light-arc"
          d="M-30 106C92 16 224 18 396 72"
        />
        <path
          className="home-categories__light-arc home-categories__light-arc--soft"
          d="M-34 150C106 62 236 64 394 110"
        />

        <g className="home-categories__shelf" transform="translate(46 142)">
          <rect className="home-categories__shelf-rail" height="8" rx="4" width="334" x="0" y="86" />
          <g className="home-categories__product-bottle home-categories__product-bottle--indigo" transform="translate(20 6)">
            <rect height="14" rx="4" width="22" x="11" y="0" />
            <rect height="62" rx="12" width="44" x="0" y="13" />
          </g>
          <rect className="home-categories__product-box home-categories__product-box--violet" height="68" rx="9" width="54" x="82" y="10" />
          <rect className="home-categories__product-box" height="52" rx="8" width="46" x="148" y="26" />
          <g className="home-categories__product-bottle" transform="translate(214 16)">
            <rect height="12" rx="4" width="19" x="10" y="0" />
            <rect height="50" rx="10" width="39" x="0" y="11" />
          </g>
        </g>

        <g className="home-categories__shelf home-categories__shelf--secondary" transform="translate(64 350)">
          <rect className="home-categories__shelf-rail" height="8" rx="4" width="326" x="0" y="88" />
          <rect className="home-categories__product-box home-categories__product-box--blue" height="66" rx="9" width="52" x="18" y="12" />
          <g className="home-categories__product-bottle" transform="translate(88 10)">
            <rect height="13" rx="4" width="20" x="10" y="0" />
            <rect height="56" rx="11" width="40" x="0" y="12" />
          </g>
          <rect className="home-categories__product-box home-categories__product-box--violet" height="72" rx="10" width="58" x="146" y="6" />
          <rect className="home-categories__product-box" height="52" rx="8" width="46" x="220" y="26" />
        </g>

        <g className="home-categories__podiums" transform="translate(116 610)">
          <rect className="home-categories__podium--soft" height="88" rx="16" width="94" x="0" y="84" />
          <rect className="home-categories__podium--violet" height="116" rx="18" width="106" x="82" y="56" />
          <rect height="144" rx="20" width="120" x="176" y="28" />
        </g>

        <g className="home-categories__leaves home-categories__leaves--right" transform="translate(210 552)">
          <path d="M0 66C8 26 28 6 60 0C56 36 38 58 0 66Z" />
          <path d="M38 72C58 34 80 22 110 30C96 60 72 76 38 72Z" />
        </g>
      </svg>
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
          <SectionHeading eyebrow="What shoppers are choosing" title="Trending Now">
            Checking recent verified ratings and customer review momentum.
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
          message: `Products will appear here after recent verified customer ratings and comments build enough positive momentum within the last ${resource.data.trendingWindowDays} days.`,
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
        title="Trending Now"
      >
        {`Based on recent verified ratings, customer comments, and review momentum from the last ${resource.data.trendingWindowDays} days.`}
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
          <HomeProductRail label={`${title} products`}>
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
          </HomeProductRail>
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
  const managedCover = category.storefrontCover;
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
          {managedCover ? (
            <ProductImage
              alt={`${category.name} category cover`}
              fallbackLabel="Category image unavailable"
              imageUrl={managedCover.imageUrl}
              loading="lazy"
              objectPosition={categoryCoverObjectPosition(managedCover.position)}
            />
          ) : categoryPresentation ? (
            <ProductImage
              alt={categoryPresentation.alt}
              fallbackLabel="Category image unavailable"
              imageUrl={categoryPresentation.imageUrl}
              loading="lazy"
            />
          ) : (
            <ProductImage
              alt={`${category.name} category`}
              className="home-category-card__image-pending"
              fallbackLabel="Category image pending"
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
          <span>{action}</span>
          <ArrowRight aria-hidden="true" size={16} />
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
