# YsabelleStore

**Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store**

YsabelleStore is a thesis-grade retail platform that connects POS sales, batch-aware inventory, historical-sales preparation, SARIMA demand forecasting, inventory recommendations, and a customer-facing storefront through one shared backend and data model.

> **Documentation baseline:** this README describes the Sprint 11 release candidate (`staging`) for review into `main`. Current executable source, schema, migrations, tests, lockfiles, and runtime configuration remain the implementation source of truth when an older planning document disagrees.

## Project Snapshot

| Field                             | Current State                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| Active development branch         | `sprint/v0.11/sprint-11`                                                                     |
| Active sprint configuration       | `config/guardrails.json` → **Sprint 11**                                                     |
| Sprint 11 plan                    | [`docs/sprints/sprint-11/README.md`](docs/sprints/sprint-11/README.md)                       |
| Stable release lane               | `main`                                                                                       |
| Release-candidate / cleaning lane | `staging`                                                                                    |
| Historical reliability baseline   | Sprint 8 server reliability/safety verification                                              |
| Thesis forecasting method         | **SARIMA / SARIMAX family**                                                                  |
| Primary database                  | MySQL Community Server via Prisma                                                            |
| Web runtime                       | React/Vite frontend + Express backend                                                        |
| Desktop runtime                   | Electron                                                                                     |
| Windows packaging                 | Electron Builder + NSIS                                                                      |
| Current project scope             | [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md)                                             |
| Repository architecture           | [`docs/architecture/03-folder-architecture.md`](docs/architecture/03-folder-architecture.md) |
| Prisma schema                     | [`database/prisma/schema.prisma`](database/prisma/schema.prisma)                             |
| CI / guardrails                   | [`docs/standards/CI-GUARDRAILS.md`](docs/standards/CI-GUARDRAILS.md)                         |
| Technology register               | [`SYSTEM_TECHNOLOGY_REGISTER.md`](SYSTEM_TECHNOLOGY_REGISTER.md)                             |
| Support matrix                    | [`SYSTEM_SUPPORT_MATRIX.md`](SYSTEM_SUPPORT_MATRIX.md)                                       |
| Third-party notices               | [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)                                           |

## Sprint 11 Release Snapshot

Sprint 11 delivers stability, user-experience improvements, restock safety,
reproducible canonical catalog distribution, and committed customer-story media.
It builds on the Sprint 10 domain baseline without changing the distinction
between canonical master data and live retail transactions.

