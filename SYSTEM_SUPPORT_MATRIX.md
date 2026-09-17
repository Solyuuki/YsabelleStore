# YsabelleStore System Support Matrix

> **Baseline:** `sprint/v0.10/sprint-10`
>
> This document defines what the current YsabelleStore implementation supports, what is development-only, and what is outside the present deployment envelope. Current executable source, schema, tests, and configuration remain the source of truth if this document becomes stale.

## 1. Platform and Runtime Support

| Area | Supported / Current Baseline | Status | Evidence / Boundary |
| --- | --- | --- | --- |
| Primary desktop platform | Windows | Supported | Electron Builder targets `win` with NSIS packaging. |
| Desktop runtime | Electron | Supported | Desktop workspace is implemented and packaged separately from web/backend code. |
| Browser development runtime | React/Vite development UI | Supported for development/QA | Default local frontend is `http://localhost:5173`. |
| Backend runtime | Node.js + TypeScript + Express | Supported | Root engine requires Node `>=20.11.0`; CI validates with Node 22. |
| Forecast runtime | Python 3.12 in CI | Supported validation baseline | CI installs Python 3.12 and forecasting dependencies. |
| Database | MySQL through Prisma | Supported | Prisma datasource is `mysql`; CI uses MySQL 8.0. |
| Local operation | Local desktop / local service model | Supported | Current project scope preserves local operation. |
| LAN-capable operation | Within current local deployment model | Supported by scope; deployment-specific QA required | Project scope explicitly preserves a local desktop/LAN-capable model. |
| macOS packaged distribution | Not verified | Not officially supported | No macOS packaging target is declared in the active Electron Builder configuration. |
| Linux packaged distribution | Not verified | Not officially supported | No Linux packaging target is declared in the active Electron Builder configuration. |
| Cloud-hosted production deployment | Not part of current deployment envelope | Not supported | Current deployment documentation is offline-first/local and excludes cloud hosting. |
| Automatic application updates | Not implemented in current deployment foundation | Not supported | Current deployment plan excludes auto-update logic. |

## 2. User and Access Support

| User / Role | Supported Capabilities | Status |
| --- | --- | --- |
| OWNER | Internal operational access, protected management flows, forecasting, inventory and administrative capabilities according to route authorization | Supported |
| STAFF | Role-appropriate protected operational access | Supported |
| Customer | Storefront authentication, account/session behavior, product discovery and pickup-order related flows present in source | Supported |
| Trusted internal device | Trusted-device persistence for internal authentication | Supported |
| Customer remembered authentication | Email/mobile remembered-auth persistence where implemented | Supported |

## 3. Functional Domain Support

| Domain | Current Support | Status |
| --- | --- | --- |
| Product catalog | Products, categories, identifiers, prices, operational state, aliases and quality controls | Supported |
| Barcode identity | Manufacturer/internal barcode identity, import and receiving workflows | Supported |
| POS / sales | Product selection, completed sales persistence and inventory effects | Supported |
| Inventory | Aggregate stock, batch quantities, movements, adjustments and integrity checks | Supported |
| Batch / expiration | Batch codes, remaining quantities, expiration state, near-expiry and expiry-risk context | Supported |
| Historical sales | Validated historical-sales preparation/import, row diagnostics, overlap handling and persistence | Supported |
| Forecasting | Product-level monthly SARIMA demand forecasting | Supported |
| Forecast fallback | Seasonal-naive then moving-average fallback when SARIMA output is not usable | Supported |
| Forecast evaluation | MAE, RMSE, MAPE and WAPE evaluation | Supported |
| Inventory recommendations | Restock, low-stock, overstock, near-expiry and expiry-risk decision support | Supported |
| Customer storefront | Browse/search/product-detail/cart/checkout/pickup-order experiences present in source | Supported |
| Catalog imagery | Image assets, quality/approval state, processing gate and storefront delivery | Supported |
| Reporting / dashboards | Operational, sales, inventory and forecast presentation implemented in existing UI/API boundaries | Supported where implemented |

## 4. API Support

YsabelleStore owns its application API. These are project-defined interfaces, not third-party APIs.

