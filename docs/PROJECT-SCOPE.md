# YsabelleStore Project Scope

This document is the canonical scope map for current implementation work. It separates the **thesis-core requirements** from **implemented product extensions** and **future product extensions** so planning documents from older sprints cannot silently override the repository's current behavior.

For implemented behavior, current source code, the Prisma schema, migrations, executable configuration, and tests remain authoritative. This document defines product intent and scope boundaries; it does not replace implementation evidence.

## Thesis-Core Scope

The thesis remains centered on an inventory recommender system that uses historical sales and SARIMA demand forecasting to support inventory decisions for Ysabelle's Store.

| Core Area                   | Required Capability                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Product and catalog records | Maintain products, categories, identifiers, pricing, and operational status.                                   |
| Sales/POS                   | Record sales and barcode-assisted item quantities.                                                             |
| Inventory                   | Track usable stock, batch quantities, movements, and stock integrity.                                          |
| Expiration                  | Track expiration dates and identify near-expiry/expiry-risk inventory.                                         |
| Forecasting                 | Use historical sales and SARIMA to forecast seasonal demand.                                                   |
| Recommendations             | Combine demand forecasts and inventory context into restock/risk guidance.                                     |
| Import                      | Support validated CSV/XLSX preparation/import workflows where implemented.                                     |
| Reporting                   | Present operational inventory, sales, forecasting, and recommendation information.                             |
| Access control              | Keep owner/staff capabilities role-appropriate.                                                                |
| Local operation             | Preserve the local desktop/LAN-capable operating model unless a later approved deployment decision changes it. |

SARIMA forecasts **demand**, not expiration dates. Expiry risk is derived from inventory/batch state, time to expiration, and expected demand.

## Current Implemented Extensions

The repository has evolved beyond the minimum thesis-core UI. Current implementation includes customer-facing storefront behavior such as shop/product browsing, cart/checkout or pickup-order flows where present in source, and server-backed storefront search. These implemented features are legitimate current product behavior even when older planning documents describe online ordering or e-commerce as excluded.

Implemented extensions do not change the approved forecasting method. They must reuse the same product, inventory, pricing, availability, authentication, and backend boundaries rather than creating a second source of truth.

## Recommendation and Replenishment Boundary

Inventory recommendations are decision support. They may calculate or propose replenishment using forecast demand, current usable stock, safety stock or thresholds, confirmed incoming stock, and supplier constraints when those inputs are available.

The system must not silently convert a recommendation into an external purchase. If supplier/B2B ordering is introduced as a future product extension, **owner approval is required before a supplier order is sent**. Auto-draft or assisted ordering may prepare a proposal, but final external submission remains an explicit owner-authorized action unless a later approved requirement changes that rule.

## Future Product Extensions

The following may be explored as separately approved product extensions, but must not be represented as already implemented solely because they appear in planning documents:

- supplier catalog/discovery and B2B purchasing integration;
- owner-approved replenishment drafts or purchase-order workflows;
- broader web/LAN access beyond the current deployment envelope;
- additional customer-commerce capabilities consistent with inventory integrity;
- other operational improvements directly connected to the documented store problem.

Future extensions require implementation evidence, tests, and an updated scope decision before the repository context treats them as current behavior.

## Explicit Scope-Control Rules

- Do not introduce a second database or bypass Prisma for application persistence.
- Do not let the frontend directly access MySQL or Prisma.
- Do not use a forecasting model other than the approved SARIMA/SARIMAX family for the thesis demand-forecast result unless the research scope is formally changed.
- Do not add unrelated computer-vision or surveillance features merely because they are technically possible.
- Do not infer that a historical sprint plan still defines current scope when current source and newer approved guidance contradict it.
- Do not claim a future extension is implemented until source, integration, and verification evidence exists.

## Source-of-Truth Precedence

When sources disagree, use this order:

1. Current user/task requirement for the work being performed.
2. Current executable source, schema, migrations, tests, and configuration for implemented behavior.
3. This document for current product/thesis scope classification.
4. Current subsystem architecture/contracts for intended boundaries.
5. Current sprint planning/status for active work.
6. Historical sprint records, superseded plans, and implementation artifacts for history only.

A lower-precedence document must not override a higher-precedence source merely because it uses words such as `official`, `mandatory`, or `approved`.