| Release item                  | Verified baseline                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Sprint / release lane         | v0.11; `staging` -> `main` via review                                                                                   |
| Application display version   | v0.2.0 (`frontend/src/config/appVersion.ts`)                                                                            |
| Private npm workspace version | 0.1.0 (not the application release number)                                                                              |
| Active sprint configuration   | Sprint 11 (`config/guardrails.json`)                                                                                    |
| Canonical database release    | Generation 2 `g2-s12-c5-a2`; schema 12 / catalog 5 / assets 2                                                           |
| Product/image parity          | 50/50 active approved image bindings; 200/200 runtime image identities                                                  |
| Approved motion media         | 6/6 MP4 binaries tracked in Git with SHA-256 release manifest                                                           |
| Release CI evidence           | 6/6 successful jobs at `1885ff51`; [GitHub Actions](https://github.com/Solyuuki/YsabelleStore/actions/runs/38157320745) |

### Sprint 11 Change Report

| Workstream                   | Implemented improvements                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1. HTTP and reliability      | Canonical status semantics, sanitized responses, request traceability, scoped status screens and recovery UX.                     |
| 2. Customer storefront       | Premium Light/Dark themes, accessible account/Quick Sign, Favorites, product discovery, responsive About chapters.                |
| 3. Storefront motion         | Tracked Entrance, About Light/Dark, Catalog, Sales & Inventory and Delivery MP4s with approved integrity hashes.                  |
| 4. Retail operations         | Readable Dashboard/Reports/Receiving/Deliveries; better list pagination, modal layout, status badges and export UX.               |
| 5. Restock safety            | Strict automated draft safeguards; manual Owner buying advisories with acknowledgment; receiving uses approved quantities.        |
| 6. Inventory and checkout    | POS and Storefront share stock-truth protections; batch-aware receiving, integer quantities and concurrent reservation contracts. |
| 7. Forecasting and reporting | Monthly sales calendar, stored SARIMA forecast delivery, historical-sales validation and restock decision evidence.               |
| 8. Customer support          | Customer/staff tickets, Gmail-threaded correspondence, delivery state and explicit resolution lifecycle.                          |
| 9. Team data parity          | Generation 2 migration safeguards, 50 canonical product sources, 200 reconstructed image files and local QA fixtures.             |
| 10. Release hardening        | Source-format checks, regression tests, CI, provenance checks, guarded pull/push and approved media inventory.                    |

### Release Readiness

| Control                    | Evidence / status                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Automated CI               | PASS — repository quality, frontend, backend, Electron, dark-mode and whole-unit contracts.                     |
| Media delivery             | PASS — six tracked MP4 paths; see [approved SHA-256 manifest](docs/sprints/sprint-11/APPROVED-MP4-MEDIA-QA.md). |
| Canonical distribution     | PASS — 50 product identities and 200 generated image variants in rehearsal.                                     |
| Customer-story playback QA | Manual review required on target Windows/browser, including Light/Dark and reduced-motion modes.                |
| Runtime database parity    | Run local-team verification after canonical sync; live tickets, sales and orders are not Git data.              |

## Major System Capabilities

| Module                    | Major Implementation                                                                                                                           | Status                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Product & Catalog         | Product/category records, SKU/barcode identity, pricing, catalog quality controls, aliases, canonical mapping and duplicate-review foundations | Implemented                                                                      |
| POS & Sales               | Cashier sales flow, sale records/items, receipt support, and inventory effects                                                                 | Implemented                                                                      |
| Inventory                 | Aggregate inventory, batch quantities, stock movements, adjustments, reconciliation tooling and stock-integrity checks                         | Implemented                                                                      |
| Batch & Expiration        | Batch codes, received/remaining quantities, expiration dates and batch status monitoring                                                       | Implemented                                                                      |
| Historical Sales          | Validated historical-sales import, row-level validation, overlap handling, rollback/audit-oriented persistence and monthly sales records       | Implemented                                                                      |
| Forecasting               | Product-level monthly SARIMA forecasting, candidate selection, fallback forecasts, metrics, persistence and cached delivery                    | Implemented foundation; Sprint 10 includes further forecasting work              |
| Recommendations / Restock | Forecast/inventory-linked restock and risk guidance with owner-controlled restock workflow                                                     | Implemented in active Sprint 10 scope; later phases remain gated by verification |
| Customer Storefront       | Home/shop discovery, product browsing/detail, search, cart/checkout, pickup-order flow, ratings/reviews and customer account experience        | Implemented                                                                      |
| Internal Access           | Separate OWNER/STAFF authentication boundary, protected operations and trusted-device support                                                  | Implemented                                                                      |
| Customer Access           | Customer accounts, sessions, account/order history, OTP/recovery and social-auth integration boundaries                                        | Implemented                                                                      |
| Catalog Images            | Product image assets, processing/approval states, image-quality pipeline, backfill and storefront delivery                                     | Implemented                                                                      |
| Server Reliability        | Canonical HTTP statuses, health/liveness/readiness, safe errors, request IDs, structured logging and frontend reliability states               | Implemented; Sprint 8 reliability baseline verified                              |
| Desktop                   | Electron runtime and Windows NSIS packaging boundary                                                                                           | Implemented/configured                                                           |

## Sprint 11 Execution Boundary

Sprint 11 prioritizes quality-of-life, stabilization and optimization. The
verified Sprint 10 architecture remains the operational baseline; restock,
stock/batch, POS, Receiving, Storefront and forecasting changes must preserve
their existing domain contracts. Refer to
[the Sprint 11 workstream and Phase 4–6 hardening evidence](docs/sprints/sprint-11/README.md)
and [the restock policy review](docs/sprints/sprint-11/RESTOCK-POLICY-SEPARATION-QA.md).

**Safety boundary:** Automated monthly restock is a guarded Owner-review draft,
not autonomous purchasing. Manual Owner quantities may proceed after explicit
purchasing-warning acknowledgment. Receiving checks saved approved quantities
and stock safety rather than recalculating procurement policy at delivery time.

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
| Customer Authentication | Customer registration/login/session handling, OTP/recovery, social authentication, account APIs and order-history boundary     |
| POS / Stock Domain      | Sales persistence integrated with inventory and batch movement logic                                                           |
| Catalog Services        | Product/category APIs, import services, catalog quality policy, canonical identity utilities and storefront serializers        |
| Storefront API          | Customer catalog/search/product-detail/order endpoints backed by the same product/inventory source of truth                    |
| Historical Sales        | CSV/XLSX-oriented validation/import services with preview, overlap rules, row diagnostics and persisted monthly sales          |
| Forecast Delivery       | Effective-sales preparation, SARIMA execution boundary, forecast persistence, source-version tracking and fallback delivery    |
| Catalog Images          | Upload policy, image asset service, storage/URL handling, processing gate, engine runner and legacy backfill                   |
| Reliability             | Health summary, liveness/readiness endpoints, canonical HTTP status contract, sanitized error boundary and request correlation |
| Observability           | Server-generated request IDs and safe structured request-completion/failure logging                                            |

### Backend Stack

| Category          | Current Technology                                   |
| ----------------- | ---------------------------------------------------- |
| Runtime           | Node.js + TypeScript                                 |
| API               | Express 4                                            |
| ORM               | Prisma 6                                             |
| Database          | MySQL Community Server                               |
| Authentication    | JSON Web Tokens plus project session/OTP/OAuth flows |
| Validation        | Zod + domain validation                              |
| Uploads / Imports | Multer, read-excel-file and import services          |
| Quality           | ESLint, Prettier, Husky and GitHub Actions           |

## API and Service Boundaries

YsabelleStore implements its own Express API. These internal APIs are project-authored application interfaces, not third-party hosted APIs. Major mounted route groups include authentication, customer authentication/account, dashboard, forecasts, historical sales, health, products/POS, catalog, inventory, restock orders, sales, search, and storefront.

Server reliability endpoints include:

| Endpoint                | Responsibility                                         |
| ----------------------- | ------------------------------------------------------ |
| `GET /api/health`       | Overall health summary                                 |
| `GET /api/health/live`  | Process liveness                                       |
| `GET /api/health/ready` | Readiness and critical dependency/configuration checks |

External providers are documented separately in [`docs/compliance/EXTERNAL-SERVICES-REGISTER.md`](docs/compliance/EXTERNAL-SERVICES-REGISTER.md).

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

| Stage             | Source / Output                                                                       |
| ----------------- | ------------------------------------------------------------------------------------- |
| 1. Source sales   | Historical imports + applicable POS actual sales                                      |
| 2. Validation     | Product identity, periods, duplicates, overlaps and row-level diagnostics             |
| 3. Monthly demand | Active `HistoricalMonthlySales` records / effective-sales series                      |
| 4. Forecasting    | Constrained SARIMA candidates + validated fallback logic                              |
| 5. Persistence    | `ForecastRecord`, `ForecastBatchCache` and `ForecastProductResult`                    |
| 6. Delivery       | Backend forecast service → Forecast UI/report consumers                               |
| 7. Recommendation | Forecast demand + current inventory context → recommendation/restock decision support |

## Important Data / Domain Models

| Domain                    | Important Prisma Models                                                                                                 | Purpose                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Internal Users            | `User`, `TrustedDevice`                                                                                                 | OWNER/STAFF identity, roles and trusted-device persistence                          |
| Customer Accounts         | `CustomerAccount`, `CustomerSession` and authentication challenge/identity models                                       | Customer identity and session/auth lifecycle                                        |
| Customer Orders           | `CustomerOrder`, `CustomerOrderItem`                                                                                    | Storefront pickup-order persistence                                                 |
| Catalog                   | `Category`, `Product`                                                                                                   | Canonical product/category, pricing and operational state                           |
| Product Experience        | `ProductReview`, `ProductImageAsset`                                                                                    | Ratings/reviews and governed product-image assets                                   |
| Catalog Identity          | `ProductAlias`, `ProductCanonicalMapping`, `ProductDuplicateCandidate`, `SarimaSourceProductMapping`, `CatalogAuditLog` | Deduplication, canonicalization, SARIMA source mapping and audit evidence           |
| Inventory                 | `Inventory`, `InventoryBatch`, `InventoryMovement`                                                                      | Aggregate stock, batch-authoritative quantities, expiration and auditable movements |
| POS                       | `Sale`, `SaleItem`                                                                                                      | Completed sales and product/batch transaction lines                                 |
| Historical Sales          | `HistoricalSalesImportBatch`, `HistoricalSalesImportRow`, `HistoricalMonthlySales`                                      | Import audit trail, row diagnostics and forecast-ready monthly history              |
| Forecasting               | `ForecastRecord`, `ForecastBatchCache`, `ForecastProductResult`                                                         | Persisted demand forecasts, generation batches/cache and product results            |
| Recommendations / Restock | `RecommendationRecord`, restock-order models                                                                            | Restock/stock-risk/expiry-risk decision support and procurement intent              |

## Server Reliability & Safety

Sprint 8 established the dedicated server-reliability baseline that remains part of the current system.

| Reliability Area     | Implemented Behavior                                                               | Verification Baseline                  |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------- |
| HTTP Contract        | Central supported status contract for backend outcomes                             | Passed                                 |
| Health Summary       | `GET /api/health`                                                                  | Healthy path verified                  |
| Liveness             | `GET /api/health/live`                                                             | Healthy path verified                  |
| Readiness            | `GET /api/health/ready` with critical DB/config checks and `503` degraded behavior | Healthy + failure regressions verified |
| Error Safety         | Unexpected/server errors return sanitized generic envelopes                        | Regression protected                   |
| DB Diagnostic Safety | Public health output does not expose raw connection diagnostics                    | Regression protected                   |
| Request Traceability | Server-generated request UUID returned as `x-request-id`                           | Verified                               |
| Safe Logging         | Structured request/error logging without request-body/header/token dumping         | Verified                               |
| Frontend Health UI   | Reliability state shown to staff/internal UI                                       | Implemented                            |

Detailed evidence is retained under [`docs/sprints/sprint-8/`](docs/sprints/sprint-8/).

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
| Packaging            | electron-builder / NSIS                              |

For exact dependency declarations, resolved-version notes, licensing status, and subsystem ownership, use [`SYSTEM_TECHNOLOGY_REGISTER.md`](SYSTEM_TECHNOLOGY_REGISTER.md) and [`docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md`](docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md).

## Verification Report

The repository uses layered verification instead of relying on one test command.

| Verification Area | Current Coverage                                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formatting        | Prettier check                                                                                                                                       |
| Static quality    | ESLint                                                                                                                                               |
| Types             | Repository/workspace TypeScript typecheck                                                                                                            |
| Database          | Prisma client generation + schema validation + disposable CI MySQL database                                                                          |
| Backend tests     | Authentication/security, customer accounts/orders, CORS, catalog/images, inventory, storefront, historical sales, forecast and reliability contracts |
| Frontend tests    | Customer auth/account contracts, internal-auth boundary, owner modules, receiving/POS/restock UI contracts and system-health reliability             |
| Forecast tests    | Python `pytest` forecasting-service suite                                                                                                            |
| Guardrails        | Repository guardrail tests and preflight/status checks                                                                                               |
| Builds            | Frontend, backend, Electron and full-repository build                                                                                                |
| Security          | Production dependency reachability audit plus focused security regression tests                                                                      |
| CI environments   | Node.js 22, Python 3.12 and disposable MySQL 8.0 in GitHub Actions                                                                                   |
| Release lane      | Sprint candidate → `staging` cleaning/verification → `main` promotion                                                                                |

## Compliance, Licensing & Support Documentation

YsabelleStore's application packages are marked private. Third-party dependency licenses do **not** automatically relicense the project-authored source code. The repository therefore separates project ownership from third-party attribution and license evidence.

| Document                                                                                                           | Purpose                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)                                                                 | Human-readable third-party dependency and service attribution register              |
| [`SYSTEM_TECHNOLOGY_REGISTER.md`](SYSTEM_TECHNOLOGY_REGISTER.md)                                                   | Full-stack technology and runtime register                                          |
| [`SYSTEM_SUPPORT_MATRIX.md`](SYSTEM_SUPPORT_MATRIX.md)                                                             | Supported environments, workflows, integrations and explicit non-support boundaries |
| [`docs/compliance/README.md`](docs/compliance/README.md)                                                           | Compliance documentation index and maintenance policy                               |
| [`docs/compliance/OPEN-SOURCE-ATTRIBUTION.md`](docs/compliance/OPEN-SOURCE-ATTRIBUTION.md)                         | Open-source attribution statement and UI-library declaration                        |
| [`docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md`](docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md)               | Material software-component inventory                                               |
| [`docs/compliance/EXTERNAL-SERVICES-REGISTER.md`](docs/compliance/EXTERNAL-SERVICES-REGISTER.md)                   | Resend, Gmail SMTP, Google OAuth and Meta/Facebook service boundaries               |
| [`docs/compliance/ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md`](docs/compliance/ARCHITECTURE-AND-RUNTIME-DISCLOSURE.md) | Architecture/runtime ownership and responsibility disclosure                        |
| [`docs/licenses/README.md`](docs/licenses/README.md)                                                               | Third-party license-evidence policy and index                                       |
| [`docs/licenses/TAILWIND-CSS-LICENSE.md`](docs/licenses/TAILWIND-CSS-LICENSE.md)                                   | Preserved Tailwind CSS 3.4.19 MIT license evidence                                  |
| [`docs/support/SUPPORTED-ENVIRONMENTS.md`](docs/support/SUPPORTED-ENVIRONMENTS.md)                                 | Supported runtime/deployment environments                                           |
| [`docs/support/SUPPORTED-FEATURES.md`](docs/support/SUPPORTED-FEATURES.md)                                         | Supported product capabilities                                                      |
| [`docs/support/SUPPORTED-DATA-FORMATS.md`](docs/support/SUPPORTED-DATA-FORMATS.md)                                 | Supported import/output/data-format boundaries                                      |
| [`docs/support/LIMITATIONS-AND-NON-GOALS.md`](docs/support/LIMITATIONS-AND-NON-GOALS.md)                           | Explicit limitations and unsupported/non-goal behavior                              |

