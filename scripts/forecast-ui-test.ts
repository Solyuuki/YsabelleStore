import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { ForecastProductSummary } from "../frontend/src/types/forecast";
import {
  buildMonthWindow,
  clampForecastWindowStart,
  deriveForecastProducts,
  FORECAST_PRODUCTS_COMPACT_PAGE_SIZE,
  FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE,
  getForecastDetailWindowSizes,
  getForecastProductsPageSize,
  formatForecastVariance,
  matchesForecastSearch,
  paginateForecastProducts
} from "../frontend/src/utils/forecastPresentation";

const forecastPageSource = readFileSync("frontend/src/pages/ForecastPage.tsx", "utf8");
const appLayoutSource = readFileSync("frontend/src/layouts/AppLayout.tsx", "utf8");

function product(input: Partial<ForecastProductSummary>): ForecastProductSummary {
  return {
    category: "Beverages",
    comparisonPeriodTotal: null,
    currentMonthForecastQuantity: 0,
    forecastHorizonMonths: 12,
    forecastHorizonTotal: 0,
    forecastVariancePercentage: null,
    growthVersusComparisonPeriod: null,
    productId: "P000",
    productName: "Sample",
    recentHistoricalSalesTotal: 0,
    warningCount: 0,
    ...input
  };
}

const products = [
  product({
    currentMonthForecastQuantity: 10,
    productId: "P002",
    productName: "Beta Coffee",
    recentHistoricalSalesTotal: 60,
    forecastHorizonTotal: 120
  }),
  product({
    category: "Snacks",
    currentMonthForecastQuantity: 20,
    productId: "P001",
    productName: "Alpha Crackers",
    recentHistoricalSalesTotal: 40,
    forecastHorizonTotal: 200
  }),
  product({
    currentMonthForecastQuantity: 10,
    productId: "P003",
    productName: "Gamma Milk",
    recentHistoricalSalesTotal: 90,
    forecastHorizonTotal: 80
  })
];
const manyProducts = Array.from({ length: 15 }, (_, index) =>
  product({
    category: index === 14 ? "Snacks" : "Beverages",
    currentMonthForecastQuantity: index,
    productId: `P${String(index + 1).padStart(3, "0")}`,
    productName:
      index === 14 ? "Zeta Search Target" : `Paged Product ${String(index + 1).padStart(2, "0")}`,
    recentHistoricalSalesTotal: index * 10,
    forecastHorizonTotal: index * 100
  })
);

assert.deepEqual(buildMonthWindow("2026-07", 12), [
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
  "2027-01",
  "2027-02",
  "2027-03",
  "2027-04",
  "2027-05",
  "2027-06"
]);
assert.deepEqual(buildMonthWindow("2026-12", 12).at(-1), "2027-11");
assert.deepEqual(getForecastDetailWindowSizes(12), [12]);
assert.deepEqual(getForecastDetailWindowSizes(36), [12, 24, 36]);
assert.deepEqual(getForecastDetailWindowSizes(60), [12, 24, 36, 60]);
assert.equal(clampForecastWindowStart(36, 12, 24), 24);
assert.equal(clampForecastWindowStart(36, 12, 40), 24);

assert.equal(matchesForecastSearch(products[0]!, "coffee"), true);
assert.equal(matchesForecastSearch(products[0]!, "P002"), true);
assert.equal(matchesForecastSearch(products[0]!, "missing"), false);

assert.deepEqual(
  deriveForecastProducts(products, {
    category: "",
    searchQuery: "",
    sortBy: "alphabeticalAsc"
  }).map((item) => item.productName),
  ["Alpha Crackers", "Beta Coffee", "Gamma Milk"]
);
assert.deepEqual(
  deriveForecastProducts(products, {
    category: "Beverages",
    searchQuery: "coffee",
    sortBy: "mostInDemand"
  }).map((item) => item.productId),
  ["P002"]
);
assert.deepEqual(
  deriveForecastProducts(products, {
    category: "",
    searchQuery: "",
    sortBy: "highestForecast"
  }).map((item) => item.productId),
  ["P001", "P002", "P003"]
);
assert.deepEqual(
  products.map((item) => item.productId),
  ["P002", "P001", "P003"]
);
assert.equal(FORECAST_PRODUCTS_COMPACT_PAGE_SIZE, 7);
assert.equal(FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE, FORECAST_PRODUCTS_COMPACT_PAGE_SIZE + 3);
assert.equal(getForecastProductsPageSize(false), 7);
assert.equal(getForecastProductsPageSize(true), 10);

