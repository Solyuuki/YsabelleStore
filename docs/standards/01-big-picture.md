# Big Picture

YsabelleStore is a thesis-grade desktop system for inventory monitoring, sales recording, SARIMA forecasting, and inventory recommendation support. This document aligns the team on what the system must do, what it must avoid, and how each technical layer contributes to the final application.

## System Purpose

| Purpose | Description |
| --- | --- |
| Operational inventory tracking | Maintain product, batch, stock, and expiration records |
| Sales-based forecasting | Use historical sales to forecast seasonal demand |
| Recommendation support | Convert forecasts and inventory data into action-oriented alerts |
| Desktop deployment | Deliver a local Windows desktop experience for Ysabelle's Store |

## Approved Scope

| Included Module | Required Capability |
| --- | --- |
| Product Management | Create, update, view, and deactivate products |
| Sales Recording | Record sales transactions and quantities |
| Inventory Monitoring | Track stock levels and batch quantities |
| Batch Inventory Management | Monitor batch-specific stock and expiration dates |
| Expiration Monitoring | Detect near expiry and expiry risk |
| CSV and Excel Import | Import product, inventory, and sales data |
| SARIMA Forecasting | Produce demand forecasts with Python statsmodels |
| Recommendation Engine | Generate restock, low stock, overstock, near expiry, and expiry risk outputs |
| Desktop Deployment | Package the app as a Windows `.exe` |

## Out-of-Scope Decision Table

| Excluded Item | Decision | Reason |
| --- | --- | --- |
| PHP | Not allowed | Final backend stack is Node.js and Express.js |
| XAMPP | Not allowed | Database must use MySQL Community Server directly |
| MongoDB | Not allowed | Relational inventory data requires MySQL and Prisma |
| Supplier Management | Not included | Thesis scope focuses on inventory and recommendations |
| Purchase Orders | Not included | Procurement is outside approved requirements |
| Restock History | Not included | Recommendations are outputs, not procurement tracking |
| GCash API | Not included | Payment integration is outside the system scope |
| Cloud Deployment | Not included | Deployment target is local desktop |

## Architecture Flow

```text
Electron Desktop App
  -> React + TypeScript + Tailwind CSS + shadcn/ui
  -> Express.js Backend
  -> Prisma ORM
  -> MySQL Community Server
  -> Python SARIMA Engine
  -> Recommendation Engine
```

## Engineering Priorities

| Priority | Rule |
| --- | --- |
| Correctness | Inventory and forecast outputs must be explainable and testable |
| Maintainability | Prefer small focused modules over giant files |
| Scope control | Build only approved thesis features |
| Traceability | Every task must have owner, affected files, status, and test result |
| Validation | Inputs, environment variables, imports, and forecasts must be validated |

## Success Checklist

- [ ] Application scope matches approved thesis requirements
- [ ] Technology choices match the final approved stack
- [ ] Every feature has clear ownership
- [ ] Forecast outputs are tied to inventory recommendations
- [ ] Desktop packaging remains part of the delivery plan