| API Group | Registry Status | Current Routing |
| --- | --- | --- |
| `/api/products` | Implemented | POS product search |
| `/api/catalog/products` | Implemented | Catalog products |
| `/api/catalog/categories` | Implemented | Catalog categories |
| `/api/dashboard` | Implemented | Operational dashboard |
| `/api/inventory` | Implemented | Inventory operations |
| `/api/inventory/import` | Implemented | Inventory stock import |
| `/api/forecasts` | Implemented | Forecast delivery/generation boundary |
| `/api/historical-sales` | Implemented | Historical-sales management |
| `/api/restock-orders` | Implemented | Restock-order workflow |
| `/api/storefront` | Implemented | Customer storefront |
| `/api/customer-auth` | Implemented | Customer authentication |
| `/api/customer-account` | Implemented | Customer account |
| `/api/auth` | Routed | Internal authentication |
| `/api/pos` | Routed | POS operations |
| `/api/search` | Routed | Search boundary |
| `/api/health` | Implemented | Health summary |
| `/api/health/live` | Implemented | Liveness |
| `/api/health/ready` | Implemented | Readiness |
| `/api/sales` | Registry currently marks planned while a router is mounted | Mixed / requires registry cleanup |
| `/api/batches` | Planned in registry | Not treated as independently supported route group |
| `/api/recommendations` | Planned in registry | Recommendation data exists, but registry does not declare a completed standalone API group |
| `/api/imports` | Planned in registry | Do not represent as a completed generic API group |
| `/api/reports` | Planned in registry | Do not represent as a completed generic API group |

## 5. External Service Support

| Service | Purpose | Support Classification | Notes |
| --- | --- | --- | --- |
| Resend | Production customer email / OTP / password-recovery delivery | Configured integration | Requires deployment secret/configuration. |
| Gmail SMTP | Development-only registration/login OTP QA | Development-only | Uses a Google App Password; not the production delivery path. |
| Google OAuth | Customer social authentication | Configured integration | Requires client ID/secret. |
| Facebook / Meta OAuth | Customer social authentication | Configured integration | Graph API version is configurable; `.env.example` currently declares `v26.0`. |

External services require valid credentials, provider availability, network access, and compliance with the provider's own terms. They are not bundled open-source components of YsabelleStore.

## 6. Supported Data and File Flows

| Data / File Flow | Current Support | Notes |
| --- | --- | --- |
| CSV historical/inventory-oriented data | Supported where corresponding importer exists | Validation rules apply before persistence. |
| XLSX historical/inventory-oriented data | Supported where corresponding importer exists | Backend uses spreadsheet parsing libraries and domain validation. |
| JSON | Supported internally | Used by frontend/backend APIs and the backend-to-Python forecasting boundary. |
| Product image assets | Supported | Subject to upload/storage/quality processing rules. |
| PDF-related processing | Dependency support exists | `pdfjs-dist` is a backend dependency; feature claims should follow current source paths rather than dependency presence alone. |
| OCR-related processing | Dependency support exists | `tesseract.js` is present; do not claim a user-facing OCR feature without implementation evidence. |

## 7. Reliability and Degraded-State Support

| State / Capability | Support |
| --- | --- |
| Health summary | `GET /api/health` |
| Liveness | `GET /api/health/live` |
| Readiness | `GET /api/health/ready` |
| Database-unavailable handling | Supported reliability state |
| Backend-unavailable handling | Supported frontend reliability state |
| Timeout handling | Supported reliability state |
| Offline presentation | Supported reliability state |
| Request traceability | Server-generated request IDs |
| Error safety | Sanitized unexpected/server error envelope |
| Safe logging | Structured request/error logging without intentional token/body dumping |

## 8. Explicitly Unsupported or Out-of-Scope Behaviors

- Silent or fully automatic supplier purchasing without owner approval.
- A second application database that bypasses the Prisma/MySQL source of truth.
- Direct frontend access to MySQL or Prisma.
- Replacing the approved SARIMA/SARIMAX-family thesis forecast with another forecasting family without a formal research-scope change.
- Claiming SARIMA predicts expiration dates. It forecasts demand; expiry risk is derived separately from batch/inventory state, time and expected demand.
- Cloud production hosting, auto-update, macOS packaging or Linux packaging unless separately implemented and validated.
- Claims of universal browser compatibility without explicit cross-browser QA evidence.

## 9. Support Claim Policy

A capability may be labeled **Supported** only when current source/configuration and appropriate verification evidence exist. Planning documents alone do not establish support. When sources conflict, executable source, schema, migrations, tests and current configuration take precedence over historical plans.
