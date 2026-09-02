# YsabelleStore

**Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store**

YsabelleStore is a thesis-grade retail platform that connects POS sales, batch-aware inventory, historical-sales preparation, SARIMA demand forecasting, inventory recommendations, and a customer-facing storefront through one shared backend and data model.

## Project Snapshot

| Field                             | Current State                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Stable release baseline           | **Sprint 8**                                                                                 |
| Stable branch                     | `main`                                                                                       |
| Release-candidate / cleaning lane | `staging`                                                                                    |
| Active sprint configuration       | `config/guardrails.json` → Sprint 8                                                          |
| Next planned cycle                | **Sprint 9 — UI/UX cleanup and polish**                                                      |
| Thesis forecasting method         | **SARIMA / SARIMAX family**                                                                  |
| Primary database                  | MySQL Community Server via Prisma                                                            |
| Web runtime                       | React/Vite frontend + Express backend                                                        |
| Desktop runtime                   | Electron                                                                                     |
| Current project scope             | [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md)                                             |
| Repository architecture           | [`docs/architecture/03-folder-architecture.md`](docs/architecture/03-folder-architecture.md) |
| Prisma schema                     | [`database/prisma/schema.prisma`](database/prisma/schema.prisma)                             |
| CI / guardrails                   | [`docs/standards/CI-GUARDRAILS.md`](docs/standards/CI-GUARDRAILS.md)                         |

> Current source, schema, migrations, executable configuration, and tests are the implementation source of truth. Historical sprint documents remain useful evidence, but they do not override the current repository state.

## Major System Capabilities

| Module              | Major Implementation                                                                                                                           | Status               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Product & Catalog   | Product/category records, SKU/barcode identity, pricing, catalog quality controls, aliases, canonical mapping and duplicate-review foundations | ✅ Implemented       |
| POS & Sales         | Cashier sales flow, sale records/items, receipt support, and inventory effects                                                                 | ✅ Implemented       |
| Inventory           | Aggregate inventory, batch quantities, stock movements, adjustments, reconciliation tooling and stock-integrity checks                         | ✅ Implemented       |
| Batch & Expiration  | Batch codes, received/remaining quantities, expiration dates and batch status monitoring                                                       | ✅ Implemented       |
| Historical Sales    | Validated historical-sales import, row-level validation, overlap handling, rollback/audit-oriented persistence and monthly sales records       | ✅ Implemented       |
| Forecasting         | Product-level monthly SARIMA forecasting, candidate selection, fallback forecasts, metrics, persistence and cached delivery                    | ✅ Implemented       |
| Recommendations     | Forecast/inventory-linked recommendation records for restock, low-stock, overstock and expiry-risk guidance                                    | ✅ Implemented       |
| Customer Storefront | Home/shop discovery, product browsing/detail, search, cart/checkout, pickup-order flow, ratings/reviews and customer account experience        | ✅ Implemented       |
| Internal Access     | Separate OWNER/STAFF authentication boundary, protected operations and trusted-device support                                                  | ✅ Implemented       |
| Customer Access     | Customer accounts, sessions, account/order history and storefront authentication                                                               | ✅ Implemented       |
| Catalog Images      | Product image assets, processing/approval states, image-quality pipeline, backfill and storefront delivery                                     | ✅ Implemented       |
| Server Reliability  | Canonical HTTP statuses, health/liveness/readiness, safe errors, request IDs, structured logging and frontend reliability states               | ✅ Sprint 8 verified |
| Desktop             | Electron runtime and packaging boundary for the local desktop operating model                                                                  | ✅ Implemented       |
| UI/UX Consistency   | Existing flows are functional; visual consistency and login-entry presentation remain the next cleanup target                                  | 🟡 Sprint 9 focus    |

## Frontend Implementation Report

