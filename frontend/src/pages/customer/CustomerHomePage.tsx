import { ArrowRight, MapPin, ShieldCheck, ShoppingBasket, Truck } from "lucide-react";
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
        <div aria-hidden="true" className="home-category-merch-handoff" />
        <div className="home-merchandising-canvas">
          <MerchandisingBackdrop />
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

function MerchandisingBackdrop() {
  return (
    <div aria-hidden="true" className="home-merchandising-canvas__backdrop">
      <svg
        className="home-merchandising-canvas__scene"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 1600 2400"
      >
        <defs>
          <linearGradient id="merchVerticalBase" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--merch-bg-top)" />
            <stop offset="48%" stopColor="var(--merch-bg-mid)" />
            <stop offset="100%" stopColor="var(--merch-bg-bottom)" />
          </linearGradient>

          <linearGradient id="merchTopBlue" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--merch-wave-blue)" stopOpacity="0.34" />
            <stop offset="58%" stopColor="var(--merch-wave-indigo)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--merch-wave-violet)" stopOpacity="0.1" />
          </linearGradient>

          <linearGradient id="merchTopViolet" x1="1" x2="0" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--merch-wave-violet)" stopOpacity="0.28" />
            <stop offset="58%" stopColor="var(--merch-wave-indigo)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--merch-wave-blue)" stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id="merchBottomBlue" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--merch-wave-blue)" stopOpacity="0.22" />
            <stop offset="58%" stopColor="var(--merch-wave-indigo)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--merch-wave-violet)" stopOpacity="0.18" />
          </linearGradient>

          <linearGradient id="merchBottomViolet" x1="1" x2="0" y1="0" y2="0">
            <stop offset="0%" stopColor="var(--merch-wave-violet)" stopOpacity="0.3" />
            <stop offset="52%" stopColor="var(--merch-wave-indigo)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--merch-wave-blue)" stopOpacity="0.1" />
          </linearGradient>

          <radialGradient id="merchGlowBlue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--merch-wave-blue)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--merch-wave-blue)" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="merchGlowViolet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--merch-wave-violet)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--merch-wave-violet)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect fill="url(#merchVerticalBase)" height="2400" width="1600" />

        <g className="home-merchandising-canvas__waves home-merchandising-canvas__waves--top">
          <path
            d="M0 0H1600V190C1370 128 1170 132 956 208C688 302 414 300 0 154Z"
            fill="url(#merchTopBlue)"
          />
          <path
            d="M0 126C286 216 514 232 754 172C1038 102 1304 88 1600 150V322C1330 270 1094 280 862 346C562 430 278 408 0 300Z"
            fill="url(#merchTopViolet)"
          />
          <path
            d="M0 318C294 390 526 386 766 316C1054 232 1316 250 1600 344V430C1324 360 1080 370 832 438C520 524 252 492 0 410Z"
            fill="var(--merch-wave-white)"
            opacity="0.54"
          />
          <path
            className="home-merchandising-canvas__highlight"
            d="M0 300C320 390 566 374 812 308C1076 236 1322 250 1600 330"
          />
        </g>

        <g className="home-merchandising-canvas__mid-glow">
          <ellipse cx="118" cy="790" fill="url(#merchGlowBlue)" rx="360" ry="430" />
          <ellipse cx="1512" cy="1160" fill="url(#merchGlowViolet)" rx="420" ry="500" />
          <ellipse cx="80" cy="1520" fill="url(#merchGlowBlue)" rx="300" ry="360" />
        </g>

        <g className="home-merchandising-canvas__waves home-merchandising-canvas__waves--bottom">
          <path
            d="M0 1614C268 1534 530 1550 792 1644C1074 1746 1326 1732 1600 1638V1812C1312 1728 1080 1752 842 1848C548 1968 290 1948 0 1850Z"
            fill="url(#merchBottomBlue)"
          />
          <path
            d="M0 1830C252 1916 490 1932 742 1870C1012 1804 1266 1810 1600 1904V2094C1292 2020 1054 2034 808 2118C526 2214 264 2194 0 2106Z"
            fill="url(#merchBottomViolet)"
          />
          <path
            d="M0 2070C284 2150 542 2170 816 2110C1098 2048 1348 2056 1600 2136V2286C1328 2216 1084 2234 820 2314C520 2404 256 2386 0 2302Z"
            fill="var(--merch-wave-white)"
            opacity="0.5"
          />
          <path
            d="M0 2244C286 2324 542 2344 820 2280C1088 2218 1334 2230 1600 2310V2400H0Z"
            fill="url(#merchBottomBlue)"
            opacity="0.68"
          />
          <path
            className="home-merchandising-canvas__highlight"
            d="M0 2074C286 2154 542 2172 816 2112C1096 2050 1348 2058 1600 2138"
          />
        </g>

        <g className="home-merchandising-canvas__sparkles">
          <circle cx="112" cy="210" r="10" />
          <circle cx="1454" cy="284" r="8" />
          <circle cx="118" cy="1130" r="7" />
          <circle cx="1486" cy="1470" r="9" />
          <circle cx="146" cy="2128" r="8" />
          <circle cx="1434" cy="2260" r="10" />
        </g>
      </svg>
      {/* Galaxy-style editorial backdrop for the ONE shared merchandising canvas.
          This viewBox preserves proportion; the CSS supplies full-bleed color continuity. */}
      <svg
        className="home-merchandising-canvas__cosmos"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 1024 1536"
      >
        <defs>
          <radialGradient id="ysCosmicTopNebula">
            <stop offset="0%" stopColor="#4E60B9" stopOpacity="0.34" />
            <stop offset="50%" stopColor="#6D52BA" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#423D89" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ysCosmicLowerNebula">
            <stop offset="0%" stopColor="#8551C1" stopOpacity="0.33" />
            <stop offset="58%" stopColor="#51459C" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#353780" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ysCosmicBlueNebula">
            <stop offset="0%" stopColor="#3B6ABF" stopOpacity="0.23" />
            <stop offset="100%" stopColor="#254486" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="205" cy="155" rx="430" ry="320" fill="url(#ysCosmicTopNebula)" />
        <ellipse cx="240" cy="1325" rx="430" ry="400" fill="url(#ysCosmicLowerNebula)" />
        <ellipse cx="920" cy="1110" rx="250" ry="390" fill="url(#ysCosmicBlueNebula)" />
        {/* Decorative pinpoints are deterministic so the constellation never re-shuffles. */}
        {Array.from({ length: 156 }, (_, index) => {
          const a = (index * 3187 + index * index * 73 + 61) % 1009;
          const b = (index * 2269 + index * index * 131 + 257) % 1531;
          const x = 1024 - (index % 4 === 0 ? 650 + (a % 350) : index % 4 === 1 ? 20 + (a % 970) : index % 4 === 2 ? 750 + (a % 260) : a);
          const y = index % 4 === 0 ? b % 340 : index % 4 === 2 ? 1000 + (b % 530) : b;
          const centerQuiet = x > 255 && x < 845 && y > 310 && y < 1130;
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r={index % 17 === 0 ? 2.25 : index % 7 === 0 ? 1.35 : 0.75}
              fill={index % 3 === 0 ? "#AABFFF" : index % 3 === 1 ? "#C5A6FF" : "#D7E4FF"}
              opacity={centerQuiet ? 0.13 : index % 9 === 0 ? 0.63 : 0.32}
            />
          );
        })}

        <g fill="none" strokeLinecap="round">
          <circle cx="-120" cy="120" r="258" stroke="#A28CEB" strokeOpacity="0.32" strokeWidth="1.1" />
          <circle cx="-120" cy="120" r="327" stroke="#8899EA" strokeOpacity="0.12" strokeWidth="0.9" />
          <circle cx="-110" cy="1415" r="372" stroke="#B18CEB" strokeOpacity="0.39" strokeWidth="1.2" />
          <circle cx="-110" cy="1415" r="455" stroke="#8E7ED4" strokeOpacity="0.15" strokeWidth="0.85" />
        </g>
        <g fill="#A88DE9" opacity="0.66">
          <circle cx="165" cy="210" r="7" />
          <circle cx="240" cy="1278" r="7" />
          <circle cx="248" cy="132" r="3.6" />
          <circle cx="318" cy="1326" r="3.2" />
        </g>
        <g fill="none" stroke="#B3C9FF" strokeLinecap="round" strokeOpacity="0.6">
          <path d="M184 118v16M176 126h16M318 246v12M312 252h12" strokeWidth="1.1" />
          <path d="M158 1362v16M150 1370h16M344 1390v12M338 1396h12" strokeWidth="0.9" />
        </g>
      </svg>
    </div>
  );
}