### Primary UI Library Attribution

YsabelleStore uses **Tailwind CSS** as its primary utility styling framework. The project declares Tailwind CSS `^3.4.17`, while the committed npm lockfile resolves **Tailwind CSS 3.4.19**, distributed under the **MIT License** by Tailwind Labs, Inc. Project-specific Tailwind configuration, tokens, utilities and component composition are YsabelleStore implementation work; the Tailwind library itself remains third-party software governed by its upstream license.

The official Tailwind CSS v3.4.19 MIT license text is preserved at [`docs/licenses/TAILWIND-CSS-LICENSE.md`](docs/licenses/TAILWIND-CSS-LICENSE.md).

> **Release compliance rule:** do not infer or invent licenses for other dependencies. Exact license/obligation claims must be verified against the exact resolved dependency or authoritative upstream source before they are promoted to verified release evidence.

## External Service Integrations

Configured service boundaries include:

| Provider / Boundary               | Role                                                                 |
| --------------------------------- | -------------------------------------------------------------------- |
| Resend                            | Production customer email, OTP and password-recovery delivery        |
| Gmail SMTP                        | Development-only registration/login OTP QA                           |
| Google OAuth                      | Customer social authentication                                       |
| Facebook / Meta OAuth + Graph API | Customer social authentication                                       |
| PayMongo (test mode)              | Hosted checkout and signed payment webhook processing                |
| Gmail API                         | Threaded customer-support replies and inbox synchronization          |
| Cloudflare Workers AI / Groq      | Optional summary-only recommender assistance; deterministic fallback |

