# Thesis Scope Alignment

## Project Title

Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store.

## Business Context

Ysabelle's Store is a grocery store located at 110 A. Mabini Street, Pasig City, Metro Manila. The store was established in 2019 and carries more than 300 daily consumer products, including beverages, canned goods, snacks, instant noodles, toiletries, and household products.

The current store process relies on manual inventory monitoring through visual inspection and receipt-based sales records. This creates delays in replenishment decisions and limits the store's ability to anticipate future demand.

## Current Business Problems

| Problem                             | Implementation Relevance                                                           |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| Manual inventory checking           | The system must support computerized inventory monitoring.                         |
| Stock shortages                     | The system must support low-stock visibility and restocking recommendations.       |
| Overstocking risk                   | The system must compare stock position with demand movement and forecasts.         |
| Expiration monitoring difficulty    | The system must track product batches and near-expiry notifications.               |
| Inefficient replenishment decisions | The system must combine current stock, historical sales, and recommendation rules. |
| Limited demand forecasting          | The system must implement SARIMA forecasting from monthly historical sales.        |

## System Scope

The implementation roadmap must align to these approved thesis features:

| Scope Area                    | Expected System Support                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| Sales transaction processing  | Record sales and cashier activity.                                                         |
| Barcode-based stock deduction | Deduct sold products from inventory records after barcode-based sale entry.                |
| Inventory monitoring          | Track current stock, batches, movement history, and inventory status.                      |
| Low-stock alerts              | Flag products below approved reorder levels.                                               |
| Overstock alerts              | Flag products whose stock exceeds demand-based expectations.                               |
| Near-expiry notifications     | Flag batches approaching expiration.                                                       |
| Inventory recommendations     | Recommend restocking and attention actions from forecast, stock, and expiry context.       |
| SARIMA forecasting            | Use two years of monthly historical sales data for demand forecasting.                     |
| Dashboard and reports         | Present operational summaries, forecast outputs, and inventory status to authorized users. |
| CSV/Excel import              | Import historical sales and inventory data for setup and forecasting preparation.          |
| Role-based owner/staff access | Restrict administrative, reporting, and forecasting functions by role.                     |

## Role-Based Access

| Role  | Access Scope                                                                                               |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| Owner | Administrative functions, reports, forecasting results, inventory management, and user/account management. |
| Staff | Sales processing and inventory monitoring.                                                                 |

## Limitations

| Limitation                         | Reason                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| No automated supplier ordering     | The thesis focuses on recommendations, not procurement automation. |
| No online ordering                 | The system is for local store operations.                          |
| No e-commerce integration          | Online commerce is outside the approved scope.                     |
| No mobile app                      | Deployment target is a desktop application.                        |
| No cloud deployment                | The system is designed for local desktop use.                      |
| No multi-branch inventory          | The study focuses only on Ysabelle's Store.                        |
| No forecasting model beyond SARIMA | The approved forecasting method is SARIMA.                         |

## Sprint 2 Relation

Sprint 2 implements the authentication, registration, and role-based access control foundation required before product, inventory, sales, reporting, and forecasting modules are completed. Future records and decisions must be tied to authorized owner or staff users so the system can support secure operational use, role-appropriate workflows, and thesis-aligned access boundaries.
