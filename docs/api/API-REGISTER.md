# YsabelleStore API Register

> **Baseline:** `sprint/v0.10/sprint-10`
>
> **Authority:** this register is derived from the currently mounted Express routers under `backend/src/routes/`, the forecasting router under `backend/src/modules/forecasting/`, and the root `/api` mount in `backend/src/app.ts`. When an older planning/status document disagrees with mounted source, the mounted source is authoritative for implemented API surface.

## 1. API Runtime Contract

| Item                             | Current Contract                                                       |
| -------------------------------- | ---------------------------------------------------------------------- |
| Base prefix                      | `/api`                                                                 |
| Backend framework                | Express 4 + TypeScript                                                 |
| Internal-user authentication     | `Authorization: Bearer <JWT>` via `requireAuth`                        |
| Internal roles                   | `OWNER`, `STAFF`                                                       |
| Customer authentication          | `ysabelle_customer_session` HTTP-only cookie via `requireCustomerAuth` |
| Customer mutation origin control | `requireAllowedCustomerAuthOrigin` where mounted                       |
| Success envelope                 | `{ success: true, message, data?, meta? }`                             |
| Error envelope                   | `{ success: false, message, error? }`                                  |
| Request correlation              | Server-generated `x-request-id` response header                        |
| Canonical HTTP statuses          | `200, 201, 400, 401, 403, 404, 409, 413, 415, 422, 429, 500, 503`      |

### Access notation

| Label             | Meaning                                                                             |
| ----------------- | ----------------------------------------------------------------------------------- |
| Public            | No internal/customer authentication middleware mounted on the route                 |
| Internal          | Bearer JWT required                                                                 |
| OWNER             | Bearer JWT + `OWNER` role required                                                  |
| OWNER/STAFF       | Bearer JWT + either internal role required                                          |
| Customer          | Valid customer session cookie required                                              |
| Optional customer | Route accepts anonymous callers but can bind behavior to a valid customer session   |
| Allowed-origin    | Customer-auth origin gate is mounted in addition to the listed authentication state |

## 2. Internal Authentication API — `/api/auth`