Credentials and secrets must remain outside committed source. See `.env.example` for non-secret configuration names and [`docs/compliance/EXTERNAL-SERVICES-REGISTER.md`](docs/compliance/EXTERNAL-SERVICES-REGISTER.md) for governance details.

## Supported Deployment Envelope

The current deployment model is local/offline-first and Windows-focused.

| Area                          | Current Boundary                                   |
| ----------------------------- | -------------------------------------------------- |
| Desktop packaging             | Windows Electron application                       |
| Installer                     | NSIS via Electron Builder                          |
| Database                      | Local/approved MySQL deployment through Prisma     |
| Web development               | Vite frontend + Express backend                    |
| Packaged renderer             | Electron renderer with packaged frontend resources |
| Cloud hosting                 | Not an established production deployment target    |
| Automatic updates             | Not part of the current deployment foundation      |
| Automatic supplier purchasing | Not supported; owner approval remains required     |

Do not claim macOS/Linux packaging or broad browser compatibility as officially supported without explicit QA evidence. See [`SYSTEM_SUPPORT_MATRIX.md`](SYSTEM_SUPPORT_MATRIX.md).

## Windows Team Pull and Data-Parity Guide

This procedure is intended for authorized teammates using **local Windows development
databases**, not live store operations. Before any migration or database convergence,
identify the target MySQL instance and create an independent backup when it already
contains data.