function CategoryRetailBackdrop() {
  return (
    <div aria-hidden="true" className="home-categories__backdrop">
      <div className="home-categories__center-light" />

      {/* Dark-mode-only vector ornaments. Geometry stays sharp at every viewport size. */}
      <svg
        className="home-categories__dark-ornament"
        focusable="false"
        preserveAspectRatio="xMidYMin meet"
        viewBox="0 0 1600 900"
      >
        <defs>
          <linearGradient id="categoryDarkBlueStroke" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#75A9F4" stopOpacity="0.3" />
            <stop offset="65%" stopColor="#5884DA" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#637FDB" stopOpacity="0.15" />
          </linearGradient>
          <linearGradient id="categoryDarkVioletStroke" x1="1" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#C084F6" stopOpacity="0.55" />
            <stop offset="75%" stopColor="#8669D4" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#735DCE" stopOpacity="0.12" />
          </linearGradient>
          <linearGradient id="categoryDarkBottomStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#5991E2" stopOpacity="0.36" />
            <stop offset="55%" stopColor="#6374DC" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#BD76E7" stopOpacity="0.48" />
          </linearGradient>
        </defs>
        <g fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke">
          <path d="M-85 322C164 274 281 117 334 -82" stroke="url(#categoryDarkBlueStroke)" strokeWidth="1.5" />
          <path d="M-108 366C178 288 312 104 368 -84" stroke="#709EE9" strokeOpacity="0.11" strokeWidth="1" />
          <path d="M1700 288C1508 354 1390 485 1366 846" stroke="url(#categoryDarkVioletStroke)" strokeWidth="1.5" />
          <path d="M1740 339C1512 405 1455 531 1437 864" stroke="#AC8BE7" strokeOpacity="0.12" strokeWidth="1" />
          <path d="M-80 700C228 724 428 839 806 829C1129 818 1364 760 1680 686" stroke="url(#categoryDarkBottomStroke)" strokeWidth="1.5" />
          <path d="M-70 742C239 784 495 872 822 865C1137 856 1442 785 1670 733" stroke="#8092E6" strokeOpacity="0.09" strokeWidth="1" />
        </g>
        <g>
          <circle cx="302" cy="177" r="6" fill="#95A3FF" fillOpacity="0.62" />
          <circle cx="198" cy="245" r="4" fill="#618CE9" fillOpacity="0.28" />
          <circle cx="111" cy="305" r="4" fill="#739FFF" fillOpacity="0.46" />
          <circle cx="1494" cy="279" r="6" fill="#AE78EE" fillOpacity="0.62" />
          <circle cx="1425" cy="345" r="4" fill="#926BE0" fillOpacity="0.28" />
        </g>
      </svg>

      <svg
        className="home-categories__portal-scene"
        focusable="false"
        preserveAspectRatio="none"
        viewBox="0 0 1600 900"
      >
        <defs>
          <linearGradient id="categoryPortalBlue" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--category-portal-blue)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--category-portal-indigo)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="categoryPortalViolet" x1="1" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--category-portal-violet)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--category-portal-indigo)" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="categoryHandoff" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#7fc7ff" stopOpacity="0.16" />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#c89cff" stopOpacity="0.16" />
          </linearGradient>
          <radialGradient id="categoryPortalGlowBlue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--category-portal-blue)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--category-portal-blue)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="categoryPortalGlowViolet" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--category-portal-violet)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--category-portal-violet)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g className="home-categories__portal-glows">
          <ellipse cx="110" cy="226" fill="url(#categoryPortalGlowBlue)" rx="330" ry="310" />
          <ellipse cx="1490" cy="234" fill="url(#categoryPortalGlowViolet)" rx="350" ry="320" />
        </g>

        <g className="home-categories__portal-ceiling">
          <path d="M-120 122C258 -26 554 -10 798 86C1046 -10 1346 -22 1720 126" />
          <path
            className="home-categories__portal-line--soft"
            d="M-108 168C272 34 548 38 800 122C1056 34 1338 28 1706 170"
          />
          <path
            className="home-categories__portal-line--inner"
            d="M92 96C330 20 568 24 800 104C1034 24 1268 20 1508 98"
          />
        </g>

        <g className="home-categories__portal-side home-categories__portal-side--left">
          <path d="M-54 80C112 116 214 230 232 378C242 486 214 592 150 690" />
          <path
            className="home-categories__portal-line--soft"
            d="M-14 108C126 142 198 246 206 380C214 478 190 568 134 654"
          />
          <path
            className="home-categories__portal-fill"
            d="M-80 58C106 94 248 224 262 382C274 520 230 650 124 760L0 804H-80Z"
            fill="url(#categoryPortalBlue)"
          />
        </g>

        <g className="home-categories__portal-side home-categories__portal-side--right">
          <path d="M1654 82C1486 116 1382 232 1366 380C1354 490 1384 594 1448 692" />
          <path
            className="home-categories__portal-line--soft"
            d="M1614 110C1472 144 1400 250 1392 382C1386 482 1410 570 1466 658"
          />
          <path
            className="home-categories__portal-fill"
            d="M1680 60C1494 96 1350 226 1338 384C1326 522 1370 654 1478 762L1600 806H1680Z"
            fill="url(#categoryPortalViolet)"
          />
        </g>

        <g className="home-categories__portal-sparkles">
          <circle cx="118" cy="248" r="8" />
          <circle cx="270" cy="138" r="6" />
          <circle cx="1334" cy="142" r="6" />
          <circle cx="1482" cy="250" r="8" />
        </g>

        <g className="home-categories__handoff">
          <path
            d="M0 730C256 674 492 686 734 742C1010 806 1284 796 1600 718V900H0Z"
            fill="url(#categoryHandoff)"
          />
          <path
            d="M0 794C288 738 548 750 806 806C1060 860 1320 850 1600 782V900H0Z"
            fill="#eef7ff"
            opacity="0.46"
          />
          <path
            className="home-categories__handoff-highlight"
            d="M0 758C282 706 530 718 786 772C1040 826 1306 816 1600 744"
          />
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
      {/* Vector rendition of the approved portal backdrop; never stretch the source ratio. */}
      <div aria-hidden="true" className="home-next-step__dark-backdrop">
        <svg className="home-next-step__dark-backdrop-svg"
          focusable="false" preserveAspectRatio="xMaxYMid meet" viewBox="0 0 1983 793">
          <defs>
            <radialGradient id="ysPortalHalo">
              <stop offset="0%" stopColor="#765BDB" stopOpacity="0.39" />
              <stop offset="58%" stopColor="#5B4BB1" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#252A62" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="ysPortalInterior">
              <stop offset="0%" stopColor="#1C295C" stopOpacity="0.94" />
              <stop offset="76%" stopColor="#25236A" stopOpacity="0.76" />
              <stop offset="100%" stopColor="#6B53B7" stopOpacity="0.13" />
            </radialGradient>
            <linearGradient id="ysPortalRim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7EA7F7" stopOpacity="0.12" />
              <stop offset="42%" stopColor="#87A9F9" stopOpacity="0.48" />
              <stop offset="78%" stopColor="#B18FF0" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#8568D9" stopOpacity="0.16" />
            </linearGradient>
            <linearGradient id="ysPortalSweep" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#527AC9" stopOpacity="0.06" />
              <stop offset="48%" stopColor="#7B78D2" stopOpacity="0.21" />
              <stop offset="100%" stopColor="#B17DE5" stopOpacity="0.43" />
            </linearGradient>
          </defs>
          <ellipse cx="1520" cy="337" rx="600" ry="405" fill="url(#ysPortalHalo)" />
          <ellipse cx="1554" cy="346" rx="397" ry="267"
            transform="rotate(-13 1554 346)" fill="url(#ysPortalInterior)" opacity="0.68" />
          <g fill="none" strokeLinecap="round">
            <ellipse cx="1557" cy="343" rx="406" ry="260"
              transform="rotate(-13 1557 343)" stroke="url(#ysPortalRim)" strokeWidth="2.1" />
            <ellipse cx="1562" cy="338" rx="471" ry="305"
              transform="rotate(-13 1562 338)" stroke="#91A0EF" strokeOpacity="0.19" />
            <ellipse cx="1560" cy="350" rx="351" ry="220"
              transform="rotate(-13 1560 350)" stroke="#BC98FF" strokeOpacity="0.25" />
            <path d="M-96 470C270 276 530 344 833 505C1130 662 1374 717 1653 585C1813 510 1930 418 2100 353"
              stroke="url(#ysPortalSweep)" strokeWidth="1.5" />
            <path d="M-96 560C296 356 541 433 842 577C1170 728 1395 757 1706 618C1870 544 1961 475 2100 428"
              stroke="#8391DB" strokeOpacity="0.12" />
          </g>
          <g fill="#A7AEFF">
            <circle cx="1095" cy="291" r="5" opacity="0.63" />
            <circle cx="1738" cy="140" r="5.5" opacity="0.71" />
            <circle cx="1790" cy="572" r="8" opacity="0.78" />
            <circle cx="1540" cy="607" r="4" opacity="0.38" />
            <circle cx="1251" cy="120" r="2.7" opacity="0.53" />
            <circle cx="1140" cy="420" r="2.5" opacity="0.49" />
            <circle cx="1850" cy="280" r="2.7" opacity="0.57" />
            <circle cx="1922" cy="630" r="3" opacity="0.41" />
          </g>
          <g fill="none" stroke="#C8B5FA" strokeOpacity="0.62" strokeLinecap="round">
            <path d="M1280 145v15M1272.5 152.5h15" />
            <path d="M1834 541v17M1825.5 549.5h17" />
            <path d="M1775 87v11M1769.5 92.5h11" />
          </g>
        </svg>
      </div>
      <div
        className={`customer-container home-next-step__shell ${reveal.isVisible ? "is-visible" : ""}`}
        ref={reveal.ref}
      >
        <div className="home-next-step__main" data-tour="checkout">
          <div className="home-next-step__copy">
            <p className="customer-kicker">Shop your way</p>
            <h2>
              Build your basket.
              <span>Pay when it&apos;s delivered.</span>
            </h2>
            <p className="home-next-step__lede">
              Order everyday essentials online and pay cash when your order arrives. Simple,
              familiar, and convenient.
            </p>

            <div className="home-next-step__meta" aria-label="Ordering highlights">
              <span>
                <Truck aria-hidden="true" />
                <strong>Cash on Delivery</strong>
              </span>
              <span>
                <MapPin aria-hidden="true" />
                <strong>Pasig City</strong>
              </span>
              <span>
                <ShieldCheck aria-hidden="true" />
                <strong>Everyday essentials</strong>
              </span>
            </div>

            <div className="home-next-step__actions">
              <CustomerLink
                className="customer-button home-next-step__shop-button"
                href="/shop"
                navigate={navigate}
              >
                Start shopping
              </CustomerLink>
              <CustomerLink className="home-secondary-link" href="/about" navigate={navigate}>
                See our story <ArrowRight aria-hidden="true" size={17} />
              </CustomerLink>
            </div>
          </div>

          <HomeNextStepVisual />
        </div>
      </div>
    </section>
  );
}