| Area                 | Important Frontend Work                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Internal Operations  | Dashboard, Products, Inventory, POS, Sales, Historical Sales, Forecast, User Management and protected-route experiences |
| POS Experience       | Product selection, transaction flow and printable receipt page                                                          |
| Inventory Experience | Stock/batch monitoring, inventory operations and data-management UI                                                     |
| Forecast Experience  | Forecast views and chart-based demand presentation backed by persisted forecasting results                              |
| Customer Storefront  | Customer home, shop/product discovery, product details, search, cart/checkout and pickup-order experience               |
| Customer Account     | Customer authentication, session-aware account views and order history                                                  |
| Product Experience   | Product imagery, ratings/reviews, search/filter behavior and catalog presentation                                       |
| Branding & Motion    | Official Ysabelle assets, Tailwind styling, GSAP motion, Lucide icons and reusable UI primitives                        |
| Reliability UX       | Explicit `healthy`, `degraded`, `database-unavailable`, `backend-unavailable`, `timeout` and `offline` states           |
| Current Follow-up    | Sprint 9 will improve visual consistency, responsive polish and clearer customer-vs-OWNER/STAFF login entry points      |

### Frontend Stack

| Category      | Current Technology                                  |
| ------------- | --------------------------------------------------- |
| Framework     | React 19 + TypeScript                               |
| Build / Dev   | Vite 6                                              |
| Styling       | Tailwind CSS 3, PostCSS, utility/component patterns |
| UI Primitives | Base UI, Radix UI, class-variance-authority         |
| Motion        | GSAP                                                |
| Icons         | Lucide React                                        |
| Charts        | Chart.js, react-chartjs-2, Recharts                 |
| Validation    | Zod                                                 |

## Backend Implementation Report

| Area                    | Important Backend Work                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| API Foundation          | Express + TypeScript API with route/controller/service/validator separation                                                    |
| Internal Authentication | OWNER/STAFF authorization boundary, JWT-based protected operations, trusted-device support and auth security tests             |
| Customer Authentication | Customer account registration/login/session handling, account APIs and order-history boundary                                  |
| POS / Stock Domain      | Sales persistence integrated with inventory and batch movement logic                                                           |
| Catalog Services        | Product/category APIs, import services, catalog quality policy, canonical identity utilities and storefront serializers        |
| Storefront API          | Customer catalog/search/product-detail/order endpoints backed by the same product/inventory source of truth                    |
| Historical Sales        | CSV/XLSX-oriented validation/import services with preview, overlap rules, row diagnostics and persisted monthly sales          |
| Forecast Delivery       | Effective-sales preparation, SARIMA execution boundary, forecast persistence, source-version tracking and fallback delivery    |
| Catalog Images          | Upload policy, image asset service, storage/URL handling, processing gate, engine runner and legacy backfill                   |
| Reliability             | Health summary, liveness/readiness endpoints, canonical HTTP status contract, sanitized error boundary and request correlation |
| Observability           | Server-generated request IDs and safe structured request-completion/failure logging                                            |

### Backend Stack

| Category          | Current Technology                          |
| ----------------- | ------------------------------------------- |
| Runtime           | Node.js + TypeScript                        |
| API               | Express 4                                   |
| ORM               | Prisma 6                                    |
| Database          | MySQL Community Server                      |
| Authentication    | JSON Web Tokens                             |
| Validation        | Zod + domain validation                     |
| Uploads / Imports | Multer, read-excel-file and import services |
| Quality           | ESLint, Prettier, Husky and GitHub Actions  |

## Forecasting Models Used

The forecasting service uses monthly seasonal demand data and fits a constrained set of SARIMA candidates with `statsmodels`.

