# YsabelleStore Data Model Register

> **Baseline:** `sprint/v0.10/sprint-10`
>
> **Primary authority:** `database/prisma/schema.prisma`
>
> This register documents every Prisma model currently declared in the Sprint 10 schema. It describes persistence responsibilities and important integrity boundaries; it does not invent tables or imply that every persisted foundation has a currently mounted public API.

## 1. Persistence Platform

| Item                        | Current State                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| Database provider           | MySQL                                                                                          |
| ORM/client                  | Prisma Client                                                                                  |
| Schema authority            | `database/prisma/schema.prisma`                                                                |
| Application access boundary | Backend/database layer; renderer/frontend must not access Prisma/MySQL directly                |
| Identifier convention       | Primarily CUID-backed `String` identifiers                                                     |
| Monetary storage            | Prisma `Decimal` with explicit MySQL decimal precision                                         |
| Date/time storage           | Prisma `DateTime`; monthly periods/expiry dates use date-oriented mappings where specified     |
| JSON evidence/diagnostics   | Prisma `Json` fields are used for audit evidence, import rows, forecast detail and diagnostics |

## 2. Model Inventory Summary

The current schema contains **40 Prisma models**, organized below by domain.

| Domain                         | Models                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Internal identity/access       | `User`, `TrustedDevice`                                                                                                                                                                                                                                                                                                                          |
| Customer identity/auth         | `CustomerAccount`, `CustomerRememberedAuth`, `CustomerMobileAuthChallenge`, `CustomerMobileRegistrationChallenge`, `CustomerEmailRegistrationChallenge`, `CustomerEmailAuthChallenge`, `CustomerSocialIdentity`, `CustomerSocialLinkIntent`, `CustomerOAuthTransaction`, `CustomerOAuthHandoff`, `CustomerPasswordResetToken`, `CustomerSession` |
| Catalog/product governance     | `Category`, `Product`, `ProductBarcode`, `ProductImageAsset`, `ProductReview`, `ProductAlias`, `ProductCanonicalMapping`, `ProductDuplicateCandidate`, `SarimaSourceProductMapping`, `CatalogAuditLog`                                                                                                                                           |
| Inventory                      | `Inventory`, `InventoryBatch`, `InventoryMovement`                                                                                                                                                                                                                                                                                               |
| POS / customer orders          | `Sale`, `SaleItem`, `CustomerOrder`, `CustomerOrderItem`                                                                                                                                                                                                                                                                                         |
| Forecasting / historical sales | `ForecastRecord`, `ForecastBatchCache`, `ForecastProductResult`, `HistoricalSalesImportBatch`, `HistoricalMonthlySales`, `HistoricalSalesImportRow`                                                                                                                                                                                              |
| Recommendation / restock       | `RecommendationRecord`, `RestockOrder`, `RestockOrderLine`                                                                                                                                                                                                                                                                                       |

## 3. Internal Identity and Access Models

