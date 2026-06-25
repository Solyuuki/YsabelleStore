# Forecasting Contract

## Purpose

This document defines the communication contract between the Express API and the forecasting service.

## Scope

- Request payload
- Response payload
- Forecast metadata
- Forecast horizon
- Confidence interval
- Error handling

## Communication Flow

```text
Express API
  -> Forecast Service
  -> Forecast response
  -> Express response
```

## Future Request Payload

| Field             | Purpose                                                 |
| ----------------- | ------------------------------------------------------- |
| `productId`       | Identifies the product being forecasted                 |
| `salesHistory`    | Historical sales values used by the forecasting service |
| `dateRange`       | Start and end dates for the request                     |
| `forecastHorizon` | Number of future periods requested                      |

## Future Response Payload

| Field                | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `predictedDemand`    | Forecasted demand output                                 |
| `confidenceInterval` | Forecast uncertainty bounds                              |
| `forecastHorizon`    | Requested or approved time span                          |
| `metadata`           | Supporting context such as source and generation details |

## Metadata Expectations

| Field         | Purpose                         |
| ------------- | ------------------------------- |
| `generatedAt` | Timestamp for forecast creation |
| `source`      | Forecast service identifier     |
| `modelName`   | Model label or version          |
| `requestId`   | Request tracking reference      |

## Error Contract

| Error Type                   | Expected Handling                                      |
| ---------------------------- | ------------------------------------------------------ |
| Invalid request              | Return API validation error before calling the service |
| Forecast service unavailable | Return `503` with a forecast service error             |
| Forecast generation failure  | Return structured failure data with a safe message     |

## Future Implementation Notes

- Express should treat forecast communication as a bounded service contract.
- The forecasting service should not reach back into Express state.
- Response metadata should help trace and validate forecast runs.

## Validation Checklist

- [x] Request payload is documented
- [x] Response payload is documented
- [x] Metadata expectations are documented
- [x] Error handling is documented