| Priority       | Forecast Model            | Role                                                                 |
| -------------- | ------------------------- | -------------------------------------------------------------------- |
| Candidate 1    | `SARIMA(0,1,1)(0,1,1,12)` | Seasonal monthly candidate                                           |
| Candidate 2    | `SARIMA(1,1,0)(0,1,1,12)` | Seasonal monthly candidate                                           |
| Candidate 3    | `SARIMA(1,0,0)(1,0,0,12)` | Seasonal monthly candidate                                           |
| Selection rule | **Lowest finite AIC**     | Chooses the successful candidate with the best finite AIC            |
| Fallback 1     | Seasonal naive            | Used if fitted SARIMA candidates cannot produce valid finite output  |
| Fallback 2     | Moving average            | Used when seasonal history is insufficient for seasonal-naive output |

**Forecasting boundary:** SARIMA forecasts **demand**, not expiration dates. Expiry risk comes from batch/inventory state, time to expiration and expected demand.

See [`forecasting-service/README.md`](forecasting-service/README.md) for model strategy, metrics and limitations.

## Forecasting & Recommendation Pipeline

| Stage             | Source / Output                                                               |
| ----------------- | ----------------------------------------------------------------------------- |
| 1. Source sales   | Historical imports + applicable POS actual sales                              |
| 2. Validation     | Product identity, periods, duplicates, overlaps and row-level diagnostics     |
| 3. Monthly demand | Active `HistoricalMonthlySales` records / effective-sales series              |
| 4. Forecasting    | Constrained SARIMA candidates + validated fallback logic                      |
| 5. Persistence    | `ForecastRecord`, `ForecastBatchCache` and `ForecastProductResult`            |
| 6. Delivery       | Backend forecast service → Forecast UI/report consumers                       |
| 7. Recommendation | Forecast demand + current inventory context → `RecommendationRecord` guidance |

## Important Data / Domain Models

| Domain             | Important Prisma Models                                                                                                 | Purpose                                                                             |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Internal Users     | `User`, `TrustedDevice`                                                                                                 | OWNER/STAFF identity, roles and trusted-device persistence                          |
| Customer Accounts  | `CustomerAccount`, `CustomerSession`                                                                                    | Customer identity and session lifecycle                                             |
| Customer Orders    | `CustomerOrder`, `CustomerOrderItem`                                                                                    | Storefront pickup-order persistence                                                 |
| Catalog            | `Category`, `Product`                                                                                                   | Canonical product/category, pricing and operational state                           |
| Product Experience | `ProductReview`, `ProductImageAsset`                                                                                    | Ratings/reviews and governed product-image assets                                   |
| Catalog Identity   | `ProductAlias`, `ProductCanonicalMapping`, `ProductDuplicateCandidate`, `SarimaSourceProductMapping`, `CatalogAuditLog` | Deduplication, canonicalization, SARIMA source mapping and audit evidence           |
| Inventory          | `Inventory`, `InventoryBatch`, `InventoryMovement`                                                                      | Aggregate stock, batch-authoritative quantities, expiration and auditable movements |
| POS                | `Sale`, `SaleItem`                                                                                                      | Completed sales and product/batch transaction lines                                 |
| Historical Sales   | `HistoricalSalesImportBatch`, `HistoricalSalesImportRow`, `HistoricalMonthlySales`                                      | Import audit trail, row diagnostics and forecast-ready monthly history              |
| Forecasting        | `ForecastRecord`, `ForecastBatchCache`, `ForecastProductResult`                                                         | Persisted demand forecasts, generation batches/cache and product results            |
| Recommendations    | `RecommendationRecord`                                                                                                  | Restock/stock-risk/expiry-risk decision-support records                             |

## Sprint 8 — Server Reliability & Safety

Sprint 8 established a dedicated server-reliability baseline before promotion through `staging` to `main`.

