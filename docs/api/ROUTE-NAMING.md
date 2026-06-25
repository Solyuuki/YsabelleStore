# Route Naming

## Purpose

This document defines REST route naming rules for YsabelleStore.

## Scope

- Route structure
- Versioned paths
- REST naming philosophy
- Example route groups

## Naming Philosophy

| Principle         | Meaning                                        |
| ----------------- | ---------------------------------------------- |
| Resource first    | Name routes after the resource, not the action |
| Versioned paths   | Keep public routes under a version prefix      |
| Predictable nouns | Use plural resource names                      |
| Clear boundaries  | Keep route groups aligned to domain areas      |

## Approved Route Pattern

```text
/api/v1/{resource}
```

## Example Routes

| Route                     | Purpose                 |
| ------------------------- | ----------------------- |
| `/api/v1/products`        | Product resource        |
| `/api/v1/inventory`       | Inventory resource      |
| `/api/v1/sales`           | Sales resource          |
| `/api/v1/batches`         | Batch resource          |
| `/api/v1/forecasts`       | Forecast resource       |
| `/api/v1/recommendations` | Recommendation resource |
| `/api/v1/reports`         | Report resource         |

## Naming Rules

- Use lowercase paths.
- Use plural nouns when the route represents a collection.
- Avoid verbs in route names.
- Keep route groups stable across versions when possible.

## Future Implementation Notes

- Keep route names aligned with DTO and response naming.
- Introduce new route groups only when the domain requires them.
- Use version prefixes before public exposure.

## Validation Checklist

- [x] REST philosophy is documented
- [x] Route examples are listed
- [x] Naming rules are explicit
- [x] Versioned path pattern is defined
