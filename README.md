# YsabelleStore

Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store.

## Project Overview

YsabelleStore is a desktop inventory management and recommendation system for Ysabelle's Store. The system records sales, monitors inventory batches and expiration dates, forecasts seasonal demand with SARIMA, and produces practical inventory recommendations for store operations.

## Thesis Overview

| Field | Details |
| --- | --- |
| Thesis Title | Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store |
| Project Name | YsabelleStore |
| Deployment Target | Windows desktop application |
| Forecasting Method | Seasonal Autoregressive Integrated Moving Average |
| Primary Users | Store owner, staff, and thesis evaluators |
| Current Status | Repository foundation established before application development |

## Objectives

| Objective | Outcome |
| --- | --- |
| Product and inventory tracking | Maintain accurate product, stock, batch, and expiration records |
| Sales monitoring | Record sales data used by reporting and forecasting workflows |
| Forecasting | Generate SARIMA-based demand forecasts from historical sales |
| Recommendation support | Convert forecasts and inventory data into restock and risk alerts |
| Desktop deployment | Package the system as a Windows `.exe` using Electron |

## Included Features

| Area | Features |
| --- | --- |
| Product Management | Product records, categories, pricing, product status |
| Sales Recording | Sales entries, item quantities, historical sales data |
| Inventory Monitoring | Current stock, batch quantities, low stock detection |
| Batch Management | Batch-level stock and expiration tracking |
| Import Tools | CSV import and Excel import |
| Forecasting | SARIMA forecasting with Python and statsmodels |
| Recommendations | Restock, low stock, overstock, near expiry, expiry risk |
| Desktop Packaging | Electron desktop application and Windows installer |

## Out of Scope

| Excluded Area | Reason |
| --- | --- |
| PHP and XAMPP | Final stack uses Node.js, Express.js, MySQL Community Server, and Prisma |
| MongoDB | Relational inventory records require MySQL and Prisma migrations |
| Supplier Management | Thesis scope focuses on inventory, forecasting, and recommendations |
| Purchase Orders and Procurement | Not part of the approved feature set |
| GCash API | Payment integration is outside the thesis system scope |
| Cloud Infrastructure | Deployment target is a local desktop application |

## Final Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend/UI | React, TypeScript, Tailwind CSS, shadcn/ui |
| Desktop App | Electron |
| Backend | Node.js, Express.js |
| Database | MySQL Community Server |
| ORM and Migrations | Prisma |
| Forecasting Engine | Python, statsmodels |
| Charts and Analytics | Recharts |
| Fallback Charts | Chart.js |
| Packaging | electron-builder |
| Development Tools | Git, GitHub, npm, npx, ESLint, Prettier, Husky, GitHub Actions |

## System Architecture

```text
Electron Desktop App
  -> React + TypeScript + Tailwind CSS + shadcn/ui
  -> Express.js Backend
  -> Prisma ORM
  -> MySQL Community Server
  -> Python SARIMA Engine
  -> Recommendation Engine
```

## Recommendation Outputs

| Output | Purpose |
| --- | --- |
| Restock Recommendation | Suggests replenishment quantity based on forecasted demand and stock position |
| Low Stock Alert | Flags products below the approved stock threshold |
| Overstock Alert | Flags products with stock above forecast-based movement expectations |
| Near Expiry Alert | Flags batches approaching expiration |
| Expiry Risk Alert | Flags products likely to expire before projected demand consumes them |

## Repository Structure

```text
YsabelleStore/
  .github/
    PULL_REQUEST_TEMPLATE.md
    workflows/
      repository-governance.yml
  docs/
    GITHUB-WORKFLOW.md
    implementation-artifacts/
      m1-abarado/
      m2-ramos/
      m3-vito/
    standards/
      01-big-picture.md
      02-folder-map.md
      03-folder-guide.md
      04-env.md
      05-naming-rules.md
      06-coding-standards.md
      07-member-ownership.md
      08-merge-collisions.md
      09-edge-cases.md
      010-golden-rules.md
  README.md
```

## Team Members

| Member Code | Member | Primary Ownership |
| --- | --- | --- |
| m1 | Abarado | Repository governance, frontend shell, Electron packaging, documentation quality |
| m2 | Ramos | Express API, Prisma models, MySQL migrations, import endpoints |
| m3 | Vito | Python SARIMA engine, analytics, recommendation logic, chart validation |

## Workflow Overview

| Step | Standard |
| --- | --- |
| Branch | Use `member/version/type/task-name` format |
| Commit | Use Conventional Commits |
| Pull Request | Keep scope small and document affected files |
| Review | Require ownership validation and test evidence |
| Merge | Merge only after checks pass and conflicts are resolved |

## Documentation Entry Points

| Document | Purpose |
| --- | --- |
| [GitHub Workflow](docs/GITHUB-WORKFLOW.md) | Branch, commit, PR, merge, and release workflow |
| [Naming Rules](docs/standards/05-naming-rules.md) | Naming standards for branches, code, database, and environment variables |
| [Coding Standards](docs/standards/06-coding-standards.md) | Engineering rules for React, TypeScript, Express, Prisma, Electron, and Python |
| [Member Ownership](docs/standards/07-member-ownership.md) | Team responsibilities and approval workflow |
| [Merge Collisions](docs/standards/08-merge-collisions.md) | Conflict prevention and resolution process |
| [AI Operating System](docs/standards/010-golden-rules.md) | Mandatory rules for AI-assisted development |

## Current Status

| Area | Status |
| --- | --- |
| Repository foundation | Complete |
| Documentation standards | Complete |
| Implementation artifact templates | Complete |
| Application code | Not started |
| Database schema | Not started |
| Forecasting engine | Not started |

