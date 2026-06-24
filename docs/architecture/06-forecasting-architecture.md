# Forecasting Architecture

This document defines the SARIMA forecasting flow and recommendation boundaries for YsabelleStore.

## Forecasting Flow

```text
Historical Sales Data
  -> SARIMA Model
  -> Forecasted Demand
  -> Inventory Analysis
  -> Recommendation Engine
  -> System Recommendations
```

## Forecasting Responsibilities

| Stage                  | Responsibility                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| Historical Sales Data  | Provide product-level time-series sales records                              |
| SARIMA Model           | Forecast seasonal demand using Python statsmodels SARIMA/SARIMAX             |
| Forecasted Demand      | Return expected product demand for the selected future period                |
| Inventory Analysis     | Compare forecasted demand against stock and batch state                      |
| Recommendation Engine  | Generate restock, low stock, overstock, near expiry, and expiry risk outputs |
| System Recommendations | Present clear actions and risk explanations to users                         |

## SARIMA Boundaries

| Rule                                              | Explanation                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| SARIMA forecasts demand                           | Historical sales are the primary model input                                            |
| SARIMA does not directly predict expiration dates | Expiration dates come from batch inventory records                                      |
| SARIMA output must be validated                   | Invalid, low-confidence, or failed model output must not drive recommendations silently |
| Forecasting logic must be explainable             | Model behavior and recommendation reasoning must be thesis-defense ready                |

## Expiry Risk Inputs

Expiry risk uses inventory and batch data together with forecasted demand.

| Input             | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| Current stock     | Determines available product quantity             |
| Expiration date   | Determines time remaining for a batch             |
| Batch quantity    | Determines quantity exposed to expiry risk        |
| Forecasted demand | Estimates expected product movement before expiry |

## Recommendation Outputs

| Output                       | Description                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Recommended Restock Quantity | Suggested quantity to replenish based on forecasted demand and available stock |
| Low Stock Alert              | Indicates stock is below required operating level                              |
| Overstock Alert              | Indicates stock is higher than forecasted movement supports                    |
| Near Expiry Alert            | Indicates a batch is approaching its expiration date                           |
| Expiry Risk Alert            | Indicates stock may expire before expected demand consumes it                  |

## Good vs Bad Forecasting Claims

| Good Claim                                                        | Bad Claim                                                 |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| SARIMA forecasts demand from historical sales                     | SARIMA predicts exact expiration dates                    |
| Expiry risk compares forecasted demand with batch expiration data | Expiry risk is only a SARIMA output                       |
| Failed forecasts return a clear reason                            | Failed forecasts are hidden and replaced with fake values |

## Forecasting Validation Checklist

- [ ] Historical sales data is sufficient for the selected forecast period
- [ ] Forecast input dates are valid
- [ ] SARIMA output includes forecasted demand and confidence notes when available
- [ ] Recommendation calculations use validated forecast output
- [ ] Expiry risk uses stock, expiration date, batch quantity, and forecasted demand
