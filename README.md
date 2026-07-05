# YsabelleStore

Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store.

## Project Overview

YsabelleStore is a desktop inventory management and recommendation system for Ysabelle's Store. The system records sales, monitors inventory batches and expiration dates, forecasts seasonal demand with SARIMA, and produces practical inventory recommendations for store operations.

## Thesis Overview

| Field              | Details                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Thesis Title       | Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store |
| Project Name       | YsabelleStore                                                                                                      |
| Deployment Target  | Windows desktop application                                                                                        |
| Forecasting Method | Seasonal Autoregressive Integrated Moving Average                                                                  |
| Primary Users      | Store owner, staff, and thesis evaluators                                                                          |
| Current Status     | Sprint 1 foundation integrated with static frontend shell and database foundation                                  |

## Objectives

| Objective                      | Outcome                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| Product and inventory tracking | Maintain accurate product, stock, batch, and expiration records   |
| Sales monitoring               | Record sales data used by reporting and forecasting workflows     |
| Forecasting                    | Generate SARIMA-based demand forecasts from historical sales      |
| Recommendation support         | Convert forecasts and inventory data into restock and risk alerts |
| Desktop deployment             | Package the system as a Windows `.exe` using Electron             |

## Included Features

| Area                 | Features                                                |
| -------------------- | ------------------------------------------------------- |
| Product Management   | Product records, categories, pricing, product status    |
| Sales Recording      | Sales entries, item quantities, historical sales data   |
| Inventory Monitoring | Current stock, batch quantities, low stock detection    |
| Batch Management     | Batch-level stock and expiration tracking               |
| Import Tools         | CSV import and Excel import                             |
| Forecasting          | SARIMA forecasting with Python and statsmodels          |
| Recommendations      | Restock, low stock, overstock, near expiry, expiry risk |
| Desktop Packaging    | Electron desktop application and Windows installer      |

## Out of Scope

| Excluded Area                   | Reason                                                                   |
| ------------------------------- | ------------------------------------------------------------------------ |
| PHP and XAMPP                   | Final stack uses Node.js, Express.js, MySQL Community Server, and Prisma |
| MongoDB                         | Relational inventory records require MySQL and Prisma migrations         |
| Supplier Management             | Thesis scope focuses on inventory, forecasting, and recommendations      |
| Purchase Orders and Procurement | Not part of the approved feature set                                     |
| GCash API                       | Payment integration is outside the thesis system scope                   |
| Cloud Infrastructure            | Deployment target is a local desktop application                         |

## Final Technology Stack

| Layer                | Technology                                                     |
| -------------------- | -------------------------------------------------------------- |
| Frontend/UI          | React, Vite, TypeScript, Tailwind CSS, shadcn/ui               |
| Desktop App          | Electron                                                       |
| Backend              | Node.js, Express.js                                            |
| Database             | MySQL Community Server                                         |
| ORM and Migrations   | Prisma                                                         |
| Forecasting Engine   | Python 3.12+, statsmodels SARIMA/SARIMAX                       |
| Charts and Analytics | Recharts                                                       |
| Fallback Charts      | Chart.js                                                       |
| Validation           | Zod                                                            |
| Authentication       | JWT                                                            |
| Packaging            | electron-builder                                               |
| Development Tools    | Git, GitHub, npm, npx, ESLint, Prettier, Husky, GitHub Actions |

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

## Local Development Setup

The root `.env` file is the main development environment file. Create it from the committed example before starting the app:

```bash
npm ci
cp .env.example .env
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### Local MySQL Community Server

YsabelleStore uses a local MySQL Community Server installation for database development. The frontend, backend, and Electron development workflow still runs through npm workspaces.

Before starting, make sure the `MySQL80` service is running and the `ysabellestore` database exists.

Recommended setup:

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:validate
npx prisma db push --schema database/prisma/schema.prisma
npm run db:seed
```

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
Start-Service MySQL80
```

Start the app:

```bash
npm run dev
```

If you change the Prisma schema, rerun:

```bash
npm run prisma:generate
npm run prisma:validate
npx prisma db push --schema database/prisma/schema.prisma
```

Recommended team pull workflow:

```bash
git pull
npm ci
cp .env.example .env
Start-Service MySQL80
npm run prisma:generate
npm run prisma:validate
npx prisma db push --schema database/prisma/schema.prisma
npm run db:seed
npm run dev
```

## Recommendation Outputs

| Output                 | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| Restock Recommendation | Suggests replenishment quantity based on forecasted demand and stock position |
| Low Stock Alert        | Flags products below the approved stock threshold                             |
| Overstock Alert        | Flags products with stock above forecast-based movement expectations          |
| Near Expiry Alert      | Flags batches approaching expiration                                          |
| Expiry Risk Alert      | Flags products likely to expire before projected demand consumes them         |

## Repository Structure

```text
YsabelleStore/
  .github/
    PULL_REQUEST_TEMPLATE.md
    workflows/
      repository-governance.yml
  backend/
    src/
      config/
      controllers/
      middleware/
      routes/
      services/
      types/
      utils/
      validators/
  database/
    prisma/
      schema.prisma
    migrations/
    seed/
  docs/
    api/
      API-CHECKLIST.md
      API-CONTRACT-FOUNDATION.md
      DTO-STANDARDS.md
      ERROR-STANDARD.md
      FORECASTING-CONTRACT.md
      README.md
      REQUEST-STANDARD.md
      RESPONSE-STANDARD.md
      ROUTE-NAMING.md
      STATUS-CODES.md
      VERSIONING.md
    GITHUB-WORKFLOW.md
    architecture/
      01-system-framework.md
      02-system-architecture.md
      03-folder-architecture.md
      04-database-architecture.md
      05-api-architecture.md
      06-forecasting-architecture.md
      07-electron-architecture.md
      08-module-ownership.md
      09-implementation-roadmap.md
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
  testing/
    COVERAGE-STANDARDS.md
    E2E-TESTING.md
    FORECAST-VALIDATION.md
    INTEGRATION-TESTING.md
    README.md
    TEST-CHECKLIST.md
    TEST-DATA-POLICY.md
    TEST-NAMING.md
    TESTING-FOUNDATION.md
    UNIT-TESTING.md
    VALIDATION-WORKFLOW.md
  config/
    APPLICATION-CONFIG.md
    CONFIG-CHECKLIST.md
    CONFIGURATION-GUIDE.md
    CONSTANTS.md
    ENVIRONMENT-CONFIG.md
    FEATURE-FLAGS.md
    README.md
    VERSIONING-CONFIG.md
  deployment/
    BUILD-VALIDATION.md
    BUILD-WORKFLOW.md
    RELEASE-CHECKLIST.md
    RELEASE-FOLDER-STRUCTURE.md
    README.md
    TROUBLESHOOTING.md
    VERSIONING.md
    WINDOWS-INSTALLER.md
  electron/
    src/
      ipc/
      main/
      preload/
  forecasting-service/
    app/
    data/
    models/
    outputs/
    services/
    tests/
  frontend/
    public/
    src/
      app/
      assets/
      components/
      hooks/
      layouts/
      lib/
      pages/
      schemas/
      services/
      types/
  package.json
  README.md