| Method | Path                               | Access                                          | Input Shape                        | Purpose                                                                                                        |
| ------ | ---------------------------------- | ----------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/auth/login`                  | Public + auth rate limit                        | JSON credentials                   | Internal OWNER/STAFF password login; issues internal JWT and trusted-device token on successful password login |
| POST   | `/api/auth/register`               | Internal                                        | JSON registration payload          | Create an internal user through the authenticated internal boundary                                            |
| GET    | `/api/auth/me`                     | Internal                                        | Bearer token                       | Return current internal user identity                                                                          |
| POST   | `/api/auth/trusted-device/session` | Public route; token-based controller validation | JSON trusted-device token          | Restore/create authenticated session from trusted-device material                                              |
| POST   | `/api/auth/trusted-device/revoke`  | Public route; token-based controller validation | JSON trusted-device token          | Revoke trusted-device persistence                                                                              |
| POST   | `/api/auth/logout`                 | Public route                                    | Controller-defined JSON/empty body | End local internal-auth client state as implemented by controller                                              |

## 3. Customer Authentication API — `/api/customer-auth`

Sensitive customer-auth responses have `Cache-Control: no-store` and `Pragma: no-cache` through router-level middleware.

| Method | Path                                            | Access / Controls                                   | Input Shape                               | Purpose                                                                |
| ------ | ----------------------------------------------- | --------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| GET    | `/api/customer-auth/registration-intent`        | Public + allowed-origin                             | Query/header context                      | Issue registration intent                                              |
| POST   | `/api/customer-auth/registration/email/request` | Public + allowed-origin + rate limits               | JSON email/registration intent data       | Request customer registration email verification                       |
| POST   | `/api/customer-auth/registration/email/verify`  | Public + allowed-origin + rate limits               | JSON OTP/verification data                | Verify registration email challenge                                    |
| POST   | `/api/customer-auth/register`                   | Public + allowed-origin + IP/identity rate limits   | JSON verified registration payload        | Create verified customer account                                       |
| POST   | `/api/customer-auth/login`                      | Public + allowed-origin + IP/identifier rate limits | JSON identifier/password data             | Customer login                                                         |
| GET    | `/api/customer-auth/remembered`                 | Public route                                        | Cookie/browser context                    | List remembered customer-auth accounts for the current browser context |
| POST   | `/api/customer-auth/remembered/continue`        | Public + allowed-origin                             | JSON remembered-auth data                 | Continue remembered authentication flow                                |
| POST   | `/api/customer-auth/remembered/request`         | Public + allowed-origin                             | JSON remembered-auth verification request | Request remembered-auth verification                                   |
| POST   | `/api/customer-auth/remembered/verify`          | Public + allowed-origin                             | JSON remembered-auth verification data    | Verify remembered-auth challenge                                       |
| DELETE | `/api/customer-auth/remembered/:id`             | Public + allowed-origin                             | Path id + browser context                 | Forget one remembered account entry                                    |
| POST   | `/api/customer-auth/email/request`              | Public + allowed-origin + rate limits               | JSON email                                | Request email OTP login                                                |
| POST   | `/api/customer-auth/email/verify`               | Public + allowed-origin + rate limits               | JSON email/OTP                            | Verify email OTP login                                                 |
| POST   | `/api/customer-auth/recovery/request`           | Public + allowed-origin + rate limits               | JSON customer identifier                  | Start password recovery                                                |
| POST   | `/api/customer-auth/recovery/verify`            | Public + allowed-origin + rate limit                | JSON recovery OTP/challenge data          | Verify password-recovery challenge                                     |
| POST   | `/api/customer-auth/recovery/reset`             | Public + allowed-origin + rate limit                | JSON reset token/new-password data        | Reset customer password after verification                             |
| GET    | `/api/customer-auth/social/:provider/start`     | Public + allowed-origin                             | Provider path + query context             | Start Google/Facebook social-auth flow                                 |
| GET    | `/api/customer-auth/social/:provider/callback`  | Public OAuth callback                               | Provider callback query                   | Complete provider callback                                             |
| POST   | `/api/customer-auth/social/link/complete`       | Customer + allowed-origin                           | JSON social-link completion data          | Link social identity to authenticated customer account                 |
| POST   | `/api/customer-auth/social/electron/start`      | Public + allowed-origin                             | JSON provider/electron challenge data     | Start Electron social-auth handoff                                     |
| POST   | `/api/customer-auth/social/electron/redeem`     | Public + allowed-origin                             | JSON handoff redemption data              | Redeem Electron OAuth handoff                                          |
| GET    | `/api/customer-auth/me`                         | Customer                                            | Session cookie                            | Return current customer identity                                       |
| POST   | `/api/customer-auth/logout`                     | Public + allowed-origin                             | Cookie/session context                    | End customer session and clear client session cookie where applicable  |

## 4. Customer Account API — `/api/customer-account`

| Method | Path                                           | Access / Controls                                         | Input Shape               | Purpose                                     |
| ------ | ---------------------------------------------- | --------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| GET    | `/api/customer-account/orders`                 | Customer                                                  | Session cookie            | List authenticated customer's orders        |
| GET    | `/api/customer-account/address`                | Customer                                                  | Session cookie            | Read customer address/profile address state |
| PUT    | `/api/customer-account/address`                | Customer + allowed-origin                                 | JSON address              | Replace/update address                      |
| PATCH  | `/api/customer-account/profile`                | Customer + allowed-origin                                 | JSON profile patch        | Update customer profile                     |
| POST   | `/api/customer-account/username/claim`         | Customer + allowed-origin + IP/account/target rate limits | JSON username             | Claim/change customer username              |
| POST   | `/api/customer-account/password/change`        | Customer + allowed-origin + IP/account rate limits        | JSON current/new password | Change authenticated customer password      |
| GET    | `/api/customer-account/sessions`               | Customer                                                  | Session cookie            | List customer sessions                      |
| POST   | `/api/customer-account/sessions/revoke-others` | Customer + allowed-origin + IP/account rate limits        | Session context           | Revoke other customer sessions              |

## 5. Dashboard API — `/api/dashboard`

| Method | Path                               | Access      | Purpose                           |
| ------ | ---------------------------------- | ----------- | --------------------------------- |
| GET    | `/api/dashboard/summary`           | OWNER/STAFF | Operational dashboard summary     |
| GET    | `/api/dashboard/operations`        | OWNER       | Owner operations/dashboard detail |
| GET    | `/api/dashboard/navigation-badges` | OWNER/STAFF | Navigation badge/count state      |

## 6. Forecast API — `/api/forecasts`

All mounted forecast endpoints require an internal authenticated `OWNER`.

| Method | Path                                 | Input                              | Purpose                                                                  |
| ------ | ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------ |
| GET    | `/api/forecasts/validation`          | Query/context                      | Validate forecast-ready data                                             |
| POST   | `/api/forecasts/generate`            | Controller-defined JSON/empty body | Execute/generate forecasts through backend → Python forecasting boundary |
| GET    | `/api/forecasts/products`            | Query filters                      | List forecast product results                                            |
| GET    | `/api/forecasts/products/:productId` | Product path id                    | Return forecast detail for one product                                   |
| GET    | `/api/forecasts/summary`             | Query/context                      | Forecast summary                                                         |
| GET    | `/api/forecasts/generation-summary`  | Query/context                      | Forecast generation/batch summary                                        |

## 7. Historical Sales API — `/api/historical-sales`

All mounted historical-sales endpoints require internal `OWNER` access.

| Method | Path                                                       | Input                                   | Purpose                                                         |
| ------ | ---------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------- |
| GET    | `/api/historical-sales/template`                           | None                                    | Download/return import template                                 |
| POST   | `/api/historical-sales/preview`                            | Multipart `file`                        | Parse and validate historical-sales import without final commit |
| POST   | `/api/historical-sales/confirm`                            | Multipart `file`                        | Confirm/import validated historical-sales file                  |
| GET    | `/api/historical-sales/batches`                            | Query                                   | List historical-sales import batches                            |
| GET    | `/api/historical-sales/batches/:batchId`                   | Batch path id                           | Return batch summary/detail                                     |
| GET    | `/api/historical-sales/batches/:batchId/rows`              | Batch path id + query                   | Return row-level import diagnostics                             |
| GET    | `/api/historical-sales/batches/:batchId/rollback-impact`   | Batch path id                           | Preview rollback impact                                         |
| POST   | `/api/historical-sales/batches/:batchId/rollback`          | Batch path id + controller-defined JSON | Roll back eligible imported records                             |
| POST   | `/api/historical-sales/batches/:batchId/refresh-forecasts` | Batch path id                           | Refresh forecasts affected by imported history                  |
| GET    | `/api/historical-sales/eligibility`                        | Query/context                           | Report historical-sales import/forecast eligibility             |

## 8. Health / Server Status API — `/api/health`

These routes are public operational probes. Public health output exposes safe state only; raw DB connection credentials are not returned.

| Method | Path                | Success / Degraded Behavior                                                          | Purpose                    |
| ------ | ------------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| GET    | `/api/health`       | `200`; body can report `healthy`, `degraded`, or `unavailable` and readiness boolean | Summary health/status view |
| GET    | `/api/health/live`  | `200` while Express process responds                                                 | Liveness probe             |
| GET    | `/api/health/ready` | `200` when DB is connected and required config is loaded; `503` when not ready       | Readiness probe            |

Readiness currently treats database connectivity and `JWT_SECRET` availability as critical checks.

## 9. POS Product API — `/api/products`

| Method | Path             | Access   | Purpose                                      |
| ------ | ---------------- | -------- | -------------------------------------------- |
| GET    | `/api/products/` | Internal | POS-oriented product listing/search contract |

## 10. POS API — `/api/pos`

| Method | Path                | Access   | Input                 | Purpose                                       |
| ------ | ------------------- | -------- | --------------------- | --------------------------------------------- |
| GET    | `/api/pos/products` | Internal | Query                 | List products for POS                         |
| POST   | `/api/pos/checkout` | Internal | JSON checkout payload | Complete POS sale through checkout controller |

## 11. Catalog Products API — `/api/catalog/products`

| Method | Path                                                                | Access      | Input                               | Purpose                                    |
| ------ | ------------------------------------------------------------------- | ----------- | ----------------------------------- | ------------------------------------------ |
| POST   | `/api/catalog/products/import/preview`                              | OWNER       | Multipart `file`                    | Preview product import                     |
| POST   | `/api/catalog/products/import`                                      | OWNER       | Multipart `file`                    | Commit product import                      |
| POST   | `/api/catalog/products/import/google-drive/preview`                 | OWNER       | JSON Google Drive import reference  | Preview Google Drive product import        |
| POST   | `/api/catalog/products/import/google-drive`                         | OWNER       | JSON Google Drive import reference  | Execute Google Drive product import        |
| GET    | `/api/catalog/products/categories`                                  | OWNER/STAFF | None/query                          | List categories through product controller |
| POST   | `/api/catalog/products/`                                            | OWNER       | JSON product                        | Create product                             |
| GET    | `/api/catalog/products/`                                            | OWNER/STAFF | Query                               | List catalog products                      |
| GET    | `/api/catalog/products/:productId/barcodes`                         | OWNER/STAFF | Product path id                     | List registered product barcodes           |
| POST   | `/api/catalog/products/:productId/barcodes`                         | OWNER       | JSON barcode                        | Register barcode                           |
| PATCH  | `/api/catalog/products/:productId/barcodes/:barcodeId/primary`      | OWNER       | Path ids                            | Set primary barcode                        |
| POST   | `/api/catalog/products/:id/images`                                  | OWNER       | Multipart `image`                   | Upload product image candidate             |
| GET    | `/api/catalog/products/:productId/images/latest`                    | OWNER       | Product path id                     | Get latest image candidate                 |
| GET    | `/api/catalog/products/:productId/images/:imageId/preview/:variant` | OWNER       | Path ids/variant                    | Preview governed product-image variant     |
| POST   | `/api/catalog/products/:productId/images/:imageId/approve`          | OWNER       | Path ids                            | Approve product image                      |
| POST   | `/api/catalog/products/:productId/images/:imageId/reject`           | OWNER       | Path ids + optional controller JSON | Reject product image                       |
| GET    | `/api/catalog/products/:id`                                         | OWNER/STAFF | Product path id                     | Get product detail                         |
| PATCH  | `/api/catalog/products/:id`                                         | OWNER       | JSON patch                          | Update product                             |
| PATCH  | `/api/catalog/products/:id/status`                                  | OWNER       | JSON status                         | Change product operational status          |

## 12. Catalog Categories API — `/api/catalog/categories`

| Method | Path                       | Access | Input         | Purpose         |
| ------ | -------------------------- | ------ | ------------- | --------------- |
| POST   | `/api/catalog/categories/` | OWNER  | JSON category | Create category |

## 13. Inventory API — `/api/inventory`

| Method | Path                                           | Access      | Input                                | Purpose                                      |
| ------ | ---------------------------------------------- | ----------- | ------------------------------------ | -------------------------------------------- |
| GET    | `/api/inventory/`                              | OWNER/STAFF | Query                                | List inventory                               |
| GET    | `/api/inventory/lookup`                        | OWNER/STAFF | Query/search identifiers             | Inventory lookup                             |
| GET    | `/api/inventory/import/template`               | OWNER       | None                                 | Return stock-import template                 |
| POST   | `/api/inventory/import/preview`                | OWNER       | Multipart `file`                     | Preview inventory stock import               |
| POST   | `/api/inventory/import/confirm`                | OWNER       | Multipart `file`                     | Confirm inventory stock import               |
| POST   | `/api/inventory/delivery-sessions/pdf/preview` | OWNER       | Multipart `file`                     | Preview bulk-delivery PDF extraction/mapping |
| POST   | `/api/inventory/delivery-sessions/complete`    | OWNER       | JSON delivery-session payload        | Complete bulk delivery workflow              |
| GET    | `/api/inventory/product/:productId`            | OWNER/STAFF | Product path id                      | Get inventory for product                    |
| POST   | `/api/inventory/deduct`                        | OWNER/STAFF | JSON stock deduction                 | Deduct stock through inventory domain        |
| POST   | `/api/inventory/:productId/stock-in`           | OWNER       | Product path id + JSON stock-in data | Record stock-in/batch receipt                |
| POST   | `/api/inventory/:productId/adjust`             | OWNER       | Product path id + JSON adjustment    | Adjust inventory                             |
| GET    | `/api/inventory/:productId/movements`          | OWNER/STAFF | Product path id + query              | List stock movement history                  |

## 14. Restock API — `/api/restock-orders`

| Method | Path                                                            | Access      | Input                                  | Purpose                                                            |
| ------ | --------------------------------------------------------------- | ----------- | -------------------------------------- | ------------------------------------------------------------------ |
| POST   | `/api/restock-orders/requests`                                  | OWNER/STAFF | JSON restock request                   | Staff/Owner submission boundary; approval remains Owner-controlled |
| GET    | `/api/restock-orders/planning`                                  | OWNER       | Query                                  | Return restock planning/recommendation view                        |
| POST   | `/api/restock-orders/recommendations/:recommendationId/dismiss` | OWNER       | Recommendation id + controller payload | Dismiss recommendation                                             |
| GET    | `/api/restock-orders/`                                          | OWNER       | Query                                  | List restock orders                                                |
| POST   | `/api/restock-orders/`                                          | OWNER       | JSON draft/order                       | Create restock order                                               |
| GET    | `/api/restock-orders/:orderId`                                  | OWNER       | Order id                               | Get order detail                                                   |
| PATCH  | `/api/restock-orders/:orderId`                                  | OWNER       | JSON patch                             | Update order                                                       |
| PUT    | `/api/restock-orders/:orderId/lines`                            | OWNER       | JSON line collection                   | Replace restock lines                                              |
| POST   | `/api/restock-orders/:orderId/approve`                          | OWNER       | Order id                               | Approve restock order                                              |
| POST   | `/api/restock-orders/:orderId/await-delivery`                   | OWNER       | Order id                               | Mark approved order awaiting delivery                              |
| POST   | `/api/restock-orders/:orderId/cancel`                           | OWNER       | Order id / controller JSON             | Cancel restock order                                               |
| POST   | `/api/restock-orders/:orderId/receipts`                         | OWNER       | JSON receipt/arrival data              | Record receipt against restock order                               |
| PATCH  | `/api/restock-orders/:orderId/return-report`                    | OWNER       | JSON report data                       | Save return report                                                 |

## 15. Sales API — `/api/sales`

| Method | Path          | Access   | Purpose    |
| ------ | ------------- | -------- | ---------- |
| GET    | `/api/sales/` | Internal | List sales |

**Source-of-truth note:** the current route registry metadata still labels `/api/sales` as `planned`, but the router is mounted and implements authenticated `GET /api/sales/`. This register treats the mounted source as implemented and records the registry metadata as stale.

## 16. Internal Search API — `/api/search`

| Method | Path           | Access   | Purpose                                             |
| ------ | -------------- | -------- | --------------------------------------------------- |
| GET    | `/api/search/` | Internal | Internal cross-domain/application search controller |

## 17. Storefront API — `/api/storefront`

| Method | Path                                               | Access            | Input               | Purpose                                                                                                     |
| ------ | -------------------------------------------------- | ----------------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/api/storefront/product-images/:imageId/:variant` | Public            | Image id + variant  | Serve approved/public storefront product image variant                                                      |
| GET    | `/api/storefront/categories`                       | Public            | Query               | List storefront-visible categories                                                                          |
| GET    | `/api/storefront/merchandising`                    | Public            | Query/context       | Return storefront merchandising sections/data                                                               |
| GET    | `/api/storefront/products`                         | Public            | Query/search/filter | List/search storefront products                                                                             |
| GET    | `/api/storefront/products/:id/reviews`             | Public            | Product id + query  | List product reviews                                                                                        |
| GET    | `/api/storefront/products/:id/related`             | Public            | Product id          | List related products                                                                                       |
| GET    | `/api/storefront/products/:id`                     | Public            | Product id          | Return storefront product detail                                                                            |
| POST   | `/api/storefront/orders`                           | Optional customer | JSON pickup order   | Create storefront pickup order; can associate order with authenticated customer when a valid session exists |