| Model           | Key Persistence                                                                      | Responsibility / Integrity Boundary                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`          | name, unique email, password hash, role, status                                      | Internal OWNER/STAFF identity. Relates to sales, inventory movements, forecast generation, recommendations, barcode registration, historical imports/rollbacks and restock creation/approval. |
| `TrustedDevice` | user id, unique token hash, device/user-agent metadata, expiry/revocation timestamps | Persists internal trusted-device sessions. Raw trusted-device token is not stored; application service hashes token material before persistence.                                              |

### Internal role/status enums

- `UserRole`: `OWNER`, `STAFF`
- `UserStatus`: `ACTIVE`, `INACTIVE`

## 4. Customer Identity and Authentication Models

| Model                                 | Key Persistence                                                                                                                                                  | Responsibility / Integrity Boundary                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CustomerAccount`                     | name, optional unique username, unique email, optional normalized unique phone, verification timestamps, optional password hash, status                          | Canonical customer identity. Parent for sessions, password resets, social identities/link intents/OAuth handoffs, orders and remembered-auth records. |
| `CustomerRememberedAuth`              | browser token hash, customer id, auth method, trusted-until, last-used                                                                                           | Browser-scoped remembered-auth association. Unique per browser-token/customer pair.                                                                   |
| `CustomerMobileAuthChallenge`         | optional customer id, normalized phone, OTP hash, expiry, consumed timestamp, failed attempts                                                                    | Persisted mobile login challenge foundation. Presence in schema does not by itself prove a currently mounted mobile-auth API.                         |
| `CustomerMobileRegistrationChallenge` | registration-intent hash, normalized phone, OTP hash, expiry/consumption/failed attempts                                                                         | Persisted mobile registration-verification foundation.                                                                                                |
| `CustomerEmailRegistrationChallenge`  | registration-intent hash, normalized email, OTP hash, expiry/consumption/failed attempts                                                                         | Email verification challenge used by customer registration flow.                                                                                      |
| `CustomerEmailAuthChallenge`          | optional customer id, normalized email, OTP hash, expiry/consumption/failed attempts                                                                             | Email OTP login challenge.                                                                                                                            |
| `CustomerSocialIdentity`              | customer id, provider, provider subject/email, provider verification state                                                                                       | Links a customer to Google/Facebook provider identity. Unique provider+subject and customer+provider pairs.                                           |
| `CustomerSocialLinkIntent`            | customer id, token hash, provider identity/email, expiry/use state                                                                                               | Short-lived account-link intent for attaching social identity to an authenticated customer.                                                           |
| `CustomerOAuthTransaction`            | provider, WEB/ELECTRON transport, state hash, browser binding hash, encrypted PKCE verifier, nonce material, electron challenge, return path, expiry/consumption | Server-side OAuth transaction state. Stores hash/ciphertext forms for sensitive transaction material.                                                 |
| `CustomerOAuthHandoff`                | customer id, code hash, verifier challenge, expiry/use timestamps                                                                                                | One-time Electron OAuth handoff persistence.                                                                                                          |
| `CustomerPasswordResetToken`          | customer id, unique token hash, expiry/use timestamps                                                                                                            | Password reset token lifecycle; stores token hash, not raw token.                                                                                     |
| `CustomerSession`                     | customer id, unique session token hash, expiry, revocation, last-used                                                                                            | Server-side customer session lifecycle. Raw session token is represented to the client via cookie; persisted record is token-hash based.              |

### Customer authentication enums

- `CustomerAccountStatus`: `ACTIVE`, `INACTIVE`
- `CustomerSocialProvider`: `GOOGLE`, `FACEBOOK`
- `CustomerOAuthTransport`: `WEB`, `ELECTRON`
- `CustomerRememberedAuthMethod`: `EMAIL`, `MOBILE`

## 5. Catalog and Product Governance Models

