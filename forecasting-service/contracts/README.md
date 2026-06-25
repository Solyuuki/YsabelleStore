# Forecast Contracts

## Purpose

This folder documents the forecast request and response contracts that future forecasting code will use.

## Scope

The contract definitions here are documentation only. They describe the shape of future inputs and outputs without implementing any validation or model logic.

## Responsibilities

| Responsibility   | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| Input contract   | Define the data the forecasting service expects before a forecast can run |
| Output contract  | Define the structured result future forecasting modules must produce      |
| Contract clarity | Keep the data shape stable for backend and reporting integration          |

## ForecastInput

| Field          | Required | Purpose                                                     |
| -------------- | -------- | ----------------------------------------------------------- |
| `productId`    | Yes      | Identifies the item being forecasted                        |
| `salesHistory` | Yes      | Historical sales records used for future demand forecasting |
| `dates`        | Yes      | Date sequence associated with the sales history             |
| `quantity`     | Yes      | Quantity values for each historical record                  |

## ForecastOutput

| Field                | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `predictedDemand`    | Future demand estimate produced by the forecasting layer |
| `confidenceInterval` | Range information associated with the forecast           |
| `forecastHorizon`    | Time span covered by the forecast                        |
| `metadata`           | Context such as generation time, source, or model label  |

## Future Implementation Notes

- Treat these fields as the public contract for forecast-related work.
- Keep the request shape aligned with backend data exports.
- Preserve response stability so downstream systems can read the result safely.

## Validation Checklist

- [x] Input fields are documented
- [x] Output fields are documented
- [x] No implementation code is present
- [x] Contract scope is limited to forecasting