function HomeNextStepVisual() {
  return (
    <div aria-hidden="true" className="home-next-step__visual">
      <svg
        className="home-next-step__visual-svg"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 720 520"
      >
        <defs>
          <linearGradient id="nextStepBasket" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--next-step-pink)" />
            <stop offset="52%" stopColor="var(--next-step-lilac)" />
            <stop offset="100%" stopColor="var(--next-step-indigo)" />
          </linearGradient>
          <linearGradient id="nextStepBagBlue" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#9fc9ff" />
            <stop offset="100%" stopColor="#5f70ff" />
          </linearGradient>
          <linearGradient id="nextStepBagPink" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffc6e8" />
            <stop offset="100%" stopColor="#ff74c4" />
          </linearGradient>
          <linearGradient id="nextStepBagViolet" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#cab7ff" />
            <stop offset="100%" stopColor="#7658ef" />
          </linearGradient>
          <filter id="nextStepShadow" x="-35%" y="-35%" width="170%" height="190%">
            <feDropShadow
              dx="0"
              dy="18"
              floodColor="#6657d8"
              floodOpacity="0.18"
              stdDeviation="16"
            />
          </filter>
        </defs>

        <path
          className="home-next-step__visual-orbit"
          d="M58 368C178 470 420 470 624 350C700 306 722 244 680 206"
        />
        <path
          className="home-next-step__visual-orbit home-next-step__visual-orbit--soft"
          d="M118 104C264 18 536 48 668 170"
        />

        <g
          className="home-next-step__floating-bag home-next-step__floating-bag--pink"
          transform="translate(458 42) rotate(8)"
        >
          <path d="M16 30H104L96 118H24Z" fill="url(#nextStepBagPink)" />
          <path
            d="M40 34C40 6 80 6 80 34"
            fill="none"
            stroke="#e766b1"
            strokeLinecap="round"
            strokeWidth="10"
          />
        </g>

        <g
          className="home-next-step__floating-bag home-next-step__floating-bag--violet"
          transform="translate(596 80) rotate(12)"
        >
          <path d="M12 28H88L82 104H18Z" fill="url(#nextStepBagViolet)" />
          <path
            d="M34 30C34 8 68 8 68 30"
            fill="none"
            stroke="#6547d7"
            strokeLinecap="round"
            strokeWidth="9"
          />
        </g>

        <g
          className="home-next-step__cart"
          filter="url(#nextStepShadow)"
          transform="translate(236 128)"
        >
          <g transform="translate(84 18)">
            <path d="M18 46H104L96 154H28Z" fill="url(#nextStepBagPink)" />
            <path
              d="M42 48C42 14 82 14 82 48"
              fill="none"
              stroke="#e466b4"
              strokeLinecap="round"
              strokeWidth="11"
            />
          </g>
          <g transform="translate(166 0)">
            <path d="M18 46H114L104 164H30Z" fill="url(#nextStepBagBlue)" />
            <path
              d="M48 48C48 10 88 10 88 48"
              fill="none"
              stroke="#5b62d9"
              strokeLinecap="round"
              strokeWidth="11"
            />
          </g>
          <g transform="translate(252 40)">
            <path d="M18 42H92L86 136H26Z" fill="url(#nextStepBagViolet)" />
            <path
              d="M40 44C40 16 72 16 72 44"
              fill="none"
              stroke="#6547d7"
              strokeLinecap="round"
              strokeWidth="9"
            />
          </g>

          <path d="M54 126H382L352 326H104Z" fill="url(#nextStepBasket)" opacity="0.95" />
          <path
            d="M52 126H382"
            fill="none"
            stroke="#f6eeff"
            strokeLinecap="round"
            strokeWidth="24"
          />
          <path
            d="M50 126L22 84H-4"
            fill="none"
            stroke="#8a7af4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="20"
          />

          {Array.from({ length: 6 }, (_, index) => (
            <rect
              fill="#ffffff"
              height="112"
              key={index}
              opacity="0.38"
              rx="13"
              transform={`translate(${122 + index * 40} 176) rotate(7)`}
              width="17"
            />
          ))}

          <path
            d="M104 326H362"
            fill="none"
            stroke="#9185ef"
            strokeLinecap="round"
            strokeWidth="16"
          />
          <circle cx="144" cy="360" fill="#6559d8" r="30" />
          <circle cx="144" cy="360" fill="#d9d2ff" r="13" />
          <circle cx="324" cy="360" fill="#6559d8" r="30" />
          <circle cx="324" cy="360" fill="#d9d2ff" r="13" />
        </g>

        <g className="home-next-step__visual-sparkles">
          <circle cx="118" cy="330" r="18" />
          <circle cx="624" cy="326" r="14" />
          <path d="M166 206L176 228L198 238L176 248L166 270L156 248L134 238L156 228Z" />
          <path d="M604 196L612 212L628 220L612 228L604 244L596 228L580 220L596 212Z" />
        </g>
      </svg>
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