| Model                        | Key Persistence                                                                                                                                                                                                          | Responsibility / Integrity Boundary                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Category`                   | unique name/slug, description, active flag, record source, quality status, storefront visibility                                                                                                                         | Canonical product grouping with explicit data-quality/storefront gates.                                                                                                             |
| `Product`                    | category, active image, unique SKU, optional unique legacy barcode, name/description, brand/variant/size/unit, prices, reorder/target stock levels, product status, record source, quality status, storefront visibility | Canonical product identity and commercial configuration. Central relation target for inventory, batches, sales, forecasting, recommendations, orders, catalog identity and restock. |
| `ProductBarcode`             | product id, globally unique barcode, barcode type, primary flag, source, registering user/reference                                                                                                                      | Governed barcode identity. Supports manufacturer/internal barcodes and provenance.                                                                                                  |
| `ProductImageAsset`          | product id, quality/processing state, original/processed/card/PDP storage keys, source MIME/size/dimensions, diagnostics, processing version, approval/rejection/supersession timestamps                                 | Governed catalog-image lifecycle and storefront image selection.                                                                                                                    |
| `ProductReview`              | product id, reviewer display name, rating, comment                                                                                                                                                                       | Storefront product review persistence.                                                                                                                                              |
| `ProductAlias`               | canonical product id, alias type/value/normalized value, source/evidence                                                                                                                                                 | Alternative identity records for imported/raw/SKU/barcode/supplier identifiers.                                                                                                     |
| `ProductCanonicalMapping`    | source product, canonical product, match type, action, reason, evidence, automation/approval metadata                                                                                                                    | Explicit canonicalization/merge mapping between source and canonical product records.                                                                                               |
| `ProductDuplicateCandidate`  | left/right product, match type/confidence/reason/evidence, resolution state                                                                                                                                              | Duplicate-detection/review queue; preserves evidence and resolution status.                                                                                                         |
| `SarimaSourceProductMapping` | source dataset/key/product identity, canonical product, source name/category/price, historical range/totals, confidence/evidence                                                                                         | Controlled mapping between SARIMA source dataset identities and canonical products.                                                                                                 |
| `CatalogAuditLog`            | entity type/id, optional canonical product, action/reason/evidence, automation/actor metadata                                                                                                                            | Catalog identity/data-quality audit trail.                                                                                                                                          |

### Catalog enums

- `ProductUnit`: `PIECE`, `PACK`, `BOX`, `BOTTLE`, `SACHET`, `KILOGRAM`, `GRAM`, `LITER`, `MILLILITER`
- `ProductStatus`: `ACTIVE`, `INACTIVE`, `DISCONTINUED`
- `CatalogRecordSource`: `CATALOG`, `IMPORT`, `TEST_FIXTURE`, `INTERNAL`
- `CatalogQualityStatus`: `APPROVED`, `NEEDS_REVIEW`, `REJECTED`
- `ProductImageQualityStatus`: `APPROVED`, `NEEDS_REVIEW`, `REJECTED`
- `ProductImageProcessingStatus`: `PENDING`, `PROCESSING`, `READY`, `FAILED`
- `ProductBarcodeType`: `MANUFACTURER`, `INTERNAL`
- `ProductBarcodeSource`: `MANUAL`, `IMPORT`, `RECEIVING_SCAN`, `SYSTEM_INTERNAL`, `VERIFIED_BOOTSTRAP`, `MIGRATION`
- `ProductAliasType`: `RAW_NAME`, `SKU`, `BARCODE`, `SUPPLIER_CODE`
- `ProductIdentityMatchType`: `BARCODE`, `SKU`, `SUPPLIER_CODE`, `NORMALIZED_IDENTITY`, `MANUAL_REVIEW`
- `ProductMappingAction`: `MAPPED`, `MERGED`
- `ProductDuplicateStatus`: `PENDING`, `CONFIRMED`, `REJECTED`, `MERGED`
- `SarimaSourceIdentityConfidence`: `HIGH`, `MEDIUM`, `LOW`

## 6. Inventory Models

| Model               | Key Persistence                                                                                                                  | Responsibility / Integrity Boundary                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `Inventory`         | unique product id, aggregate quantity-on-hand, last stock update, optimistic/version field                                       | Aggregate stock projection per product. Product has at most one aggregate inventory record.      |
| `InventoryBatch`    | product id, batch code, quantity received/remaining, optional unit cost, received/expiry date, batch status                      | Physical batch and expiration authority. Product+batch code is unique.                           |
| `InventoryMovement` | inventory/product/batch/user references, movement type, quantity, before/after quantity, reason, reference type/id, created time | Auditable stock-change ledger. Connects physical quantity changes to actor and domain reference. |

### Inventory enums

- `InventoryBatchStatus`: `AVAILABLE`, `LOW_STOCK`, `DEPLETED`, `EXPIRED`, `REMOVED`
- `InventoryMovementType`: `STOCK_IN`, `SALE`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `RETURN_IN`, `RETURN_OUT`, `DAMAGE`, `EXPIRED`, `INITIAL_STOCK`, `STOCK_OUT`, `ADJUSTMENT`, `RETURN`, `DAMAGED`

**Domain rule:** batch/inventory state is stock truth; forecasting is prediction and must not directly mutate physical stock.

## 7. POS and Customer Order Models

| Model               | Key Persistence                                                                                                     | Responsibility / Integrity Boundary                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Sale`              | unique sale number, optional cashier, sale date, subtotal/discount/total, sale status, notes                        | POS sale header and audit context.                                                                   |
| `SaleItem`          | sale, product, optional batch, quantity, unit price, line total                                                     | POS transaction line; can preserve batch allocation used by stock deduction.                         |
| `CustomerOrder`     | optional customer account, unique order number, contact snapshot, fulfillment/payment method, status, totals, notes | Customer storefront pickup-order header. Order can exist without authenticated customer association. |
| `CustomerOrderItem` | order, product, quantity, unit price, total                                                                         | Customer order line.                                                                                 |

