# YsabelleStore

**Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store**

YsabelleStore is a thesis-grade retail platform that connects POS sales, batch-aware inventory, historical-sales preparation, SARIMA demand forecasting, inventory recommendations, and a customer-facing storefront through one shared backend and data model.

> **Documentation baseline:** this README describes the active `sprint/v0.10/sprint-10` branch. Current executable source, schema, migrations, tests, lockfiles, and runtime configuration remain the implementation source of truth when an older planning document disagrees.

## Project Snapshot

| Field | Current State |
| --- | --- |
| Active development branch | `sprint/v0.10/sprint-10` |
| Active sprint configuration | `config/guardrails.json` → **Sprint 10** |
| Sprint 10 plan | [`docs/sprints/sprint-10/README.md`](docs/sprints/sprint-10/README.md) |
| Stable release lane | `main` |
| Release-candidate / cleaning lane | `staging` |
| Historical reliability baseline | Sprint 8 server reliability/safety verification |
| Thesis forecasting method | **SARIMA / SARIMAX family** |
| Primary database | MySQL Community Server via Prisma |
| Web runtime | React/Vite frontend + Express backend |
| Desktop runtime | Electron |
| Windows packaging | Electron Builder + NSIS |
| Current project scope | [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md) |
| Repository architecture | [`docs/architecture/03-folder-architecture.md`](docs/architecture/03-folder-architecture.md) |
| Prisma schema | [`database/prisma/schema.prisma`](database/prisma/schema.prisma) |
| CI / guardrails | [`docs/standards/CI-GUARDRAILS.md`](docs/standards/CI-GUARDRAILS.md) |
| Technology register | [`SYSTEM_TECHNOLOGY_REGISTER.md`](SYSTEM_TECHNOLOGY_REGISTER.md) |
| Support matrix | [`SYSTEM_SUPPORT_MATRIX.md`](SYSTEM_SUPPORT_MATRIX.md) |
| Third-party notices | [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) |

## Major System Capabilities

| Module | Major Implementation | Status |
| --- | --- | --- |
| Product & Catalog | Product/category records, SKU/barcode identity, pricing, catalog quality controls, aliases, canonical mapping and duplicate-review foundations | Implemented |
| POS & Sales | Cashier sales flow, sale records/items, receipt support, and inventory effects | Implemented |
| Inventory | Aggregate inventory, batch quantities, stock movements, adjustments, reconciliation tooling and stock-integrity checks | Implemented |
| Batch & Expiration | Batch codes, received/remaining quantities, expiration dates and batch status monitoring | Implemented |
| Historical Sales | Validated historical-sales import, row-level validation, overlap handling, rollback/audit-oriented persistence and monthly sales records | Implemented |
| Forecasting | Product-level monthly SARIMA forecasting, candidate selection, fallback forecasts, metrics, persistence and cached delivery | Implemented foundation; Sprint 10 includes further forecasting work |
| Recommendations / Restock | Forecast/inventory-linked restock and risk guidance with owner-controlled restock workflow | Implemented in active Sprint 10 scope; later phases remain gated by verification |
| Customer Storefront | Home/shop discovery, product browsing/detail, search, cart/checkout, pickup-order flow, ratings/reviews and customer account experience | Implemented |
| Internal Access | Separate OWNER/STAFF authentication boundary, protected operations and trusted-device support | Implemented |
| Customer Access | Customer accounts, sessions, account/order history, OTP/recovery and social-auth integration boundaries | Implemented |
| Catalog Images | Product image assets, processing/approval states, image-quality pipeline, backfill and storefront delivery | Implemented |
| Server Reliability | Canonical HTTP statuses, health/liveness/readiness, safe errors, request IDs, structured logging and frontend reliability states | Implemented; Sprint 8 reliability baseline verified |
| Desktop | Electron runtime and Windows NSIS packaging boundary | Implemented/configured |

## Sprint 10 Execution Boundary

Sprint 10 is defined as a phase-gated inventory, restock, forecasting, and release-integrity cycle. The sprint documentation defines fifteen phases from Inventory Truth through release gates. A phase is not considered complete merely because it appears in planning documentation; implementation source, automated verification, and applicable manual QA remain required.

See:

