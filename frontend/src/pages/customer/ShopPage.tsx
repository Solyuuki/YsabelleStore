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
                <stop offset="50%" stopColor="var(--shop-catalog-line-center)" />
                <stop offset="100%" stopColor="var(--shop-catalog-line-violet)" />
              </linearGradient>
              <linearGradient id="shopCatalogFadeFromHero" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--shop-catalog-hero-surface)" stopOpacity="1" />
                <stop offset="100%" stopColor="var(--shop-catalog-hero-surface)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="shopCatalogFadeToFooter" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--shop-catalog-footer-surface)" stopOpacity="0" />
                <stop offset="100%" stopColor="var(--shop-catalog-footer-surface)" stopOpacity="1" />
              </linearGradient>
            </defs>

            <rect fill="var(--shop-catalog-surface)" height="2400" width="1600" />

            <ellipse cx="-10" cy="390" fill="var(--shop-catalog-blue-glow)" opacity="0.64" rx="470" ry="560" />
            <ellipse cx="1570" cy="565" fill="var(--shop-catalog-violet-glow)" opacity="0.58" rx="470" ry="610" />
            <ellipse cx="90" cy="1330" fill="var(--shop-catalog-blue-glow)" opacity="0.42" rx="430" ry="610" />
            <ellipse cx="1515" cy="1500" fill="var(--shop-catalog-violet-glow)" opacity="0.40" rx="450" ry="620" />
            <ellipse cx="120" cy="2220" fill="var(--shop-catalog-blue-glow)" opacity="0.46" rx="500" ry="440" />
            <ellipse cx="1480" cy="2200" fill="var(--shop-catalog-violet-glow)" opacity="0.50" rx="500" ry="460" />

            <path d="M0 70C210 150 395 155 585 118C780 80 950 38 1135 82C1315 125 1465 165 1600 128V410C1435 452 1270 420 1092 390C895 356 718 386 520 430C325 472 152 452 0 382Z" fill="url(#shopCatalogWash)" opacity="0.47" />
            <path d="M0 315C190 250 365 290 545 410C720 528 890 555 1075 500C1260 446 1422 388 1600 430V735C1420 700 1240 752 1062 810C870 872 690 805 522 700C350 592 185 558 0 632Z" fill="url(#shopCatalogWash)" opacity="0.34" />
            <path d="M0 720C175 642 340 674 515 790C695 910 875 944 1055 888C1245 830 1415 762 1600 808V1095C1415 1055 1240 1110 1058 1164C870 1220 700 1160 530 1058C350 950 180 915 0 985Z" fill="url(#shopCatalogWash)" opacity="0.29" />
            <path d="M0 1110C198 1030 370 1070 548 1190C730 1312 895 1348 1075 1290C1250 1232 1410 1168 1600 1210V1515C1415 1482 1240 1538 1058 1598C870 1660 695 1602 525 1492C350 1380 178 1348 0 1420Z" fill="url(#shopCatalogWash)" opacity="0.27" />
            <path d="M0 1520C210 1428 382 1476 558 1618C728 1755 900 1788 1085 1708C1262 1630 1418 1550 1600 1612V1905C1405 1840 1230 1912 1042 1974C850 2038 680 1972 518 1848C345 1715 175 1675 0 1750Z" fill="url(#shopCatalogWash)" opacity="0.33" />
            <path d="M0 1910C220 1815 400 1875 572 2018C742 2158 915 2190 1090 2110C1268 2028 1418 1962 1600 2030V2320C1405 2262 1225 2328 1038 2378H0Z" fill="url(#shopCatalogWash)" opacity="0.42" />

            <path d="M-40 152C205 22 420 64 650 202C875 338 1080 312 1288 188C1440 98 1538 82 1640 112" fill="none" stroke="url(#shopCatalogLine)" strokeLinecap="round" strokeWidth="2.4" opacity="0.58" />
            <path d="M-55 208C188 78 418 126 635 256C848 383 1050 364 1260 242C1410 155 1530 138 1645 170" fill="none" stroke="url(#shopCatalogLine)" strokeLinecap="round" strokeWidth="1.5" opacity="0.34" />
            <path d="M-65 610C168 468 390 492 598 638C806 784 1010 790 1210 652C1380 536 1505 520 1660 560" fill="none" stroke="url(#shopCatalogLine)" strokeLinecap="round" strokeWidth="2" opacity="0.44" />
            <path d="M-70 1000C175 852 402 874 608 1025C812 1173 1015 1175 1212 1038C1385 918 1510 900 1660 942" fill="none" stroke="url(#shopCatalogLine)" strokeLinecap="round" strokeWidth="1.8" opacity="0.38" />
            <path d="M-55 1398C180 1258 398 1280 605 1424C812 1568 1015 1570 1212 1436C1385 1320 1510 1300 1660 1345" fill="none" stroke="url(#shopCatalogLine)" strokeLinecap="round" strokeWidth="2" opacity="0.42" />
            <path d="M-45 1770C180 1638 392 1660 592 1798C798 1938 996 1942 1188 1822C1375 1704 1490 1690 1650 1738" fill="none" stroke="url(#shopCatalogLine)" strokeLinecap="round" strokeWidth="2.1" opacity="0.48" />
            <path d="M-35 2135C195 2010 412 2040 610 2160C818 2285 1024 2280 1220 2174C1398 2078 1510 2075 1640 2110" fill="none" stroke="url(#shopCatalogLine)" strokeLinecap="round" strokeWidth="1.8" opacity="0.38" />

            <g fill="var(--shop-catalog-sparkle)" opacity="0.44">
              <circle cx="132" cy="338" r="7" />
              <circle cx="1460" cy="468" r="8" />
              <circle cx="208" cy="910" r="6" />
              <circle cx="1388" cy="1268" r="8" />
              <circle cx="278" cy="1720" r="7" />
              <circle cx="1332" cy="1998" r="6" />
              <circle cx="120" cy="2195" r="8" />
              <path d="M224 205L231 220L246 227L231 234L224 249L217 234L202 227L217 220Z" />
              <path d="M1430 952L1437 967L1452 974L1437 981L1430 996L1423 981L1408 974L1423 967Z" />
              <path d="M365 1650L372 1665L387 1672L372 1679L365 1694L358 1679L343 1672L358 1665Z" />
              <path d="M1328 2220L1335 2235L1350 2242L1335 2249L1328 2264L1321 2249L1306 2242L1321 2235Z" />
            </g>

            <rect fill="url(#shopCatalogFadeFromHero)" height="240" width="1600" />
            <rect fill="url(#shopCatalogFadeToFooter)" height="300" width="1600" x="0" y="2100" />
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