### Prerequisites

| Dependency       | Team baseline                                                                     |
| ---------------- | --------------------------------------------------------------------------------- |
| Operating system | Windows (primary desktop packaging target)                                        |
| Node.js / npm    | Node.js 22 and npm 10+ recommended; root engines require Node >=20.11             |
| Python           | 3.12; also used by SARIMA and catalog-image reconstruction                        |
| Database         | MySQL 8.0 running locally, with its client tools available on PATH                |
| Environment      | Local ignored `.env` based on `.env.example`; configure `DATABASE_URL` correctly  |
| Network          | Required only for optional OAuth/email/payment providers and package installation |

### 1. Obtain the Reviewed Main Release

**Existing checkout** (after the Sprint 11 PR has been merged):

```powershell
git status --short
# Preserve untracked files; resolve tracked changes before switching.
git switch main
git pull --ff-only origin main
npm ci
```

**Fresh checkout** (after the PR has been merged):

```powershell
git clone --branch main https://github.com/Solyuuki/YsabelleStore.git
cd YsabelleStore
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env: local MySQL URL, unique development JWT secret, optional providers.
npm ci
python -m pip install -r forecasting-service/requirements.txt
python -m pip install -r catalog-image-engine/requirements.txt
```

On existing checkouts, ensure the ignored `.env` already contains valid local
configuration **before pulling**: the Husky post-merge hook may run the canonical
synchronizer. If a pull reports a synchronization error, the Git files may have
updated even though the database did not; correct the environment and verify
database state separately.