- [`docs/sprints/sprint-10/SPRINT-GOAL.md`](docs/sprints/sprint-10/SPRINT-GOAL.md)
- [`docs/sprints/sprint-10/SPRINT-BACKLOG.md`](docs/sprints/sprint-10/SPRINT-BACKLOG.md)
- [`docs/sprints/sprint-10/DEFINITION-OF-DONE.md`](docs/sprints/sprint-10/DEFINITION-OF-DONE.md)

## Frontend Implementation Report

| Area | Important Frontend Work |
| --- | --- |
| Internal Operations | Dashboard, Products, Inventory, POS, Sales, Historical Sales, Forecast, User Management and protected-route experiences |
| POS Experience | Product selection, transaction flow and printable receipt page |
| Inventory Experience | Stock/batch monitoring, inventory operations and data-management UI |
| Forecast Experience | Forecast views and chart-based demand presentation backed by persisted forecasting results |
| Customer Storefront | Customer home, shop/product discovery, product details, search, cart/checkout and pickup-order experience |
| Customer Account | Customer authentication, session-aware account views and order history |
| Product Experience | Product imagery, ratings/reviews, search/filter behavior and catalog presentation |
| Branding & Motion | Official Ysabelle assets, Tailwind styling, GSAP motion, Lucide icons and reusable UI primitives |
| Reliability UX | Explicit `healthy`, `degraded`, `database-unavailable`, `backend-unavailable`, `timeout` and `offline` states |

### Frontend Stack

| Category | Current Technology |
| --- | --- |
| Framework | React 19 + TypeScript |
| Build / Dev | Vite 6 |
| Styling | Tailwind CSS 3, PostCSS, utility/component patterns |
| UI Primitives | Base UI, Radix UI, class-variance-authority |
| Motion | GSAP |
| Icons | Lucide React |
| Charts | Chart.js, react-chartjs-2, Recharts |
| Validation | Zod |

## Backend Implementation Report

| Area | Important Backend Work |
| --- | --- |
| API Foundation | Express + TypeScript API with route/controller/service/validator separation |
| Internal Authentication | OWNER/STAFF authorization boundary, JWT-based protected operations, trusted-device support and auth security tests |
| Customer Authentication | Customer registration/login/session handling, OTP/recovery, social authentication, account APIs and order-history boundary |
| POS / Stock Domain | Sales persistence integrated with inventory and batch movement logic |
| Catalog Services | Product/category APIs, import services, catalog quality policy, canonical identity utilities and storefront serializers |
| Storefront API | Customer catalog/search/product-detail/order endpoints backed by the same product/inventory source of truth |
| Historical Sales | CSV/XLSX-oriented validation/import services with preview, overlap rules, row diagnostics and persisted monthly sales |
| Forecast Delivery | Effective-sales preparation, SARIMA execution boundary, forecast persistence, source-version tracking and fallback delivery |
| Catalog Images | Upload policy, image asset service, storage/URL handling, processing gate, engine runner and legacy backfill |
| Reliability | Health summary, liveness/readiness endpoints, canonical HTTP status contract, sanitized error boundary and request correlation |
| Observability | Server-generated request IDs and safe structured request-completion/failure logging |

### Backend Stack

| Category | Current Technology |
| --- | --- |
| Runtime | Node.js + TypeScript |
| API | Express 4 |
| ORM | Prisma 6 |
| Database | MySQL Community Server |
| Authentication | JSON Web Tokens plus project session/OTP/OAuth flows |
| Validation | Zod + domain validation |
| Uploads / Imports | Multer, read-excel-file and import services |
| Quality | ESLint, Prettier, Husky and GitHub Actions |

## API and Service Boundaries

YsabelleStore implements its own Express API. These internal APIs are project-authored application interfaces, not third-party hosted APIs. Major mounted route groups include authentication, customer authentication/account, dashboard, forecasts, historical sales, health, products/POS, catalog, inventory, restock orders, sales, search, and storefront.

Server reliability endpoints include:

| Endpoint | Responsibility |
| --- | --- |
| `GET /api/health` | Overall health summary |
| `GET /api/health/live` | Process liveness |
| `GET /api/health/ready` | Readiness and critical dependency/configuration checks |

External providers are documented separately in [`docs/compliance/EXTERNAL-SERVICES-REGISTER.md`](docs/compliance/EXTERNAL-SERVICES-REGISTER.md).

## Forecasting Models Used

The forecasting service uses monthly seasonal demand data and fits a constrained set of SARIMA candidates with `statsmodels`.