const pagedProducts = paginateForecastProducts(manyProducts, {
  page: 1,
  pageSize: FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE
});

assert.equal(pagedProducts.items.length, 10);
assert.equal(pagedProducts.totalItems, manyProducts.length);
assert.equal(pagedProducts.totalPages, 2);
assert.equal(pagedProducts.startItem, 1);
assert.equal(pagedProducts.endItem, 10);
assert.equal(
  paginateForecastProducts(manyProducts, {
    page: 2,
    pageSize: FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE
  }).items.at(-1)?.productId,
  "P015"
);
assert.equal(
  paginateForecastProducts(manyProducts, {
    page: 1,
    pageSize: FORECAST_PRODUCTS_COMPACT_PAGE_SIZE
  }).items.length,
  7
);

const searchBeforePagination = paginateForecastProducts(
  deriveForecastProducts(manyProducts, {
    category: "",
    searchQuery: "P015",
    sortBy: "alphabeticalAsc"
  }),
  {
    page: 1,
    pageSize: FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE
  }
);

assert.deepEqual(
  searchBeforePagination.items.map((item) => item.productId),
  ["P015"]
);

const categoryBeforePagination = paginateForecastProducts(
  deriveForecastProducts(manyProducts, {
    category: "Snacks",
    searchQuery: "",
    sortBy: "alphabeticalAsc"
  }),
  {
    page: 1,
    pageSize: FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE
  }
);

assert.deepEqual(
  categoryBeforePagination.items.map((item) => item.productId),
  ["P015"]
);

const sortBeforePagination = paginateForecastProducts(
  deriveForecastProducts(manyProducts, {
    category: "",
    searchQuery: "",
    sortBy: "highestForecast"
  }),
  {
    page: 1,
    pageSize: FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE
  }
);

assert.deepEqual(
  sortBeforePagination.items.map((item) => item.productId),
  ["P015", "P014", "P013", "P012", "P011", "P010", "P009", "P008", "P007", "P006"]
);

assert.equal(formatForecastVariance(39.64), "+39.6%");
assert.equal(formatForecastVariance(-12.44), "-12.4%");
assert.equal(formatForecastVariance(0), "0.0%");
assert.equal(formatForecastVariance(null), "Not enough data");

assert.equal(
  (forecastPageSource.match(/placeholder="Search product by name or product ID\.\.\."/g) ?? [])
    .length,
  1
);
assert.equal(forecastPageSource.includes("actions={"), false);
assert.equal(/Bell|Notification|notification/i.test(forecastPageSource), false);
assert.equal(appLayoutSource.includes("AppTopbar"), false);
assert.equal(appLayoutSource.includes("pt-[6rem]"), false);
assert.equal(/\.slice\(0,\s*[456]\)/.test(forecastPageSource), false);
assert.equal(forecastPageSource.includes("max-h-64"), false);
assert.equal(forecastPageSource.includes("pagination.items.map"), true);
assert.equal(forecastPageSource.includes("products.map((product)"), false);
assert.equal(forecastPageSource.includes("getForecastProductCollection({"), true);
assert.equal(forecastPageSource.includes("collectionRequestRef"), true);
assert.equal(forecastPageSource.includes("detailRequestRef"), true);
assert.equal(forecastPageSource.includes("<AppPagination"), true);
assert.equal(forecastPageSource.includes("waitForMinimumDuration"), false);
assert.equal(forecastPageSource.includes("FORECAST_PRODUCTS_DESKTOP_QUERY"), true);
assert.equal(forecastPageSource.includes("forecastRows.map"), true);


assert.match(forecastPageSource, /forecastHorizonMonths/);
assert.match(forecastPageSource, /forecastHorizonTotal/);
assert.match(forecastPageSource, /Forecast range/);
assert.match(forecastPageSource, /Next forecast range/);
assert.match(forecastPageSource, /visibleForecastRows/);
assert.doesNotMatch(forecastPageSource, /verified 2026 records/);
assert.doesNotMatch(forecastPageSource, /View this year's product demand forecast/);
