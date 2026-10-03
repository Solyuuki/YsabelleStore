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
        <div className="home-merchandising-canvas">
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
        </div>

        <HomeNextStep navigate={navigate} />
      </div>
    </div>
  );
}

function CategoryRetailBackdrop() {
  return (
    <div aria-hidden="true" className="home-categories__backdrop">
      <div className="home-categories__center-light" />

      <svg
        className="home-categories__scene home-categories__scene--left"
        focusable="false"
        preserveAspectRatio="xMinYMid slice"
        viewBox="0 0 420 760"
      >
        <defs>
          <linearGradient id="categoryLeftBlue" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--retail-object-light)" stopOpacity="0.82" />
            <stop offset="100%" stopColor="var(--retail-object-blue)" stopOpacity="0.48" />
          </linearGradient>
          <linearGradient id="categoryLeftViolet" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--retail-object-light)" stopOpacity="0.76" />
            <stop offset="100%" stopColor="var(--retail-object-violet)" stopOpacity="0.46" />
          </linearGradient>
          <filter id="categoryLeftBlurNear" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="categoryLeftBlurMid" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
          <filter id="categoryLeftBlurFar" x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="7.5" />
          </filter>
        </defs>

        <g className="home-categories__scene-far" filter="url(#categoryLeftBlurFar)">
          <path className="home-categories__ceiling-arc" d="M-70 104C54 24 214 10 458 108" />
          <path className="home-categories__ceiling-arc home-categories__ceiling-arc--soft" d="M-82 142C70 62 236 58 456 146" />
          <circle className="home-categories__ceiling-light" cx="116" cy="72" r="10" />
          <circle className="home-categories__ceiling-light" cx="258" cy="76" r="8" />

          <path className="home-categories__shelf-arc" d="M-94 282C44 224 214 220 456 310" />
          <path className="home-categories__shelf-arc home-categories__shelf-arc--lower" d="M-104 442C64 378 228 382 448 458" />

          <g className="home-categories__products home-categories__products--far" transform="translate(-6 180)">
            <rect fill="url(#categoryLeftBlue)" height="88" rx="18" width="62" x="0" y="20" />
            <g fill="url(#categoryLeftViolet)" transform="translate(82 2)">
              <rect height="18" rx="5" width="27" x="14" y="0" />
              <rect height="88" rx="20" width="56" x="0" y="17" />
            </g>
            <rect fill="url(#categoryLeftBlue)" height="76" rx="15" width="66" x="160" y="30" />
            <g fill="url(#categoryLeftViolet)" transform="translate(246 22)">
              <rect height="15" rx="5" width="24" x="13" y="0" />
              <rect height="70" rx="18" width="50" x="0" y="14" />
            </g>
          </g>

          <g className="home-categories__products home-categories__products--far" transform="translate(-24 344)">
            <g fill="url(#categoryLeftBlue)" transform="translate(0 10)">
              <rect height="17" rx="5" width="25" x="13" y="0" />
              <rect height="78" rx="18" width="52" x="0" y="16" />
            </g>
            <rect fill="url(#categoryLeftViolet)" height="90" rx="18" width="72" x="74" y="4" />
            <rect fill="url(#categoryLeftBlue)" height="70" rx="15" width="60" x="166" y="24" />
            <rect fill="url(#categoryLeftViolet)" height="82" rx="16" width="66" x="246" y="12" />
          </g>
        </g>

        <g className="home-categories__scene-mid" filter="url(#categoryLeftBlurMid)">
          <path className="home-categories__shelf-near" d="M-128 170C34 100 192 102 390 194" />
          <path className="home-categories__shelf-near home-categories__shelf-near--lower" d="M-142 548C34 476 202 482 390 560" />

          <g className="home-categories__products home-categories__products--near" transform="translate(-44 76)">
            <g fill="url(#categoryLeftBlue)" transform="translate(0 8)">
              <rect height="20" rx="6" width="30" x="15" y="0" />
              <rect height="102" rx="22" width="60" x="0" y="19" />
            </g>
            <rect fill="url(#categoryLeftViolet)" height="108" rx="20" width="84" x="82" y="16" />
            <g fill="url(#categoryLeftBlue)" transform="translate(188 28)">
              <rect height="16" rx="5" width="26" x="14" y="0" />
              <rect height="78" rx="19" width="54" x="0" y="15" />
            </g>
          </g>
        </g>

        <g className="home-categories__scene-near" filter="url(#categoryLeftBlurNear)">
          <g className="home-categories__podiums" transform="translate(-88 586)">
            <rect height="212" rx="38" width="154" x="0" y="18" />
            <rect className="home-categories__podium--violet" height="178" rx="34" width="140" x="126" y="52" />
            <rect className="home-categories__podium--light" height="128" rx="30" width="126" x="250" y="102" />
          </g>

          <g className="home-categories__leaves" transform="translate(34 536)">
            <path d="M0 90C12 34 42 5 90 0C82 52 54 82 0 90Z" />
            <path d="M54 102C76 52 108 32 152 40C132 84 100 108 54 102Z" />
          </g>

          <path className="home-categories__floor-ribbon" d="M-90 696C66 642 218 648 440 724L440 810L-90 810Z" />
          <path className="home-categories__floor-ribbon home-categories__floor-ribbon--violet" d="M-98 746C78 696 244 704 448 770L448 820L-98 820Z" />
        </g>
      </svg>

      <svg
        className="home-categories__scene home-categories__scene--right"
        focusable="false"
        preserveAspectRatio="xMaxYMid slice"
        viewBox="0 0 420 760"
      >
        <defs>
          <linearGradient id="categoryRightBlue" x1="1" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--retail-object-light)" stopOpacity="0.82" />
            <stop offset="100%" stopColor="var(--retail-object-blue)" stopOpacity="0.46" />
          </linearGradient>
          <linearGradient id="categoryRightViolet" x1="1" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--retail-object-light)" stopOpacity="0.76" />
            <stop offset="100%" stopColor="var(--retail-object-violet)" stopOpacity="0.48" />
          </linearGradient>
          <filter id="categoryRightBlurNear" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="categoryRightBlurMid" x="-35%" y="-35%" width="170%" height="170%">
            <feGaussianBlur stdDeviation="4.5" />
          </filter>
          <filter id="categoryRightBlurFar" x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="7.5" />
          </filter>
        </defs>

        <g className="home-categories__scene-far" filter="url(#categoryRightBlurFar)">
          <path className="home-categories__ceiling-arc" d="M-38 104C166 16 322 28 492 118" />
          <path className="home-categories__ceiling-arc home-categories__ceiling-arc--soft" d="M-36 146C150 66 316 72 504 158" />
          <circle className="home-categories__ceiling-light" cx="164" cy="76" r="8" />
          <circle className="home-categories__ceiling-light" cx="316" cy="72" r="10" />

          <path className="home-categories__shelf-arc" d="M-36 306C178 222 342 228 510 286" />
          <path className="home-categories__shelf-arc home-categories__shelf-arc--lower" d="M-30 458C176 382 340 380 520 434" />

          <g className="home-categories__products home-categories__products--far" transform="translate(82 184)">
            <g fill="url(#categoryRightViolet)" transform="translate(0 8)">
              <rect height="16" rx="5" width="25" x="13" y="0" />
              <rect height="76" rx="18" width="52" x="0" y="15" />
            </g>
            <rect fill="url(#categoryRightBlue)" height="82" rx="16" width="68" x="70" y="14" />
            <rect fill="url(#categoryRightViolet)" height="68" rx="14" width="58" x="158" y="28" />
            <g fill="url(#categoryRightBlue)" transform="translate(236 4)">
              <rect height="18" rx="5" width="27" x="14" y="0" />
              <rect height="88" rx="20" width="56" x="0" y="17" />
            </g>
          </g>

          <g className="home-categories__products home-categories__products--far" transform="translate(104 344)">
            <rect fill="url(#categoryRightBlue)" height="72" rx="15" width="62" x="0" y="20" />
            <g fill="url(#categoryRightViolet)" transform="translate(80 6)">
              <rect height="16" rx="5" width="25" x="13" y="0" />
              <rect height="80" rx="18" width="52" x="0" y="15" />
            </g>
            <rect fill="url(#categoryRightBlue)" height="88" rx="18" width="72" x="152" y="4" />
            <rect fill="url(#categoryRightViolet)" height="66" rx="14" width="58" x="244" y="26" />
          </g>
        </g>

        <g className="home-categories__scene-mid" filter="url(#categoryRightBlurMid)">
          <path className="home-categories__shelf-near" d="M18 194C218 100 374 102 546 170" />
          <path className="home-categories__shelf-near home-categories__shelf-near--lower" d="M22 560C210 482 378 476 558 548" />

          <g className="home-categories__products home-categories__products--near" transform="translate(164 78)">
            <rect fill="url(#categoryRightViolet)" height="106" rx="20" width="84" x="0" y="18" />
            <g fill="url(#categoryRightBlue)" transform="translate(106 26)">
              <rect height="16" rx="5" width="26" x="14" y="0" />
              <rect height="80" rx="19" width="54" x="0" y="15" />
            </g>
            <g fill="url(#categoryRightViolet)" transform="translate(184 6)">
              <rect height="20" rx="6" width="30" x="15" y="0" />
              <rect height="102" rx="22" width="60" x="0" y="19" />
            </g>
          </g>
        </g>

        <g className="home-categories__scene-near" filter="url(#categoryRightBlurNear)">
          <g className="home-categories__podiums" transform="translate(74 584)">
            <rect className="home-categories__podium--light" height="132" rx="30" width="126" x="0" y="100" />
            <rect className="home-categories__podium--violet" height="180" rx="34" width="140" x="110" y="52" />
            <rect height="214" rx="38" width="156" x="232" y="18" />
          </g>

          <g className="home-categories__leaves home-categories__leaves--right" transform="translate(230 530)">
            <path d="M0 96C14 38 46 7 96 0C88 56 58 88 0 96Z" />
            <path d="M58 108C80 56 114 34 160 44C140 90 106 114 58 108Z" />
          </g>

          <path className="home-categories__floor-ribbon" d="M-26 724C194 648 346 642 510 696L510 812L-26 812Z" />
          <path className="home-categories__floor-ribbon home-categories__floor-ribbon--violet" d="M-30 770C174 704 340 696 518 746L518 822L-30 822Z" />
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