| Priority | Forecast Model | Role |
| --- | --- | --- |
| Candidate 1 | `SARIMA(0,1,1)(0,1,1,12)` | Seasonal monthly candidate |
| Candidate 2 | `SARIMA(1,1,0)(0,1,1,12)` | Seasonal monthly candidate |
| Candidate 3 | `SARIMA(1,0,0)(1,0,0,12)` | Seasonal monthly candidate |
| Selection rule | **Lowest finite AIC** | Chooses the successful candidate with the best finite AIC |
| Fallback 1 | Seasonal naive | Used if fitted SARIMA candidates cannot produce valid finite output |
| Fallback 2 | Moving average | Used when seasonal history is insufficient for seasonal-naive output |

**Forecasting boundary:** SARIMA forecasts **demand**, not expiration dates. Expiry risk comes from batch/inventory state, time to expiration and expected demand.

See [`forecasting-service/README.md`](forecasting-service/README.md) for model strategy, metrics and limitations.

## Forecasting & Recommendation Pipeline

| Stage | Source / Output |
| --- | --- |
| 1. Source sales | Historical imports + applicable POS actual sales |
| 2. Validation | Product identity, periods, duplicates, overlaps and row-level diagnostics |
| 3. Monthly demand | Active `HistoricalMonthlySales` records / effective-sales series |
| 4. Forecasting | Constrained SARIMA candidates + validated fallback logic |
| 5. Persistence | `ForecastRecord`, `ForecastBatchCache` and `ForecastProductResult` |
| 6. Delivery | Backend forecast service → Forecast UI/report consumers |
| 7. Recommendation | Forecast demand + current inventory context → recommendation/restock decision support |

## Important Data / Domain Models

| Domain | Important Prisma Models | Purpose |
| --- | --- | --- |
| Internal Users | `User`, `TrustedDevice` | OWNER/STAFF identity, roles and trusted-device persistence |
| Customer Accounts | `CustomerAccount`, `CustomerSession` and authentication challenge/identity models | Customer identity and session/auth lifecycle |
| Customer Orders | `CustomerOrder`, `CustomerOrderItem` | Storefront pickup-order persistence |
| Catalog | `Category`, `Product` | Canonical product/category, pricing and operational state |
| Product Experience | `ProductReview`, `ProductImageAsset` | Ratings/reviews and governed product-image assets |
| Catalog Identity | `ProductAlias`, `ProductCanonicalMapping`, `ProductDuplicateCandidate`, `SarimaSourceProductMapping`, `CatalogAuditLog` | Deduplication, canonicalization, SARIMA source mapping and audit evidence |
| Inventory | `Inventory`, `InventoryBatch`, `InventoryMovement` | Aggregate stock, batch-authoritative quantities, expiration and auditable movements |
| POS | `Sale`, `SaleItem` | Completed sales and product/batch transaction lines |
| Historical Sales | `HistoricalSalesImportBatch`, `HistoricalSalesImportRow`, `HistoricalMonthlySales` | Import audit trail, row diagnostics and forecast-ready monthly history |
| Forecasting | `ForecastRecord`, `ForecastBatchCache`, `ForecastProductResult` | Persisted demand forecasts, generation batches/cache and product results |
| Recommendations / Restock | `RecommendationRecord`, restock-order models | Restock/stock-risk/expiry-risk decision support and procurement intent |

## Server Reliability & Safety

Sprint 8 established the dedicated server-reliability baseline that remains part of the current system.

| Reliability Area | Implemented Behavior | Verification Baseline |
| --- | --- | --- |
| HTTP Contract | Central supported status contract for backend outcomes | Passed |
| Health Summary | `GET /api/health` | Healthy path verified |
| Liveness | `GET /api/health/live` | Healthy path verified |
| Readiness | `GET /api/health/ready` with critical DB/config checks and `503` degraded behavior | Healthy + failure regressions verified |
| Error Safety | Unexpected/server errors return sanitized generic envelopes | Regression protected |
| DB Diagnostic Safety | Public health output does not expose raw connection diagnostics | Regression protected |
| Request Traceability | Server-generated request UUID returned as `x-request-id` | Verified |
| Safe Logging | Structured request/error logging without request-body/header/token dumping | Verified |
| Frontend Health UI | Reliability state shown to staff/internal UI | Implemented |

