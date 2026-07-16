import type { ForecastFilters, ForecastProductSummary } from "@/types/forecast";

export const FORECAST_PRODUCTS_COMPACT_PAGE_SIZE = 7;
export const FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE = FORECAST_PRODUCTS_COMPACT_PAGE_SIZE + 3;
export const FORECAST_PRODUCTS_DESKTOP_QUERY = "(min-width: 1280px)";

export function getForecastProductsPageSize(isDesktop: boolean) {
  return isDesktop ? FORECAST_PRODUCTS_DESKTOP_PAGE_SIZE : FORECAST_PRODUCTS_COMPACT_PAGE_SIZE;
}

export type ForecastSortOption =
  | "alphabeticalAsc"
  | "alphabeticalDesc"
  | "highestForecast"
  | "lowestForecast"
  | "mostSelling"
  | "leastSelling"
  | "mostInDemand"
  | "lowestDemand";

export const forecastSortOptions: { label: string; value: ForecastSortOption }[] = [
  { label: "Alphabetical: A to Z", value: "alphabeticalAsc" },
  { label: "Alphabetical: Z to A", value: "alphabeticalDesc" },
  { label: "Highest Forecast", value: "highestForecast" },
  { label: "Lowest Forecast", value: "lowestForecast" },
  { label: "Most Selling", value: "mostSelling" },
  { label: "Least Selling", value: "leastSelling" },
  { label: "Most In Demand", value: "mostInDemand" },
  { label: "Lowest Demand", value: "lowestDemand" }
];

export function getForecastServerSort(
  sortBy: ForecastSortOption
): Pick<ForecastFilters, "sortBy" | "sortDirection"> {
  switch (sortBy) {
    case "alphabeticalAsc":
      return { sortBy: "productName", sortDirection: "asc" };
    case "alphabeticalDesc":
      return { sortBy: "productName", sortDirection: "desc" };
    case "highestForecast":
      return { sortBy: "currentMonthForecastQuantity", sortDirection: "desc" };
    case "lowestForecast":
      return { sortBy: "currentMonthForecastQuantity", sortDirection: "asc" };
    case "mostSelling":
      return { sortBy: "recentHistoricalSalesTotal", sortDirection: "desc" };
    case "leastSelling":
      return { sortBy: "recentHistoricalSalesTotal", sortDirection: "asc" };
    case "mostInDemand":
      return { sortBy: "twelveMonthForecastTotal", sortDirection: "desc" };
    case "lowestDemand":
      return { sortBy: "twelveMonthForecastTotal", sortDirection: "asc" };
  }
}

export function getLocalMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(monthKey: string, monthsToAdd: number) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const monthIndex = year * 12 + (month - 1) + monthsToAdd;
  const nextYear = Math.floor(monthIndex / 12);
  const nextMonth = (monthIndex % 12) + 1;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function buildMonthWindow(startMonth: string, horizon = 12) {
  return Array.from({ length: horizon }, (_, index) => addMonths(startMonth, index));
}

export function formatMonthLabel(period: string) {
  const monthKey = period.length >= 7 ? period.slice(0, 7) : period;
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const date = new Date(year, month - 1, 1);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric"
  }).format(date);
}

export function formatForecastVariance(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not enough data";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${value.toFixed(1)}%`;
}

export function matchesForecastSearch(product: ForecastProductSummary, searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();

  if (!query) {
    return true;
  }

  return [product.productName, product.productId, product.category]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(query));
}

function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
  direction: "asc" | "desc"
) {
  const leftValid = typeof left === "number" && Number.isFinite(left);
  const rightValid = typeof right === "number" && Number.isFinite(right);

  if (!leftValid && !rightValid) {
    return 0;
  }

  if (!leftValid) {
    return 1;
  }

  if (!rightValid) {
    return -1;
  }

  return direction === "asc" ? left - right : right - left;
}

export function deriveForecastProducts(
  products: ForecastProductSummary[],
  options: {
    category: string;
    searchQuery: string;
    sortBy: ForecastSortOption;
  }
) {
  const filtered = products.filter((product) => {
    const matchesCategory = options.category ? product.category === options.category : true;

    return matchesCategory && matchesForecastSearch(product, options.searchQuery);
  });

  return filtered
    .map((product, index) => ({ index, product }))
    .sort((left, right) => {
      let result = 0;

      switch (options.sortBy) {
        case "alphabeticalAsc":
          result = left.product.productName.localeCompare(right.product.productName);
          break;
        case "alphabeticalDesc":
          result = right.product.productName.localeCompare(left.product.productName);
          break;
        case "highestForecast":
          result = compareNullableNumbers(
            left.product.currentMonthForecastQuantity,
            right.product.currentMonthForecastQuantity,
            "desc"
          );
          break;
        case "lowestForecast":
          result = compareNullableNumbers(
            left.product.currentMonthForecastQuantity,
            right.product.currentMonthForecastQuantity,
            "asc"
          );
          break;
        case "mostSelling":
          result = compareNullableNumbers(
            left.product.recentHistoricalSalesTotal,
            right.product.recentHistoricalSalesTotal,
            "desc"
          );
          break;
        case "leastSelling":
          result = compareNullableNumbers(
            left.product.recentHistoricalSalesTotal,
            right.product.recentHistoricalSalesTotal,
            "asc"
          );
          break;
        case "mostInDemand":
          result = compareNullableNumbers(
            left.product.twelveMonthForecastTotal,
            right.product.twelveMonthForecastTotal,
            "desc"
          );
          break;
        case "lowestDemand":
          result = compareNullableNumbers(
            left.product.twelveMonthForecastTotal,
            right.product.twelveMonthForecastTotal,
            "asc"
          );
          break;
      }

      return result === 0 ? left.index - right.index : result;
    })
    .map((entry) => entry.product);
}

export function paginateForecastProducts(
  products: ForecastProductSummary[],
  options: {
    page: number;
    pageSize: number;
  }
) {
  const totalItems = products.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
  const page = Math.min(Math.max(options.page, 1), totalPages);
  const startIndex = (page - 1) * options.pageSize;
  const endIndex = Math.min(startIndex + options.pageSize, totalItems);

  return {
    endItem: totalItems === 0 ? 0 : endIndex,
    items: products.slice(startIndex, endIndex),
    page,
    pageSize: options.pageSize,
    startItem: totalItems === 0 ? 0 : startIndex + 1,
    totalItems,
    totalPages
  };
}
