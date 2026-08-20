# Thesis Scope Alignment

The canonical current scope classification is [`../PROJECT-SCOPE.md`](../PROJECT-SCOPE.md). This document explains how the current product remains aligned with the thesis even though the repository now contains product extensions beyond the minimum thesis UI.

## Thesis Focus

**Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store**

The research problem remains inventory decision support: manual stock monitoring, shortages/overstock risk, expiration visibility, and limited demand forecasting.

## Research-Critical Capabilities

| Thesis Concern            | System Support                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| Manual inventory checking | Computerized product/inventory/batch monitoring.                                              |
| Stock shortages           | Low-stock visibility and forecast-aware replenishment guidance.                               |
| Overstock risk            | Compare inventory position with demand/forecast context.                                      |
| Expiration monitoring     | Batch expiration and near-expiry/expiry-risk handling.                                        |
| Replenishment decisions   | Combine current usable stock, historical sales, forecast output, and defined inventory rules. |
| Demand forecasting        | SARIMA/SARIMAX-family seasonal demand forecasting from historical sales.                      |
| Sales evidence            | POS/sales records that support reporting and forecasting.                                     |
| Role control              | Owner/staff authorization appropriate to operational responsibilities.                        |

## Product Extensions

Customer-facing storefront/shop/search/order behavior present in current source is a **product extension**, not a replacement for the thesis method. It may improve the retail workflow while reusing the same product, pricing, availability, inventory, and backend boundaries.

Older documents that categorically described every online/storefront capability as prohibited reflected an earlier planning state. They must not be used to deny behavior that is already implemented and tested in the current repository.

## Forecasting Boundary

- SARIMA remains the approved demand-forecasting method for the thesis result.
- SARIMA does not directly predict expiration dates.
- Expiry risk combines forecasted demand with current stock, batch quantity, and expiration context.
- Product extensions must not silently replace or misrepresent the research forecasting method.

## Supplier/Replenishment Boundary

Supplier purchasing is not part of the minimum implemented thesis-core requirement. If supplier/B2B ordering is introduced as a product extension, recommendation output may prepare an assisted/auto-draft proposal, but **owner approval is required before an external supplier order is sent**.

## Evidence Rule

Use current source, schema, migrations, tests, and executable configuration to determine what the system actually implements. Use `docs/PROJECT-SCOPE.md` to classify that behavior as thesis core, current product extension, or future extension.
