# Forecasting Foundation

## Purpose

This document defines the architectural boundary for the YsabelleStore forecasting service. The service exists to forecast demand only.

## Scope

This foundation covers service responsibilities, document structure, and future integration boundaries. It does not include model execution, preprocessing code, recommendation logic, or database integration.

## Responsibilities

| Responsibility         | Description                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Data validation        | Confirm that forecast input is complete, chronological, and non-negative before future model execution             |
| Forecast generation    | Produce future demand forecasts through dedicated forecasting modules when they are implemented                    |
| Recommendation support | Provide forecast output that other layers can use for inventory decisions without calculating recommendations here |
| Output generation      | Produce standardized forecast files and structured result objects                                                  |

## Boundary Rules

| Rule                     | Meaning                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| Demand only              | The service forecasts demand and nothing else                           |
| No recommendation engine | Restock, expiry, and other recommendation logic belong to another layer |
| No database ownership    | MySQL and Prisma remain outside this service boundary                   |
| No transport coupling    | Express routes and desktop UI code do not live here                     |

## Future Implementation Notes

- The service should remain isolated from the backend transport layer.
- Input validation must happen before any forecasting step.
- Output artifacts should be deterministic in name and format.
- Any recommendation support must consume forecast results, not create them.

## Validation Checklist

- [x] Demand-only scope is stated
- [x] Responsibilities are documented
- [x] Recommendation logic is explicitly excluded
- [x] Database ownership is excluded
- [x] Output generation is bounded