### Order/sale enums

- `SaleStatus`: `DRAFT`, `COMPLETED`, `VOIDED`
- `CustomerOrderStatus`: `PENDING`, `CONFIRMED`, `READY_FOR_PICKUP`, `COMPLETED`, `CANCELLED`
- `CustomerFulfillmentMethod`: `STORE_PICKUP`
- `CustomerPaymentMethod`: `CASH_ON_PICKUP`

## 8. Forecasting and Historical-Sales Models

| Model                        | Key Persistence                                                                                                                                                          | Responsibility / Integrity Boundary                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `ForecastRecord`             | product, generator, forecast period, forecasted demand, model name, confidence metadata, status, generated time, optional source import batch                            | Persisted forecast record tied to product/time/model and optionally the source import batch.                     |
| `ForecastBatchCache`         | source/source version/database revision/start month, generation status, active flag, timings/counts/error metadata, generation/validation JSON                           | Batch-level cached forecast generation state and operational metrics.                                            |
| `ForecastProductResult`      | forecast batch, source product identity/name/category/price, result/model status, historical/forecast totals, growth/variance/current demand, warning count, detail JSON | Product-level output payload for a forecast batch. Unique per batch+source product.                              |
| `HistoricalSalesImportBatch` | unique batch code, file name/hash/type/size, import mode/status, row counters, product count, forecast-refresh status, importer/rollback metadata, errors/metadata       | Historical-sales import audit header and rollback/refresh lifecycle.                                             |
| `HistoricalMonthlySales`     | product/period/quantity/pricing, source, import batch, active/replacement/invalidation metadata                                                                          | Effective monthly sales facts used in forecasting preparation while preserving replacement/invalidation history. |
| `HistoricalSalesImportRow`   | import batch/row number, raw JSON, normalized identifiers/period, quantity/pricing, row status/errors/warnings, matched product                                          | Row-level import evidence and diagnostics.                                                                       |

### Forecast/history enums

