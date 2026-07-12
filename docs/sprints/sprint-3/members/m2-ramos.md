# M2 - Ramos

## Role

SARIMA / Forecasting / Reports Lead

## Sprint 3 Result

Sprint 3 M2 now has a working vertical forecasting foundation:

```text
data/forecasting/historical-sales-2024.xlsx
data/forecasting/historical-sales-2025.xlsx
-> Node safe Excel parser and validation
-> normalized product-month series
-> Python statsmodels SARIMA service
-> deterministic fallback path
-> owner-only Forecast API
-> owner Forecast page
-> forecast summary API for future reporting consumers
```

Only the canonical `.xlsx` workbooks are retained. The duplicate `.xlsx.xlsx` copies were byte-identical, unreferenced,
and removed during Sprint integration.

## Architecture

| Layer              | Implementation                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Excel parsing      | `backend/src/modules/forecasting/spreadsheet-parser.service.ts` with `read-excel-file`             |
| Data normalization | `historical-sales.service.ts` converts Jan-Dec wide rows to `YYYY-MM` monthly records              |
| Node orchestration | `forecast.service.ts` validates history, launches Python, caches generated results in process      |
| Python service     | `forecasting-service/app/main.py`, `sarima.py`, `fallback.py`, `evaluation.py`, `preprocessing.py` |
| API                | `backend/src/modules/forecasting/forecast.routes.ts` under `/api/forecasts`                        |
| UI contracts       | `frontend/src/types/forecast.ts`                                                                   |
| Forecast UI        | `frontend/src/pages/ForecastPage.tsx`                                                              |
| Reports UI         | Not implemented; the protected placeholder route remains                                           |

No Prisma schema change was required for Sprint 3. The current implementation uses application memory caching; a
future migration should be reviewed with M3 before monthly forecast persistence is added.

## Historical Input Contract

Default source paths:

- `data/forecasting/historical-sales-2024.xlsx`
- `data/forecasting/historical-sales-2025.xlsx`

Required columns:

`Product ID`, `Category`, `Product Name`, `Product Price`, `Jan` through `Dec`, `Total Quantity Sold`, `Annual Sales`.

The forecasting target is monthly quantity sold only. Product price, annual sales, and total annual quantity are
validation metadata and are not used as time-series observations.

The parser handles title rows, blank rows, header row detection, unexpected columns, duplicate product IDs, missing
identity fields, invalid prices, blank or malformed month values, total mismatch warnings, product reconciliation, and
continuous 2024-01 through 2025-12 period validation.

## Forecast Contract

Shared frontend/backend contract names:

- `HistoricalSalesPoint`
- `ForecastPoint`
- `ForecastModel`
- `ForecastMetrics`
- `ProductForecastDetail`
- `ForecastProductSummary`
- `PaginatedForecastProductsResponse`
- `ForecastSummary`
- `ForecastGenerationSummary`
- `ForecastFilters`
- `ForecastSort`

Model labels are `SARIMA`, `SEASONAL_NAIVE`, and `MOVING_AVERAGE`. Fallback output is never labeled as SARIMA.

## SARIMA Strategy

| Item            | Decision                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Notation        | SARIMA(p,d,q)(P,D,Q,12)                                                                           |
| Seasonal period | `12` monthly seasonality                                                                          |
| Horizon         | 12 months beginning at the active forecast month                                                  |
| Candidates      | Curated bounded candidates: `(0,1,1)(0,1,1,12)`, `(1,1,0)(0,1,1,12)`, `(1,0,0)(1,0,0,12)`         |
| Selection       | Lowest AIC among successful finite-output fits                                                    |
| Timeout         | Node child process timeout defaults to `FORECAST_PROCESS_TIMEOUT_MS=120000`                       |
| Fallback        | Seasonal naive first, moving average second                                                       |
| Postprocessing  | Non-finite results rejected, displayed demand clamped to non-negative, recommended qty rounded up |
| Metrics         | MAE, RMSE, MAPE with zero-actual skip, WAPE                                                       |

## Environment Variables

| Variable                      | Default  | Purpose                             |
| ----------------------------- | -------- | ----------------------------------- |
| `PYTHON_EXECUTABLE`           | `python` | Python executable for child process |
| `FORECAST_PROCESS_TIMEOUT_MS` | `120000` | Forecast subprocess timeout         |
| `FORECAST_DEFAULT_HORIZON`    | `12`     | Forecast months                     |
| `FORECAST_SEASONAL_PERIOD`    | `12`     | Monthly seasonal period             |

## API Endpoints

| Method | Route                                | Authorization | Purpose                                |
| ------ | ------------------------------------ | ------------- | -------------------------------------- |
| GET    | `/api/forecasts/validation`          | OWNER         | Validate and summarize Excel data      |
| POST   | `/api/forecasts/generate`            | OWNER         | Generate or refresh forecast cache     |
| GET    | `/api/forecasts/products`            | OWNER         | Paginated searchable product summaries |
| GET    | `/api/forecasts/products/:productId` | OWNER         | Product historical and forecast detail |
| GET    | `/api/forecasts/summary`             | OWNER         | Reports summary contract               |
| GET    | `/api/forecasts/generation-summary`  | OWNER         | Batch generation diagnostics           |

## Real Import Results