```

## Sprint 1 Scaffold Status

| Scaffold Area       | Status   | Details                                                                                                                        |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Root Workspace      | Complete | npm workspaces configured for `frontend`, `backend`, and `electron`                                                            |
| Frontend            | Complete | React, Vite, TypeScript, Tailwind CSS, shadcn/ui-ready structure, Recharts, Chart.js fallback, and Zod prepared                |
| Backend             | Complete | Express, TypeScript, Zod, JWT dependency preparation, middleware boundary, route boundary, and environment validation prepared |
| Database            | Complete | Prisma schema foundation, relationships, indexes, and reviewable migration artifact prepared for MySQL Community Server        |
| Electron            | Complete | Main process, preload boundary, IPC boundary, electron-builder configuration, and secure renderer settings prepared            |
| Forecasting Service | Complete | Python service folders and requirements prepared for pandas, numpy, statsmodels, and python-dotenv                             |
| Quality Tooling     | Complete | ESLint, Prettier, Husky, TypeScript base config, environment templates, and workspace scripts added                            |

Sprint 1 creates framework boundaries and static shell surfaces only. Authentication, product management CRUD, live inventory workflows, sales recording, forecasting logic, recommendation logic, and data-connected dashboard features remain unimplemented until their approved sprint tasks.

## Team Members

| Member Code | Member  | Primary Ownership                                                                |
| ----------- | ------- | -------------------------------------------------------------------------------- |
| m1          | Abarado | Repository governance, frontend shell, Electron packaging, documentation quality |
| m2          | Ramos   | Express API, backend validation, Prisma integration boundary, import endpoints   |
| m3          | Vito    | Prisma schema, MySQL migrations, seed strategy, SARIMA and recommendations later |

## Workflow Overview

| Step         | Standard                                                |
| ------------ | ------------------------------------------------------- |
| Branch       | Use `member/version/type/task-name` format              |
| Commit       | Use Conventional Commits                                |
| Pull Request | Keep scope small and document affected files            |
| Review       | Require ownership validation and test evidence          |
| Merge        | Merge only after checks pass and conflicts are resolved |

## Documentation Entry Points

| Document                                                                 | Purpose                                                                           |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| [Architecture Blueprint](docs/architecture/01-system-framework.md)       | Official framework and system blueprint before Sprint 1 implementation            |
| [System Architecture](docs/architecture/02-system-architecture.md)       | Approved Electron, React, Express, Prisma, MySQL, SARIMA, and recommendation flow |
| [API Contract Foundation](docs/api/README.md)                            | Central API request, response, error, DTO, and versioning contract reference      |
| [Implementation Roadmap](docs/architecture/09-implementation-roadmap.md) | Sprint sequence from governance through packaging and defense preparation         |
| [GitHub Workflow](docs/GITHUB-WORKFLOW.md)                               | Branch, commit, PR, merge, and release workflow                                   |
| [Configuration Foundation](config/README.md)                             | Repository-wide configuration strategy and documentation                          |
| [Deployment Foundation](deployment/README.md)                            | Deployment workflow, installer, validation, versioning, and release planning      |
| [Testing Foundation](testing/README.md)                                  | Testing philosophy, naming, coverage, and validation strategy                     |
| [Naming Rules](docs/standards/05-naming-rules.md)                        | Naming standards for branches, code, database, and environment variables          |
| [Coding Standards](docs/standards/06-coding-standards.md)                | Engineering rules for React, TypeScript, Express, Prisma, Electron, and Python    |
| [Member Ownership](docs/standards/07-member-ownership.md)                | Team responsibilities and approval workflow                                       |
| [Merge Collisions](docs/standards/08-merge-collisions.md)                | Conflict prevention and resolution process                                        |
| [Development Execution Framework](docs/standards/010-golden-rules.md)    | Mandatory execution standards for repository development                          |

## Current Status

| Area                          | Status                                 |
| ----------------------------- | -------------------------------------- |
| Repository foundation         | Complete                               |
| Documentation standards       | Complete                               |
| Architecture blueprint        | Complete                               |
| Sprint 1 application scaffold | Complete                               |
| Implementation artifacts      | Reconstructed from repository evidence |
| Business modules              | Not started                            |
| Database schema               | Complete for Sprint 1 foundation       |
| Forecasting engine            | Not started                            |