- `ForecastStatus`: `PENDING`, `GENERATED`, `FAILED`
- `ForecastBatchStatus`: `GENERATING`, `READY`, `FAILED`, `SUPERSEDED`, `EMPTY`
- `ForecastBatchSource`: `DATABASE`, `WORKBOOK_FALLBACK`, `EMPTY`
- `HistoricalSalesImportMode`: `APPEND_ONLY`, `REJECT_ON_OVERLAP`, `REPLACE_IMPORTED_OVERLAPS`
- `HistoricalSalesImportStatus`: `PREVIEWED`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_SKIPS`, `FAILED`, `ROLLED_BACK`
- `HistoricalSalesRowStatus`: `VALID`, `WARNING`, `INVALID`, `UNMATCHED`, `DUPLICATE`, `OVERLAP`, `IMPORTED`, `SKIPPED`, `REPLACED`
- `MonthlySalesSource`: `IMPORTED_HISTORICAL`, `POS_ACTUAL`, `DEVELOPMENT_FIXTURE`
- `ForecastRefreshStatus`: `NOT_REQUIRED`, `PENDING`, `SUCCEEDED`, `FAILED`

## 9. Recommendation and Restock Models

| Model                  | Key Persistence                                                                                                                                     | Responsibility / Integrity Boundary                                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `RecommendationRecord` | product, optional forecast, optional generator, type/severity, recommended quantity, reason, status, generated/resolved timestamps                  | Decision-support record for replenishment/stock/expiry guidance. It is not an external purchase by itself. |
| `RestockOrder`         | unique order number, lifecycle status, creator/approver, notes, approval time, version                                                              | Procurement-intent header with separate create/approve responsibility.                                     |
| `RestockOrderLine`     | order/product, optional recommendation, recommendation source, recommended/requested/received quantity, selected flag, owner override reason, notes | Per-product replenishment decision and receipt tracking. Unique product per restock order.                 |

### Recommendation/restock enums

- `RecommendationType`: `RESTOCK`, `LOW_STOCK`, `OVERSTOCK`, `NEAR_EXPIRY`, `EXPIRY_RISK`
- `RecommendationSeverity`: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- `RecommendationStatus`: `OPEN`, `ACKNOWLEDGED`, `RESOLVED`, `DISMISSED`
- `RestockOrderStatus`: `DRAFT`, `APPROVED`, `AWAITING_DELIVERY`, `PARTIALLY_RECEIVED`, `RECEIVED`, `CANCELLED`
- `RestockRecommendationSource`: `SARIMA`, `LOW_STOCK`, `TARGET_STOCK`, `MANUAL`

## 10. Cross-Domain Relationship Map

| Source                       | Relationship                              | Target / Meaning                                     |
| ---------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `Product`                    | category                                  | `Category` canonical grouping                        |
| `Product`                    | inventory / inventory batches / movements | Stock truth and audit ledger                         |
| `Product`                    | sale items / customer order items         | Transaction demand                                   |
| `Product`                    | historical monthly sales / import rows    | Forecast input history                               |
| `Product`                    | forecast records                          | Persisted demand prediction                          |
| `Product`                    | recommendation records                    | Decision support                                     |
| `Product`                    | restock lines                             | Procurement intent                                   |
| `ForecastRecord`             | recommendation records                    | Forecast-backed recommendation traceability          |
| `HistoricalSalesImportBatch` | monthly sales / rows / forecasts          | Import provenance and affected forecast traceability |
| `User`                       | movements / imports / restock / forecasts | Internal actor accountability                        |
| `CustomerAccount`            | sessions/social identity/orders           | Customer identity lifecycle                          |
| `RestockOrderLine`           | recommendation                            | Recommendation-to-order decision trace               |

## 11. Data Integrity Principles

1. **Single product identity:** `Product` is the canonical application product entity; aliases/mappings/barcodes must resolve toward governed product identity rather than creating parallel truth.
2. **Stock truth:** physical quantity is controlled through `Inventory`, `InventoryBatch`, and `InventoryMovement`; forecast and recommendation records are not stock mutations.
3. **Auditability:** import rows/batches, inventory movements, catalog audit logs, restock creator/approver metadata and replacement/invalidation history preserve decision provenance.
4. **Forecast separation:** SARIMA predicts demand. Expiry risk combines inventory/batch timing with expected demand and is not an expiration forecast.
5. **Customer/internal separation:** `User` and `CustomerAccount` are distinct identity domains with different authentication/session models.
6. **Secret/token minimization:** multiple authentication persistence models store hashes/ciphertext rather than raw reusable secret material.
7. **Source evidence:** historical-sales replacement/rollback and catalog canonicalization preserve evidence rather than silently overwriting history.

## 12. Schema vs Feature Support

A schema model can exist as persistence foundation even when no currently mounted API exposes that capability. In particular, support claims must be established from source routes/services/tests in addition to schema presence. Do not infer a supported UI/API solely because a table exists.

## 13. Change Governance

For any schema change:

1. Update `database/prisma/schema.prisma`.
2. Add/update the corresponding migration.
3. Regenerate Prisma Client and validate schema.
4. Add or update integration/regression tests for affected domain invariants.
5. Update this register for added/removed/repurposed models or enums.
6. Update API/support/security documentation when persistence changes alter exposed behavior.
7. Verify migration and build in the repository CI/disposable MySQL environment before release promotion.

This document is a persistence register; exact field types, indexes, uniqueness constraints and referential actions remain authoritative in the Prisma schema.