### 2. Choose the Correct Database Procedure

| Database condition                        | Required action                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Existing compatible Generation 2 local DB | Use normal `git pull` post-merge sync when canonical files changed; inspect the output and run verification.                          |
| New dedicated EMPTY local QA DB           | Run the explicit initial convergence command below; review backup/recovery prompt and type `RECOVER` only for this isolated database. |
| Existing LEGACY / populated DB            | Stop and back up independently. Recovery can reset the database; obtain the owner's approval before continuing.                       |
| AHEAD / DRIFTED DB                        | Do not force a downgrade. The synchronizer refuses incompatible release lineage.                                                      |
| Live transactions or shared production DB | Do not use development fixtures, forced convergence or development schema sync.                                                       |

For **only a new isolated development/QA database** whose data can be replaced,
run the initial convergence interactively after configuring MySQL:

```powershell
node --env-file=.env scripts/canonical-pull-sync.mjs --force
```

This checks migration/catalog integrity, requires a SQL backup and explicit
confirmation on EMPTY/LEGACY recovery, reconstructs approved images and seeds
the deterministic local QA users/50-product stock baseline. The process must
finish with `CANONICAL_PULL_SYNC=PASS`. **Never add
`--confirm-recovery` to bypass review, and do not run this on an active store
database.** The local fixture re-converges stock and may neutralize previous
development batches.

