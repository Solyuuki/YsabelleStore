import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";

import { CustomerLink } from "@/components/customer/CustomerLink";
import { ProductCard } from "@/components/customer/ProductCard";
import { useRevealOnView } from "@/hooks/useRevealOnView";
import { fetchStorefrontCategories, fetchStorefrontProducts } from "@/services/storefrontService";
import type {
  StorefrontCategory,
  StorefrontPagination,
  StorefrontProduct
} from "@/types/storefront";

const SEARCH_DEBOUNCE_MS = 350;
type AvailabilityFilter = "all" | "in-stock" | "out-of-stock";

export function ShopPage({
  categorySlug,
  location,
  navigate
}: {
  categorySlug?: string;
  location: string;
  navigate: (path: string) => void;
}) {
  const params = new URL(location, window.location.origin).searchParams;
  const searchParam = params.get("search") ?? "";
  const availabilityParam: AvailabilityFilter =
    params.get("availability") === "out-of-stock"
      ? "out-of-stock"
      : params.get("availability") === "in-stock"
        ? "in-stock"
        : "all";
  const pageParam = Math.max(1, Number(params.get("page")) || 1);
  const [search, setSearch] = useState(searchParam);
  const [categories, setCategories] = useState<StorefrontCategory[]>([]);
  const [products, setProducts] = useState<StorefrontProduct[]>([]);
  const [meta, setMeta] = useState<StorefrontPagination>({
    page: 1,
    pageSize: 24,
    totalItems: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const introReveal = useRevealOnView<HTMLElement>({
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.2
  });
  const categoryNavigationReveal = useRevealOnView<HTMLElement>({
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.18
  });
  const controlsReveal = useRevealOnView<HTMLFormElement>({
    rootMargin: "0px 0px -12% 0px",
    threshold: 0.2
  });
  const resultsMetaReveal = useRevealOnView<HTMLDivElement>({
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.18
  });

  useEffect(() => {
    setSearch(searchParam);
  }, [searchParam]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    Promise.all([
      fetchStorefrontCategories(controller.signal),
      fetchStorefrontProducts(
        {
          search: searchParam,
          category: categorySlug,
          availability: availabilityParam,
          page: pageParam,
          pageSize: 24
        },
        controller.signal
      )
    ])
      .then(([nextCategories, result]) => {
        setCategories(nextCategories);
        setProducts(result.items);
        setMeta(result.meta);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "Products could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [availabilityParam, categorySlug, pageParam, searchParam]);

  const activeCategory = categories.find((category) => category.slug === categorySlug);

  const buildShopUrl = useCallback(
    (
      values: { search?: string; availability?: string; page?: number },
      slug: string | null | undefined = categorySlug
    ) => {
      const next = new URLSearchParams();
      const nextSearch = values.search ?? searchParam;
      const nextAvailability = values.availability ?? availabilityParam;
      if (nextSearch) next.set("search", nextSearch);
      if (nextAvailability !== "all") next.set("availability", nextAvailability);
      if ((values.page ?? 1) > 1) next.set("page", String(values.page));
      const base = slug ? `/shop/category/${slug}` : "/shop";
      return `${base}${next.size ? `?${next}` : ""}`;
    },
    [availabilityParam, categorySlug, searchParam]
  );

  useEffect(() => {
    const normalizedSearch = search.trim();
    if (normalizedSearch === searchParam) return;

    const timeout = window.setTimeout(() => {
      navigate(
        buildShopUrl({ search: normalizedSearch, availability: availabilityParam, page: 1 })
      );
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [availabilityParam, buildShopUrl, navigate, search, searchParam]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedSearch = search.trim();
    if (normalizedSearch === searchParam && pageParam === 1) return;
    navigate(buildShopUrl({ search: normalizedSearch, availability: availabilityParam, page: 1 }));
  }

  function applyAvailability(nextAvailability: AvailabilityFilter) {
    navigate(buildShopUrl({ search: search.trim(), availability: nextAvailability, page: 1 }));
  }

  return (
    <div className="customer-page customer-shop-page">
      <section
        className={`customer-shop-heading shop-motion-intro ${introReveal.isVisible ? "is-visible" : ""}`}
        ref={introReveal.ref}
      >
        <div aria-hidden="true" className="customer-shop-heading__backdrop">
          <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1600 420">
            <defs>
              <linearGradient id="shopHeroWaveBlue" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--shop-hero-blue)" />
                <stop offset="100%" stopColor="var(--shop-hero-blue-soft)" />
              </linearGradient>
              <linearGradient id="shopHeroWaveViolet" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--shop-hero-violet-soft)" />
                <stop offset="100%" stopColor="var(--shop-hero-violet)" />
              </linearGradient>
            </defs>
            <path
              d="M0 262C220 312 420 302 620 252C820 204 1010 222 1190 275C1350 322 1470 318 1600 282V420H0Z"
              fill="url(#shopHeroWaveBlue)"
              opacity="0.34"
            />
            <path
              d="M0 330C230 274 430 292 630 342C820 390 1000 365 1170 318C1350 269 1490 279 1600 308V420H0Z"
              fill="url(#shopHeroWaveViolet)"
              opacity="0.28"
            />
            <path
              d="M-40 188C210 365 480 384 760 292C1000 214 1220 224 1640 94"
              fill="none"
              stroke="var(--shop-hero-line)"
              strokeLinecap="round"
              strokeWidth="2.4"
              opacity="0.72"
            />
            <path
              d="M20 112C220 182 250 302 520 318C780 334 980 180 1240 132C1390 104 1515 118 1620 152"
              fill="none"
              stroke="var(--shop-hero-line)"
              strokeLinecap="round"
              strokeWidth="1.7"
              opacity="0.5"
            />
            <g fill="var(--shop-hero-sparkle)" opacity="0.7">
              <circle cx="82" cy="230" r="7" />
              <circle cx="1385" cy="215" r="9" />
              <circle cx="1260" cy="145" r="6" />
              <path d="M176 177L182 190L195 196L182 202L176 215L170 202L157 196L170 190Z" />
              <path d="M1450 92L1456 105L1469 111L1456 117L1450 130L1444 117L1431 111L1444 105Z" />
            </g>
          </svg>
        </div>
        <div className="customer-container">
          <p className="customer-kicker shop-motion-intro__eyebrow">The grocery aisle, online</p>
          <h1 className="shop-motion-intro__title">
            {activeCategory?.name ?? "Shop Everyday Essentials"}
          </h1>
          <p className="shop-motion-intro__description">
            {activeCategory?.description ??
              "Search the live Ysabelle's Store catalog and add what you need."}
          </p>
        </div>
      </section>
      <div className="customer-container customer-shop-layout">
        <div aria-hidden="true" className="customer-shop-catalog-backdrop">
          <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1600 2400">
            <defs>
              <linearGradient id="shopCatalogWash" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--shop-catalog-blue)" />
                <stop offset="52%" stopColor="var(--shop-catalog-center)" />
                <stop offset="100%" stopColor="var(--shop-catalog-violet)" />
              </linearGradient>
              <linearGradient id="shopCatalogLine" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="var(--shop-catalog-line-blue)" />
                <stop offset="52%" stopColor="var(--shop-catalog-line-center)" />
                <stop offset="100%" stopColor="var(--shop-catalog-line-violet)" />
              </linearGradient>
            </defs>

            <rect fill="var(--shop-catalog-surface)" height="2400" width="1600" />

            <path
              d="M0 70C210 135 390 160 575 128C760 96 915 42 1110 70C1300 97 1450 150 1600 122V560C1430 590 1260 535 1080 520C850 502 700 575 500 592C315 607 150 565 0 505Z"
              fill="url(#shopCatalogWash)"
              opacity="0.31"
            />

            <path
              d="M0 730C180 620 345 642 515 760C680 875 825 925 1010 865C1200 803 1370 690 1600 746V1230C1390 1190 1220 1280 1040 1332C840 1390 650 1298 505 1195C340 1080 190 1038 0 1135Z"
              fill="url(#shopCatalogWash)"
              opacity="0.20"
            />

            <path
              d="M0 1550C210 1460 365 1518 545 1660C705 1787 875 1825 1055 1740C1240 1652 1390 1560 1600 1625V2210C1400 2135 1220 2225 1025 2288C830 2352 650 2260 500 2140C330 2005 175 1960 0 2050Z"
              fill="url(#shopCatalogWash)"
              opacity="0.23"
            />

            <path
              d="M-40 260C210 72 425 112 650 245C875 378 1070 335 1285 205C1435 114 1535 92 1640 122"
              fill="none"
              stroke="url(#shopCatalogLine)"
              strokeLinecap="round"
              strokeWidth="2.2"
              opacity="0.58"
            />

            <path
              d="M-70 1020C180 840 410 860 610 1010C815 1165 1020 1162 1210 1018C1380 888 1500 866 1660 912"
              fill="none"
              stroke="url(#shopCatalogLine)"
              strokeLinecap="round"
              strokeWidth="1.8"
              opacity="0.42"
            />

            <path
              d="M-40 1870C170 1710 390 1738 585 1878C785 2022 980 2028 1170 1905C1365 1780 1495 1765 1650 1812"
              fill="none"
              stroke="url(#shopCatalogLine)"
              strokeLinecap="round"
              strokeWidth="2"
              opacity="0.48"
            />

            <g fill="var(--shop-catalog-sparkle)" opacity="0.58">
              <circle cx="120" cy="390" r="8" />
              <circle cx="1450" cy="510" r="7" />
              <circle cx="210" cy="1260" r="6" />
              <circle cx="1388" cy="1480" r="9" />
              <circle cx="280" cy="2120" r="7" />
              <circle cx="1325" cy="2180" r="6" />
              <path d="M230 235L237 250L252 257L237 264L230 279L223 264L208 257L223 250Z" />
              <path d="M1420 1110L1427 1125L1442 1132L1427 1139L1420 1154L1413 1139L1398 1132L1413 1125Z" />
              <path d="M360 1788L367 1803L382 1810L367 1817L360 1832L353 1817L338 1810L353 1803Z" />
            </g>

            <rect
              fill="url(#shopCatalogFadeToFooter)"
              height="260"
              width="1600"
              x="0"
              y="2140"
            />

            <defs>
              <linearGradient id="shopCatalogFadeToFooter" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--shop-catalog-footer-surface)" stopOpacity="0" />
                <stop offset="100%" stopColor="var(--shop-catalog-footer-surface)" stopOpacity="1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <aside
          aria-label="Shop filters"
          className={`customer-filter-panel shop-category-navigation ${categoryNavigationReveal.isVisible ? "is-visible" : ""}`}
          id="categories"
          ref={categoryNavigationReveal.ref}
        >
          <div className="customer-filter-panel__title">
            <SlidersHorizontal aria-hidden="true" size={18} />
            <h2>Browse</h2>
          </div>
          <CustomerLink
            className={!categorySlug ? "is-active" : ""}
            href={buildShopUrl({ page: 1 }, null)}
            navigate={navigate}
            style={{ "--shop-navigation-index": 0 } as CSSProperties}
          >
            All categories
          </CustomerLink>
          {categories.map((category, index) => (
            <CustomerLink
              className={category.slug === categorySlug ? "is-active" : ""}
              href={buildShopUrl({ page: 1 }, category.slug)}
              key={category.id}
              navigate={navigate}
              style={{ "--shop-navigation-index": index + 1 } as CSSProperties}
            >
              <span>{category.name}</span>
              <small>{category.productCount}</small>
            </CustomerLink>
          ))}
        </aside>

        <section className="customer-shop-results" aria-labelledby="shop-results-title">
          <form
            className={`customer-shop-toolbar shop-motion-controls ${controlsReveal.isVisible ? "is-visible" : ""}`}
            onSubmit={submit}
            ref={controlsReveal.ref}
            role="search"
          >
            <label className="customer-shop-search">
              <Search aria-hidden="true" size={18} />
              <span className="sr-only">Search products</span>
              <input
                autoComplete="off"
                maxLength={120}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products or categories"
                type="search"
                value={search}
              />
            </label>
            <label className="customer-select">
              <span className="sr-only">Availability</span>
              <select
                onChange={(event) => applyAvailability(event.target.value as AvailabilityFilter)}
                value={availabilityParam}
              >
                <option value="all">All availability</option>
                <option value="in-stock">In stock</option>
                <option value="out-of-stock">Out of stock</option>
              </select>
            </label>
          </form>
          <div
            className={`customer-results-meta shop-motion-results-meta ${resultsMetaReveal.isVisible ? "is-visible" : ""}`}
            ref={resultsMetaReveal.ref}
          >
            <div>
              <h2 id="shop-results-title">
                {searchParam
                  ? `Results for “${searchParam}”`
                  : (activeCategory?.name ?? "All products")}
              </h2>
              <p aria-live="polite">
                {loading
                  ? "Checking the shelves..."
                  : `${meta.totalItems} product${meta.totalItems === 1 ? "" : "s"}`}
              </p>
            </div>
            {searchParam || categorySlug || availabilityParam !== "all" ? (
              <CustomerLink href="/shop" navigate={navigate}>
                Clear filters
              </CustomerLink>
            ) : null}
          </div>

          {error ? (
            <div className="customer-empty-state">
              <h3>We Could Not Load the Shop</h3>
              <p>{error}</p>
              <button
                className="customer-button"
                onClick={() => window.location.reload()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : null}
          {!error && loading ? (
            <div className="customer-product-grid customer-product-grid--loading">
              {Array.from({ length: 8 }, (_, index) => (
                <div className="customer-product-skeleton" key={index} />
              ))}
            </div>
          ) : null}
          {!error && !loading && products.length ? (
            <ShopProductGrid navigate={navigate} products={products} />
          ) : null}
          {!error && !loading && !products.length ? (
            <div className="customer-empty-state">
              <Search aria-hidden="true" size={34} />
              <h3>No Products Matched</h3>
              <p>Try a broader search or clear the current filters.</p>
              <CustomerLink className="customer-button" href="/shop" navigate={navigate}>
                View all products
              </CustomerLink>
            </div>
          ) : null}

          {meta.totalPages > 1 ? (
            <nav aria-label="Product pages" className="customer-pagination">
              <button
                disabled={meta.page <= 1}
                onClick={() => navigate(buildShopUrl({ page: meta.page - 1 }))}
                type="button"
              >
                <ArrowLeft aria-hidden="true" size={16} /> Previous
              </button>
              <span>
                Page {meta.page} of {meta.totalPages}
              </span>
              <button
                disabled={meta.page >= meta.totalPages}
                onClick={() => navigate(buildShopUrl({ page: meta.page + 1 }))}
                type="button"
              >
                Next <ArrowRight aria-hidden="true" size={16} />
              </button>
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function ShopProductGrid({
  navigate,
  products
}: {
  navigate: (path: string) => void;
  products: StorefrontProduct[];
}) {
  return (
    <div className="customer-product-grid shop-product-grid is-visible">
      {products.map((product, index) => (
        <div
          className="shop-product-reveal"
          key={product.id}
          style={{ "--shop-product-index": Math.min(index, 5) } as CSSProperties}
        >
          <ProductCard navigate={navigate} product={product} />
        </div>
      ))}
    </div>
  );
}
