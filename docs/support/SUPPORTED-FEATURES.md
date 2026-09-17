# Supported Features

> **Baseline:** `sprint/v0.10/sprint-10`

This document is a feature-support register, not a roadmap. Current executable source, schema, tests and configuration control implementation claims.

## Thesis-Core and Operational Features

| Feature Area | Supported Behavior |
| --- | --- |
| Product/catalog management | Product/category records, identifiers, pricing, operational states, barcode/alias/canonical identity controls |
| POS | Product lookup/selection, sales flow, persistence and stock effects |
| Inventory | Aggregate stock, batch-aware quantities, stock movements, adjustments and integrity checks |
| Expiration | Expiration dates, batch status and near-expiry/expiry-risk context |
| Historical sales | Validated historical-sales preparation/import, row-level diagnostics, overlap handling and audit-oriented persistence |
| Forecasting | Product-level monthly SARIMA demand forecasts with bounded candidates and fallback logic |
| Forecast evaluation | MAE, RMSE, MAPE and WAPE metrics |
| Inventory recommendations | Restock, low-stock, overstock, near-expiry and expiry-risk decision support |
| Restock workflow | Restock-order records/workflow where implemented; recommendations remain decision support |
| Operational dashboard | Internal operational summaries and status presentation |
| Customer storefront | Product discovery, search/detail, cart/checkout/pickup-order flows represented by current source |
| Customer accounts | Authentication, sessions, account/order-history related behavior |
| Internal access control | OWNER/STAFF protected operational boundary |
| Social authentication | Google and Facebook/Meta provider integration when configured |
| Email/OTP delivery | Resend production configuration; Gmail SMTP development QA |
| Product imagery | Governed image assets, processing/quality/approval states and storefront delivery |
| Desktop application | Electron Windows desktop shell and packaging boundary |
| Health monitoring | Summary, liveness and readiness endpoints |
| Reliability UX | Healthy/degraded/database-unavailable/backend-unavailable/timeout/offline state handling documented in current system |

## Forecast Support Detail

| Item | Support |
| --- | --- |
| Frequency | Monthly seasonal demand |
| Candidate 1 | `SARIMA(0,1,1)(0,1,1,12)` |
| Candidate 2 | `SARIMA(1,1,0)(0,1,1,12)` |
| Candidate 3 | `SARIMA(1,0,0)(1,0,0,12)` |
| Selection | Lowest finite AIC among successful candidates |
| Fallback | Seasonal naive, then moving average |
| Confidence intervals | When available from fitted model |
| Expiry prediction | **Not supported as a SARIMA output**; expiry risk is derived from inventory/batch state, time and expected demand |

## API Feature Status

The backend route registry marks products/catalog/categories/dashboard/inventory/inventory-import/forecasts/historical-sales/restock-orders/storefront/customer-auth/customer-account as implemented groups. Several additional routers are mounted in source, including internal auth, POS, sales and search. Generic groups marked `planned` in the registry must not be advertised as complete independent APIs until their registry/source contract is reconciled.

## Reliability and Security Features

- Canonical HTTP status handling.
- Health/liveness/readiness checks.
- Sanitized unexpected/server errors.
- Server-generated request IDs.
- Structured safe logging.
- CORS policy.
- JWT-based protected operations.
- Trusted-device persistence.
- Customer OTP/recovery/social-auth persistence and tests.
- Security regression tests for auth, account/recovery, CORS, error handling and request traceability.

## Deployment / Release Support

- Windows NSIS packaging configuration.
- Frontend/backend/electron build validation.
- MySQL disposable CI database.
- Node and Python CI runtime setup.
- Forecast tests, backend/frontend tests, lint, formatting, typechecking, build and security audit gates.

## Conditional / Configuration-Dependent Features

OAuth and outbound email features are supported only when valid external-provider credentials and network access are available. LAN operation depends on local network/environment configuration. These dependencies must be distinguished from core local functionality.