`CANONICAL_PULL_SYNC=NOOP` means the automatic change-path check found nothing
to apply; it does **not** certify a fresh database. On an existing compatible
development database, rerunning with `--force` is also state-changing and
requires a backup and approval to reset its QA stock baseline.

### 3. Verify Canonical Data and Runtime Assets

```powershell
npm run release:security
npm run asset-distribution:verify
npm run team-state:verify
npm run storefront:entrance:verify
npm run storefront:about-origin:verify
npm run storefront:about-delivery:verify
```

Expected: release security PASS, **200 materialized images**, **2 local QA
accounts**, **50 products** with deterministic development stock, and valid
approved Entrance/Origin/Delivery SHA-256 hashes. For all six MP4 hashes,
compare `Get-FileHash -Algorithm SHA256` with the
[approved media manifest](docs/sprints/sprint-11/APPROVED-MP4-MEDIA-QA.md).

For a complete review, check the Storefront entrance and About chapters in both
appearances, including a reduced-motion browser setting; media fallbacks alone
do not demonstrate successful MP4 loading.

### 4. Local Internal QA Accounts

| Role  | Local QA email              | Development password |
| ----- | --------------------------- | -------------------- |
| OWNER | `owner@ysabellestore.local` | `OwnerPass#2026`     |
| STAFF | `staff@ysabellestore.local` | `StaffPass#2026`     |

These are **synthetic, development-only** accounts restored by the local team
fixture. Never use them on a shared production deployment or reuse their
passwords for real users. Customer/OAuth and external-provider credentials are
not supplied by Git.

### 5. Start and Validate

```powershell
npm run dev:web
# Alternative for desktop development, after stopping dev:web:
# npm run dev
```

| Component         | Default local address                    |
| ----------------- | ---------------------------------------- |
| Web frontend      | `http://localhost:5173`                  |
| Express backend   | `http://localhost:3001`                  |
| Backend readiness | `http://localhost:3001/api/health/ready` |

The development orchestrator synchronizes the local Prisma schema before
startup, so it should be used only with an authorized development database.
Run `npm run verify:code` for repository checks.

**Data ownership:** Canonical products, image sources, migrations and tracked
MP4s come from Git. Actual restock tickets, receiving, POS sales, customer
orders, payment states and customer data remain in their respective MySQL
databases; Git pull does not replicate those live records. Teammates needing
identical live tickets must connect to an approved shared QA database instead
of treating Git as a transactional backup.

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

| Principle           | Rule                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| Source of truth     | Current code/schema/config/tests outrank stale planning documents                               |
| Inventory integrity | Preserve stock/batch correctness before convenience                                             |
| Separation          | Keep UI, API, database, forecasting and desktop responsibilities separated                      |
| Explainability      | Keep business and forecasting rules defensible for thesis evaluation                            |
| Scope control       | Do not represent future extensions or unverified phases as implemented without source and tests |
| Compliance accuracy | Do not invent third-party license, version, compatibility or support claims                     |
| Change safety       | Prefer targeted, reversible changes and verification proportional to risk                       |

For full scope boundaries, see [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md).