Detailed evidence is retained under [`docs/sprints/sprint-8/`](docs/sprints/sprint-8/).

## Catalog Image Quality Pipeline

| Stage | Responsibility |
| --- | --- |
| Upload policy | Validate accepted product-image input and upload constraints |
| Asset persistence | Store source/processed/card/PDP asset metadata in `ProductImageAsset` |
| Processing gate | Control whether an image can enter or re-enter processing |
| Quality engine | Normalize/evaluate catalog imagery through the Python catalog-image engine |
| Approval state | Track `APPROVED`, `NEEDS_REVIEW`, `REJECTED` and processing status |
| Storefront delivery | Resolve approved/current product imagery for customer-facing views |
| Legacy backfill | Migrate legacy image references into the governed asset pipeline where applicable |

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| Styling / UI | Tailwind CSS, Base UI / Radix patterns, GSAP, Lucide |
| Charts | Chart.js / react-chartjs-2, Recharts |
| Backend | Node.js, Express.js, TypeScript |
| ORM | Prisma |
| Database | MySQL Community Server |
| Forecasting | Python, pandas, NumPy, `statsmodels` SARIMA/SARIMAX |
| Catalog Image Engine | Python processing service/module |
| Validation | Zod and domain validation |
| Desktop | Electron |
| Quality / CI | ESLint, Prettier, Husky, GitHub Actions |
| Packaging | electron-builder / NSIS |

For exact dependency declarations, resolved-version notes, licensing status, and subsystem ownership, use [`SYSTEM_TECHNOLOGY_REGISTER.md`](SYSTEM_TECHNOLOGY_REGISTER.md) and [`docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md`](docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md).

## Verification Report

The repository uses layered verification instead of relying on one test command.

| Verification Area | Current Coverage |
| --- | --- |
| Formatting | Prettier check |
| Static quality | ESLint |
| Types | Repository/workspace TypeScript typecheck |
| Database | Prisma client generation + schema validation + disposable CI MySQL database |
| Backend tests | Authentication/security, customer accounts/orders, CORS, catalog/images, inventory, storefront, historical sales, forecast and reliability contracts |
| Frontend tests | Customer auth/account contracts, internal-auth boundary, owner modules, receiving/POS/restock UI contracts and system-health reliability |
| Forecast tests | Python `pytest` forecasting-service suite |
| Guardrails | Repository guardrail tests and preflight/status checks |
| Builds | Frontend, backend, Electron and full-repository build |
| Security | Production dependency reachability audit plus focused security regression tests |
| CI environments | Node.js 22, Python 3.12 and disposable MySQL 8.0 in GitHub Actions |
| Release lane | Sprint candidate → `staging` cleaning/verification → `main` promotion |

## Compliance, Licensing & Support Documentation

YsabelleStore's application packages are marked private. Third-party dependency licenses do **not** automatically relicense the project-authored source code. The repository therefore separates project ownership from third-party attribution and license evidence.

| Document | Purpose |
| --- | --- |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) | Human-readable third-party dependency and service attribution register |
| [`SYSTEM_TECHNOLOGY_REGISTER.md`](SYSTEM_TECHNOLOGY_REGISTER.md) | Full-stack technology and runtime register |
| [`SYSTEM_SUPPORT_MATRIX.md`](SYSTEM_SUPPORT_MATRIX.md) | Supported environments, workflows, integrations and explicit non-support boundaries |
| [`docs/compliance/README.md`](docs/compliance/README.md) | Compliance documentation index and maintenance policy |
| [`docs/compliance/OPEN-SOURCE-ATTRIBUTION.md`](docs/compliance/OPEN-SOURCE-ATTRIBUTION.md) | Open-source attribution statement and UI-library declaration |
| [`docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md`](docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md) | Material software-component inventory |
| [`docs/compliance/EXTERNAL-SERVICES-REGISTER.md`](docs/compliance/EXTERNAL-SERVICES-REGISTER.md) | Resend, Gmail SMTP, Google OAuth and Meta/Facebook service boundaries |
| [`docs/compliance/ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md`](docs/compliance/ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md) | Architecture/runtime ownership and responsibility disclosure |
| [`docs/licenses/README.md`](docs/licenses/README.md) | Third-party license-evidence policy and index |
| [`docs/licenses/TAILWIND-CSS-LICENSE.md`](docs/licenses/TAILWIND-CSS-LICENSE.md) | Preserved Tailwind CSS 3.4.19 MIT license evidence |
| [`docs/support/SUPPORTED-ENVIRONMENTS.md`](docs/support/SUPPORTED-ENVIRONMENTS.md) | Supported runtime/deployment environments |
| [`docs/support/SUPPORTED-FEATURES.md`](docs/support/SUPPORTED-FEATURES.md) | Supported product capabilities |
| [`docs/support/SUPPORTED-DATA-FORMATS.md`](docs/support/SUPPORTED-DATA-FORMATS.md) | Supported import/output/data-format boundaries |
| [`docs/support/LIMITATIONS-AND-NON-GOALS.md`](docs/support/LIMITATIONS-AND-NON-GOALS.md) | Explicit limitations and unsupported/non-goal behavior |

