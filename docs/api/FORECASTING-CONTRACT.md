# Forecasting Contract

## Purpose

The Forecast API exposes owner-only access to validated historical sales, generated product forecasts, and a summary
contract for future reporting consumers. No Reports page or reports API is implemented in this merge. The backend owns
Excel parsing, validation, authorization, process orchestration, response shaping, and cache management. The Python
service owns SARIMA fitting, deterministic fallback generation, and model diagnostics.

## Source Data

Default development inputs:

- `data/forecasting/historical-sales-2024.xlsx`
- `data/forecasting/historical-sales-2025.xlsx`

Required workbook columns:

`Product ID`, `Category`, `Product Name`, `Product Price`, `Jan` through `Dec`, `Total Quantity Sold`, `Annual Sales`.

The forecast target is monthly quantity sold. Annual sales, product price, and total annual quantity are not forecast
observations.

## Normalized Historical Point

```ts
type HistoricalSalesPoint = {
  productId: string;
  productName: string;
  category: string;
  sellingPrice: number;
  period: string;
  quantitySold: number;
};
```

`period` is always `YYYY-MM`, with accepted historical points covering `2024-01` through `2025-12`.

The historical workbooks do not provide a verified SKU or barcode. Forecast responses therefore expose `productId`
without relabeling it as `sku` or `productCode`.

## Forecast Point

```ts
type ForecastPoint = {
  period: string;
  predictedQuantity: number;
  recommendedQuantity: number;
  lowerConfidence: number | null;
  upperConfidence: number | null;
  sameMonthLastYear: number | null;
  differenceVersus2025: number | null;
  percentageChangeVersus2025: number | null;
};
```

Forecast periods begin at the active forecast month and cover the configured horizon (12 months by default).
Recommended quantity is non-negative and rounded up.

## Model Labels

```ts
type ForecastModel = "SARIMA" | "SEASONAL_NAIVE" | "MOVING_AVERAGE";
```

Fallback output must use `SEASONAL_NAIVE` or `MOVING_AVERAGE`; it must not be labeled as `SARIMA`.

## API Endpoints

| Method | Route                                | Authorization | Query/body              | Purpose                            |
| ------ | ------------------------------------ | ------------- | ----------------------- | ---------------------------------- |
| GET    | `/api/forecasts/validation`          | OWNER         | none                    | Validate source workbooks          |
| POST   | `/api/forecasts/generate`            | OWNER         | `{ force?: boolean }`   | Generate or refresh forecast cache |
| GET    | `/api/forecasts/products`            | OWNER         | search/filter/sort/page | Paginated product summaries        |
| GET    | `/api/forecasts/products/:productId` | OWNER         | path product ID         | Product detail, history, forecast  |
| GET    | `/api/forecasts/summary`             | OWNER         | none                    | Reports summary                    |
| GET    | `/api/forecasts/generation-summary`  | OWNER         | none                    | Batch diagnostics                  |

## Product List Query

Supported query fields:

- `search`
- `category`
- `model`
- `status`
- `sortBy`
- `sortDirection`
- `page`
- `pageSize`

`pageSize` is capped at 500. Sort fields are whitelisted by Zod validation.

## Security

- Forecast endpoints require a valid JWT and owner role.
- Clients cannot submit arbitrary workbook paths.
- Python execution uses `spawn` with controlled arguments and JSON over stdin/stdout.
- Raw Python stack traces are not returned to clients.
- The vulnerable `xlsx` package is not used.

## Limited-Data Notes

Only 24 monthly observations and two seasonal cycles are available. SARIMA diagnostics are provided as a Sprint 3
foundation, not a guarantee of operational purchasing accuracy. Forecasts do not directly model promotions, price
changes, supplier disruptions, stockouts, lost demand, or economic shocks.
