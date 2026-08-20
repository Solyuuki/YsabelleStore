# Big Picture

YsabelleStore is a thesis-grade retail and inventory system centered on sales-informed inventory management, SARIMA demand forecasting, and inventory recommendation support.

Use [`../PROJECT-SCOPE.md`](../PROJECT-SCOPE.md) as the canonical source for what belongs to the thesis core, what is a currently implemented product extension, and what remains future work. This document provides only the high-level system picture.

## System Purpose

| Purpose | Description |
| --- | --- |
| Operational inventory tracking | Maintain product, batch, stock, movement, and expiration records. |
| Sales/POS evidence | Record sales activity that affects stock and supports reporting/forecasting. |
| Demand forecasting | Use historical sales and SARIMA/SARIMAX-family modeling for seasonal demand. |
| Recommendation support | Convert forecast + inventory context into explainable operational guidance. |
| Retail experience | Support current internal and customer-facing workflows implemented in the repository. |
| Local deployment | Preserve the Electron/local operating model while allowing approved product evolution. |

## Architecture Flow

```text
React / customer + internal UI
        ↓
Express API and domain services
        ↓
Prisma / MySQL
        ↕
Python SARIMA forecasting
        ↓
Forecast and inventory recommendations
```

Electron hosts the local desktop experience and must preserve secure renderer/main-process boundaries.

## Scope Classification

Do not maintain a second out-of-scope table here. Older versions of this document contained absolute exclusions that later conflicted with implemented storefront behavior. Current classification lives in `docs/PROJECT-SCOPE.md`.

Key principles:

- thesis research remains focused on SARIMA demand forecasting and inventory recommendation;
- current storefront/customer features are valid product extensions when supported by current source/tests;
- future supplier/B2B ordering is not considered implemented until evidence exists and requires owner approval before external submission;
- unrelated features that do not support the documented store problem should not be added merely to expand scope.

## Engineering Priorities

- correctness and inventory integrity;
- explainable forecasting/recommendation behavior;
- maintainable layer boundaries;
- role-appropriate access control;
- current source-of-truth consistency;
- focused implementation and risk-based verification.