| Reliability Area     | Implemented Behavior                                                               | Release QA                                   |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------- |
| HTTP Contract        | Central supported status contract for backend outcomes                             | ✅ Passed                                    |
| Health Summary       | `GET /api/health`                                                                  | ✅ `200`, healthy, ready                     |
| Liveness             | `GET /api/health/live`                                                             | ✅ `200`, healthy                            |
| Readiness            | `GET /api/health/ready` with critical DB/config checks and `503` degraded behavior | ✅ Healthy path + failure regressions passed |
| Error Safety         | Unexpected/server errors return sanitized generic envelopes                        | ✅ Passed                                    |
| DB Diagnostic Safety | Public health output does not expose raw database connection diagnostics           | ✅ Regression protected                      |
| Request Traceability | Server-generated request UUID returned as `x-request-id`                           | ✅ Passed                                    |
| Safe Logging         | Structured request/error logging without request-body/header/token dumping         | ✅ Passed                                    |
| Frontend Health UI   | Reliability state shown to staff/internal UI                                       | ✅ Live QA rendered **All Systems Normal**   |
| Targeted Sprint 8 QA | HTTP, readiness, error security and traceability regressions                       | ✅ **12/12 passed**                          |

Detailed evidence lives under [`docs/sprints/sprint-8/`](docs/sprints/sprint-8/), including the security audit and server-change-safety documentation.

## Catalog Image Quality Pipeline

| Stage               | Responsibility                                                                    |
| ------------------- | --------------------------------------------------------------------------------- |
| Upload policy       | Validate accepted product-image input and upload constraints                      |
| Asset persistence   | Store source/processed/card/PDP asset metadata in `ProductImageAsset`             |
| Processing gate     | Control whether an image can enter or re-enter processing                         |
| Quality engine      | Normalize/evaluate catalog imagery through the Python catalog-image engine        |
| Approval state      | Track `APPROVED`, `NEEDS_REVIEW`, `REJECTED` and processing status                |
| Storefront delivery | Resolve approved/current product imagery for customer-facing views                |
| Legacy backfill     | Migrate legacy image references into the governed asset pipeline where applicable |

## Technology Stack

| Layer                | Technology                                           |
| -------------------- | ---------------------------------------------------- |
| Frontend             | React, Vite, TypeScript                              |
| Styling / UI         | Tailwind CSS, Base UI / Radix patterns, GSAP, Lucide |
| Charts               | Chart.js / react-chartjs-2, Recharts                 |
| Backend              | Node.js, Express.js, TypeScript                      |
| ORM                  | Prisma                                               |
| Database             | MySQL Community Server                               |
| Forecasting          | Python, pandas, NumPy, `statsmodels` SARIMA/SARIMAX  |
| Catalog Image Engine | Python processing service/module                     |
| Validation           | Zod and domain validation                            |
| Desktop              | Electron                                             |
| Quality / CI         | ESLint, Prettier, Husky, GitHub Actions              |
| Packaging            | electron-builder                                     |

## Verification Report

The repository uses layered verification instead of relying on one test command.

| Verification Area | Current Coverage                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting        | Prettier check                                                                                                                                                 |
| Static quality    | ESLint                                                                                                                                                         |
| Types             | Repository/workspace TypeScript typecheck                                                                                                                      |
| Database          | Prisma client generation + schema validation + disposable CI database                                                                                          |
| Backend tests     | Auth, customer accounts/orders, CORS, catalog images, catalog quality, storefront, forecast, historical sales, inventory import and Sprint 8 reliability tests |
| Frontend tests    | Customer auth/account contracts, internal-auth boundary and system-health reliability contracts                                                                |
| Forecast tests    | Python `pytest` forecasting-service suite                                                                                                                      |
| Guardrails        | Repository guardrail test suite and preflight/status checks                                                                                                    |
| Builds            | Frontend, backend, Electron and full-repository build                                                                                                          |
| Security          | Production dependency reachability audit plus focused security regression tests                                                                                |
| Release lane      | Sprint candidate → `staging` cleaning/verification → `main` promotion                                                                                          |

## Local Development

Copy `.env.example` to `.env` and keep local secrets only in the ignored environment file.

```bash
npm install
npm run dev
```

### Useful Commands