### Primary UI Library Attribution

YsabelleStore uses **Tailwind CSS** as its primary utility styling framework. The project declares Tailwind CSS `^3.4.17`, while the committed npm lockfile resolves **Tailwind CSS 3.4.19**, distributed under the **MIT License** by Tailwind Labs, Inc. Project-specific Tailwind configuration, tokens, utilities and component composition are YsabelleStore implementation work; the Tailwind library itself remains third-party software governed by its upstream license.

The official Tailwind CSS v3.4.19 MIT license text is preserved at [`docs/licenses/TAILWIND-CSS-LICENSE.md`](docs/licenses/TAILWIND-CSS-LICENSE.md).

> **Release compliance rule:** do not infer or invent licenses for other dependencies. Exact license/obligation claims must be verified against the exact resolved dependency or authoritative upstream source before they are promoted to verified release evidence.

## External Service Integrations

Configured service boundaries include:

| Provider / Boundary | Role |
| --- | --- |
| Resend | Production customer email, OTP and password-recovery delivery |
| Gmail SMTP | Development-only registration/login OTP QA |
| Google OAuth | Customer social authentication |
| Facebook / Meta OAuth + Graph API | Customer social authentication |

Credentials and secrets must remain outside committed source. See `.env.example` for non-secret configuration names and [`docs/compliance/EXTERNAL-SERVICES-REGISTER.md`](docs/compliance/EXTERNAL-SERVICES-REGISTER.md) for governance details.

## Supported Deployment Envelope

The current deployment model is local/offline-first and Windows-focused.

| Area | Current Boundary |
| --- | --- |
| Desktop packaging | Windows Electron application |
| Installer | NSIS via Electron Builder |
| Database | Local/approved MySQL deployment through Prisma |
| Web development | Vite frontend + Express backend |
| Packaged renderer | Electron renderer with packaged frontend resources |
| Cloud hosting | Not an established production deployment target |
| Automatic updates | Not part of the current deployment foundation |
| Automatic supplier purchasing | Not supported; owner approval remains required |

Do not claim macOS/Linux packaging or broad browser compatibility as officially supported without explicit QA evidence. See [`SYSTEM_SUPPORT_MATRIX.md`](SYSTEM_SUPPORT_MATRIX.md).

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

| Service | Default URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| Backend | `http://localhost:3001` |
| Health | `http://localhost:3001/api/health` |

## Repository Context for Coding Agents

The persistent repository-context layer was introduced in Sprint 5 so coding-agent sessions can retrieve stable project context without rediscovering the entire architecture on every task.

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
├── docs/                 Architecture, API, compliance, security, standards and sprint evidence
├── testing/              Test and validation guidance
├── deployment/           Build/release/installer guidance
├── scripts/              Repository automation and focused verification tools
├── tools/repo-context/   Persistent repository-context implementation
├── .agents/skills/       Project coding-agent skills
└── .codex/               Project-scoped Codex/MCP configuration
```

## Engineering Principles

| Principle | Rule |
| --- | --- |
| Source of truth | Current code/schema/config/tests outrank stale planning documents |
| Inventory integrity | Preserve stock/batch correctness before convenience |
| Separation | Keep UI, API, database, forecasting and desktop responsibilities separated |
| Explainability | Keep business and forecasting rules defensible for thesis evaluation |
| Scope control | Do not represent future extensions or unverified phases as implemented without source and tests |
| Compliance accuracy | Do not invent third-party license, version, compatibility or support claims |
| Change safety | Prefer targeted, reversible changes and verification proportional to risk |

For full scope boundaries, see [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md).