## 18. API Error and Reliability Conventions

| Concern                      | Current Behavior                                                                             |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| Authentication failure       | `401` through safe `HttpError` contracts                                                     |
| Authorization failure        | `403` through role/origin boundaries                                                         |
| Conflict/domain state        | `409` where controllers/services raise conflict contracts                                    |
| File too large               | `413`; Multer size errors are sanitized to `FILE_TOO_LARGE`                                  |
| Unsupported media            | Canonical contract includes `415`                                                            |
| Validation/domain processing | Canonical contract includes `400` and `422`                                                  |
| Rate limited                 | `429` with `Retry-After` for auth rate limits                                                |
| Unexpected error             | Sanitized `500` with generic public message and request ID rather than raw exception details |
| Readiness failure            | `503` from `/api/health/ready`                                                               |

## 19. Route Governance Rules

1. `backend/src/routes/index.ts` and the mounted child routers define the currently reachable Express API surface.
2. Controller/service/validator source remains authoritative for exact request fields and response DTO fields; this register intentionally does not invent payload fields that are not established by source.
3. New mounted endpoints must update this register in the same coherent change or immediately before release certification.
4. Public/customer/internal boundaries must remain explicit; do not rely on UI hiding as authorization.
5. File-upload endpoints must continue to use centralized upload limits/type policy rather than ad-hoc parsers.
6. Health/readiness output must remain safe for unauthenticated operational probing.
7. Stale planning labels must not override mounted implementation. Conversely, a planning entry alone must not be treated as implemented until a router/controller is actually mounted.

## 20. Primary Source Files

- `backend/src/app.ts`
- `backend/src/routes/index.ts`
- `backend/src/routes/*.routes.ts`
- `backend/src/modules/forecasting/forecast.routes.ts`
- `backend/src/middleware/authMiddleware.ts`
- `backend/src/middleware/customerAuthMiddleware.ts`
- `backend/src/middleware/customerAuthSecurity.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/constants/httpStatusContract.ts`
- `backend/src/utils/apiResponse.ts`

This is an engineering inventory, not a replacement for endpoint-specific controller/validator contracts or generated API documentation.