```bash
# Browser-focused frontend + backend stack
npm run dev:web

# Report resolved local runtime endpoints
npm run runtime:report

# Standard code-quality verification
npm run verify:code

# Active sprint / artifact verification
npm run verify:status -- --member m1

# Inventory audit / reconciliation
npm run inventory:audit
npm run inventory:reconcile

# Forecast validation / execution / tests
npm run forecast:validate-data
npm run forecast:generate
npm run forecast:smoke
npm run forecast:test

# SARIMA catalog mapping verification
npm run catalog:sarima:verify

# Catalog image pipeline tests
npm run catalog-images:test
npm run storefront:images:verify

# Security checks
npm run security:audit
npm run security:audit:production
```

Default local endpoints:

| Service  | Default URL                        |
| -------- | ---------------------------------- |
| Frontend | `http://localhost:5173`            |
| Backend  | `http://localhost:3001`            |
| Health   | `http://localhost:3001/api/health` |

## Repository Context for Coding Agents

The persistent repository-context layer was **introduced in Sprint 5** so coding-agent sessions can retrieve stable project context without rediscovering the entire architecture on every task.

```bash
npm run repo:context:status -- --json
npm run repo:context:query -- "Fix POS stock deduction after a completed sale" --json
npm run repo:context:benchmark -- "Fix POS stock deduction after a completed sale" --json
npm run repo:context:test
```

Generated context lives in `.ysabelle-context/` and is ignored by Git. It is a navigation cache—not a replacement for current source, schema, tests or configuration.

See [`tools/repo-context/README.md`](tools/repo-context/README.md) for CLI/MCP details.

## Repository Structure

```text
YsabelleStore/
├── frontend/             React/Vite customer + internal UI
├── backend/              Express API, controllers, services and validation
├── electron/             Desktop main/preload/packaging boundary
├── database/             Prisma schema, migrations and database guidance
├── forecasting-service/  Python SARIMA forecasting service and tests
├── catalog-image-engine/ Python catalog-image quality processing
├── docs/                 Architecture, API, security, standards and sprint evidence
├── testing/              Test and validation guidance
├── deployment/           Build/release/installer guidance
├── scripts/              Repository automation and focused verification tools
├── tools/repo-context/   Persistent repository-context implementation
├── .agents/skills/       Project coding-agent skills
└── .codex/               Project-scoped Codex/MCP configuration
```

## Sprint 9 Planned Focus

Sprint 8 is the current stable functional/reliability baseline. The next planned work is cleanup rather than a new unrelated subsystem.

| Sprint 9 Focus     | Goal                                                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Login Entry UX     | Make the separate **customer** and **OWNER/STAFF** authentication paths immediately understandable instead of visually appearing duplicated |
| Visual Consistency | Normalize spacing, typography, cards, controls and page hierarchy                                                                           |
| Responsive Polish  | Improve layout consistency across desktop/mobile widths                                                                                     |
| Storefront Polish  | Refine product presentation, imagery, ratings/search and customer navigation                                                                |
| Internal UI Polish | Improve dashboard/POS/inventory/forecast visual consistency without changing business rules unnecessarily                                   |
| Motion & Loading   | Standardize meaningful transitions, loading and reveal behavior                                                                             |
| Accessibility      | Improve keyboard/focus/readability behavior where needed                                                                                    |

## Engineering Principles

| Principle           | Rule                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Source of truth     | Current code/schema/config/tests outrank stale planning documents                                        |
| Inventory integrity | Preserve stock/batch correctness before convenience                                                      |
| Separation          | Keep UI, API, database, forecasting and desktop responsibilities separated                               |
| Explainability      | Keep business and forecasting rules defensible for thesis evaluation                                     |
| Scope control       | Do not represent planned supplier/B2B or other future extensions as implemented without source and tests |
| Change safety       | Prefer targeted, reversible changes and verification proportional to risk                                |

For full scope boundaries, see [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md).
