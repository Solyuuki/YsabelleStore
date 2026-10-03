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
        className="home-categories__retail-scene"
        focusable="false"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 1600 820"
      >
        <defs>
          <linearGradient id="categoryShelfGlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.78" />
            <stop offset="48%" stopColor="#cfe4ff" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#baa8ff" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="categoryShelfGlowRight" x1="1" x2="0" y1="0" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.78" />
            <stop offset="48%" stopColor="#ddd2ff" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#9ecfff" stopOpacity="0.16" />
          </linearGradient>
          <linearGradient id="categoryProductBlue" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#dff2ff" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#6db8ff" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="categoryProductViolet" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f2ebff" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#8269ff" stopOpacity="0.18" />
          </linearGradient>
          <linearGradient id="categoryProductWhite" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.76" />
            <stop offset="100%" stopColor="#dfe9ff" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient id="categoryFloorBlue" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#8bc7ff" stopOpacity="0.16" />
            <stop offset="58%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#9a82ff" stopOpacity="0.13" />
          </linearGradient>
          <linearGradient id="categoryFloorViolet" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#728dff" stopOpacity="0.08" />
            <stop offset="52%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="100%" stopColor="#b46aff" stopOpacity="0.12" />
          </linearGradient>
          <radialGradient id="categoryCenterWash" cx="50%" cy="43%" r="58%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.84" />
            <stop offset="38%" stopColor="#ffffff" stopOpacity="0.68" />
            <stop offset="66%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="categoryBlurNear" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.8" />
          </filter>
          <filter id="categoryBlurMid" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6.5" />
          </filter>
          <filter id="categoryBlurFar" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
          <filter id="categoryGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur result="blur" stdDeviation="5" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="home-categories__ceiling" filter="url(#categoryGlow)">
          <path d="M-70 104C132 2 350 -10 592 78" />
          <path className="home-categories__ceiling-soft" d="M-82 142C120 50 332 44 552 112" />
          <path d="M1670 96C1464 -8 1248 -16 1018 72" />
          <path className="home-categories__ceiling-soft" d="M1682 138C1476 44 1268 40 1052 108" />
          <circle cx="188" cy="58" r="13" />
          <circle cx="362" cy="80" r="10" />
          <circle cx="1248" cy="62" r="11" />
          <circle cx="1436" cy="78" r="13" />
        </g>

        <g className="home-categories__retail-depth home-categories__retail-depth--left" filter="url(#categoryBlurFar)">
          <path className="home-categories__shelf-curve" d="M-90 280C96 224 282 230 512 304" />
          <path className="home-categories__shelf-curve home-categories__shelf-curve--lower" d="M-102 424C104 368 284 376 486 438" />
          <g transform="translate(24 196)">
            <rect fill="url(#categoryProductBlue)" height="70" rx="14" width="56" x="0" y="16" />
            <rect fill="url(#categoryProductWhite)" height="58" rx="12" width="48" x="70" y="28" />
            <rect fill="url(#categoryProductViolet)" height="76" rx="13" width="58" x="132" y="10" />
            <g fill="url(#categoryProductBlue)" transform="translate(208 4)">
              <rect height="16" rx="5" width="24" x="13" y="0" />
              <rect height="70" rx="17" width="50" x="0" y="15" />
            </g>
            <g fill="url(#categoryProductWhite)" transform="translate(280 16)">
              <rect height="14" rx="5" width="22" x="12" y="0" />
              <rect height="56" rx="15" width="46" x="0" y="13" />
            </g>
          </g>
          <g transform="translate(-14 344)">
            <g fill="url(#categoryProductWhite)" transform="translate(18 12)">
              <rect height="15" rx="5" width="22" x="12" y="0" />
              <rect height="62" rx="16" width="46" x="0" y="14" />
            </g>
            <rect fill="url(#categoryProductViolet)" height="72" rx="13" width="62" x="82" y="6" />
            <rect fill="url(#categoryProductBlue)" height="58" rx="12" width="52" x="158" y="20" />
            <rect fill="url(#categoryProductWhite)" height="68" rx="12" width="58" x="226" y="10" />
          </g>
        </g>

        <g className="home-categories__retail-near home-categories__retail-near--left" filter="url(#categoryBlurMid)">
          <path className="home-categories__shelf-near" d="M-140 170C82 98 262 112 438 190" />
          <path className="home-categories__shelf-near home-categories__shelf-near--lower" d="M-156 520C54 454 232 466 418 534" />
          <g transform="translate(-34 82)">
            <g fill="url(#categoryProductWhite)" transform="translate(0 4)">
              <rect height="18" rx="5" width="27" x="14" y="0" />
              <rect height="88" rx="19" width="56" x="0" y="17" />
            </g>
            <g fill="url(#categoryProductBlue)" transform="translate(72 22)">
              <rect height="15" rx="5" width="24" x="13" y="0" />
              <rect height="70" rx="17" width="50" x="0" y="14" />
            </g>
            <rect fill="url(#categoryProductViolet)" height="92" rx="17" width="74" x="142" y="14" />
          </g>
          <g className="home-categories__retail-podiums" transform="translate(-76 594)">
            <rect height="202" rx="34" width="146" x="0" y="20" />
            <rect className="home-categories__retail-podium--violet" height="168" rx="30" width="132" x="116" y="54" />
            <rect className="home-categories__retail-podium--light" height="124" rx="26" width="120" x="232" y="98" />
          </g>
          <g className="home-categories__retail-leaves" transform="translate(42 552)">
            <path d="M0 76C10 28 36 4 78 0C70 46 46 70 0 76Z" />
            <path d="M48 86C66 42 94 24 132 32C116 70 88 90 48 86Z" />
          </g>
        </g>

        <g className="home-categories__retail-depth home-categories__retail-depth--right" filter="url(#categoryBlurFar)">
          <path className="home-categories__shelf-curve home-categories__shelf-curve--right" d="M1690 276C1506 220 1324 228 1092 302" />
          <path className="home-categories__shelf-curve home-categories__shelf-curve--right home-categories__shelf-curve--lower" d="M1702 420C1498 366 1322 374 1110 436" />
          <g transform="translate(1262 194)">
            <g fill="url(#categoryProductViolet)" transform="translate(0 6)">
              <rect height="15" rx="5" width="23" x="12" y="0" />
              <rect height="68" rx="17" width="48" x="0" y="14" />
            </g>
            <rect fill="url(#categoryProductWhite)" height="62" rx="12" width="50" x="64" y="22" />
            <rect fill="url(#categoryProductBlue)" height="76" rx="13" width="58" x="128" y="8" />
            <g fill="url(#categoryProductWhite)" transform="translate(204 18)">
              <rect height="13" rx="4" width="21" x="11" y="0" />
              <rect height="52" rx="14" width="44" x="0" y="12" />
            </g>
          </g>
          <g transform="translate(1308 342)">
            <rect fill="url(#categoryProductBlue)" height="68" rx="13" width="58" x="0" y="10" />
            <g fill="url(#categoryProductWhite)" transform="translate(72 8)">
              <rect height="14" rx="5" width="22" x="12" y="0" />
              <rect height="58" rx="15" width="46" x="0" y="13" />
            </g>
            <rect fill="url(#categoryProductViolet)" height="72" rx="13" width="62" x="138" y="6" />
            <rect fill="url(#categoryProductWhite)" height="54" rx="11" width="50" x="214" y="24" />
          </g>
        </g>

        <g className="home-categories__retail-near home-categories__retail-near--right" filter="url(#categoryBlurMid)">
          <path className="home-categories__shelf-near home-categories__shelf-near--right" d="M1740 166C1518 94 1340 108 1164 188" />
          <path className="home-categories__shelf-near home-categories__shelf-near--right home-categories__shelf-near--lower" d="M1756 516C1544 450 1368 462 1182 532" />
          <g transform="translate(1384 82)">
            <rect fill="url(#categoryProductViolet)" height="94" rx="17" width="74" x="0" y="12" />
            <g fill="url(#categoryProductBlue)" transform="translate(92 18)">
              <rect height="16" rx="5" width="24" x="13" y="0" />
              <rect height="74" rx="18" width="50" x="0" y="15" />
            </g>
            <g fill="url(#categoryProductWhite)" transform="translate(160 2)">
              <rect height="18" rx="5" width="27" x="14" y="0" />
              <rect height="88" rx="19" width="56" x="0" y="17" />
            </g>
          </g>
          <g className="home-categories__retail-podiums" transform="translate(1324 592)">
            <rect className="home-categories__retail-podium--light" height="126" rx="26" width="120" x="0" y="96" />
            <rect className="home-categories__retail-podium--violet" height="170" rx="30" width="132" x="104" y="52" />
            <rect height="204" rx="34" width="148" x="218" y="18" />
          </g>
          <g className="home-categories__retail-leaves home-categories__retail-leaves--right" transform="translate(1368 546)">
            <path d="M0 82C12 32 40 6 84 0C76 48 50 76 0 82Z" />
            <path d="M52 92C72 46 102 28 142 36C124 76 94 96 52 92Z" />
          </g>
        </g>

        <g className="home-categories__floor" filter="url(#categoryBlurNear)">
          <path d="M-80 690C286 604 560 620 824 704C1068 780 1302 776 1680 670L1680 860L-80 860Z" fill="url(#categoryFloorBlue)" />
          <path d="M-80 752C244 666 536 668 828 748C1100 822 1378 812 1680 716L1680 860L-80 860Z" fill="url(#categoryFloorViolet)" />
        </g>

        <rect
          className="home-categories__center-wash"
          fill="url(#categoryCenterWash)"
          height="820"
          width="1600"
          x="0"
          y="0"
        />
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