| Metric                           | Result |
| -------------------------------- | ------ |
| 2024 products found              | 472    |
| 2025 products found              | 472    |
| Matched products                 | 472    |
| Products with warnings           | 0      |
| Rejected products                | 0      |
| Historical observations imported | 11,328 |
| Total mismatch warnings          | 0      |
| Identity conflicts               | 0      |
| Missing products                 | 0      |
| Errors                           | 0      |

## Real Forecast Results

| Metric                              | Result    |
| ----------------------------------- | --------- |
| Total products processed            | 472       |
| SARIMA products                     | 472       |
| Seasonal naive products             | 0         |
| Moving average products             | 0         |
| Failed products                     | 0         |
| Warning products                    | 472       |
| Forecast points generated           | 5,664     |
| First forecast month                | 2026-07   |
| Last forecast month                 | 2027-06   |
| NaN count                           | 0         |
| Infinity count                      | 0         |
| Negative operational quantity count | 0         |
| Batch duration                      | 39,389 ms |

Every product carries limited-data warnings because only 24 monthly observations and two seasonal cycles are available.

## Forecast Page

The owner Forecast page includes product browsing, product-name/product-ID search, category filtering, client-side
pagination and sorting, selected-product detail loading, a Recharts forecast line chart, metrics, loading states, empty
states, and controlled API error states.

## Reports Status

No `ReportsPage`, reports service, reports types, or reports API implementation exists in this merge. The existing
owner-protected placeholder route remains safe. `/api/forecasts/summary` is retained as a Forecast-owned summary contract
for a future Reports implementation; it does not make Reports complete.

## Validation Evidence

| Validation          | Command                                      | Result | Notes                                   |
| ------------------- | -------------------------------------------- | ------ | --------------------------------------- |
| Format              | `npm run format`                             | PASS   | Run directly and inside prepush         |
| Format Check        | `npm run format:check`                       | PASS   | After ignoring/removing pytest cache    |
| Lint                | `npm run lint`                               | PASS   | Node module-type warning only           |
| Typecheck           | `npm run typecheck --workspaces`             | PASS   | Frontend, backend, electron             |
| Build               | `npm run build`                              | PASS   | Vite chunk-size warning only            |
| Prisma Generate     | `npm run prisma:generate`                    | PASS   | No schema changes                       |
| Prisma Validate     | `npm run prisma:validate`                    | PASS   | Schema valid                            |
| Python Tests        | `python -m pytest forecasting-service/tests` | PASS   | 4 tests, one utcnow deprecation warning |
| Excel Validation    | `npm run forecast:validate-data`             | PASS   | 472 matched products                    |
| Forecast Generation | `npm run forecast:generate`                  | PASS   | 5,664 forecast points                   |
| Forecast Smoke Test | `npm run forecast:smoke`                     | PASS   | 12 rows for selected first product      |
| Audit               | `npm audit`                                  | PASS   | 0 vulnerabilities                       |
| Pre-push            | `npm run prepush:local`                      | PASS   | Repo guardrails passed                  |

## Known Limitations

- Only 24 observations are available per product.
- Only two seasonal cycles are represented.
- SARIMA estimates may be unstable for low-volume products.
- Confidence intervals may be wide.
- Fallback models may be needed when future data is less clean or model fitting fails.
- Forecasts do not directly account for promotions, price changes, supplier disruptions, stockouts, unrecorded lost
  demand, economic shocks, or other external demand drivers.
- More historical observations are recommended before operational purchasing decisions rely heavily on model output.

## M1 Integration Requirements

M1 sales integration should provide completed, non-voided sale items with product ID, sale date, quantity sold, unit
price, and sale status. Forecasting needs a reliable monthly aggregation by product and calendar month with returns or
voids excluded or explicitly modeled.

## M3 Integration Requirements

M3 should review product ID/SKU alignment, category naming, inventory relations, and whether a Sprint 4 migration should
persist normalized historical monthly sales and generated monthly forecasts. Any persistence model should include product
relations, generation IDs, uniqueness on product-period-generation, and indexes for product, period, and generation.

## Task Table

| Task ID   | Task                                                           | Type             | Priority | Dependencies                               | Status     |
| --------- | -------------------------------------------------------------- | ---------------- | -------- | ------------------------------------------ | ---------- |
| S3-M2-001 | Design SARIMA service structure                                | Architecture     | P0       | Clean sales/product data contract          | Complete   |
| S3-M2-002 | Define historical sales input format for SARIMA                | Data contract    | P0       | M1 sales shape, M3 product/inventory shape | Complete   |
| S3-M2-003 | Implement forecasting service foundation                       | Feature          | P0       | S3-M2-001, S3-M2-002                       | Complete   |
| S3-M2-004 | Add forecast API and data contract                             | Integration      | P0       | S3-M2-003                                  | Complete   |
| S3-M2-005 | Add forecast output for supported products                     | Feature / QA     | P1       | Forecast contract                          | Complete   |
| S3-M2-006 | Prepare Forecast page for forecast results                     | UI / Integration | P1       | S3-M2-004, S3-M2-005                       | Complete   |
| S3-M2-007 | Prepare Reports page for sales and forecast summaries          | UI / Integration | P1       | Sales data, forecast contract              | Incomplete |
| S3-M2-008 | Document SARIMA parameters, preprocessing, and evaluation plan | Documentation    | P1       | S3-M2-001, S3-M2-002                       | Complete   |
