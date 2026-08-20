# YsabelleStore

**Inventory Recommender System Using Seasonal Autoregressive Integrated Moving Average (SARIMA) for Ysabelle's Store**

YsabelleStore is a thesis-grade retail and inventory system that connects sales/POS activity, inventory and batch monitoring, SARIMA demand forecasting, and inventory recommendations. The repository also contains current customer-facing storefront functionality that reuses the same backend/catalog/inventory boundaries.

## Current Repository State

| Field | Current Source |
| --- | --- |
| Active sprint | `config/guardrails.json` |
| Active integration branch | `sprint/v0.5/sprint-5` |
| Current project scope | [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md) |
| Repository architecture | [`docs/architecture/03-folder-architecture.md`](docs/architecture/03-folder-architecture.md) |
| Module ownership | [`docs/architecture/08-module-ownership.md`](docs/architecture/08-module-ownership.md) |
| Execution policy | [`docs/standards/010-golden-rules.md`](docs/standards/010-golden-rules.md) |
| API guidance | [`docs/api/README.md`](docs/api/README.md) |
| Prisma schema | `database/prisma/schema.prisma` |
| Local verification | [`docs/standards/LOCAL-GUARDRAILS.md`](docs/standards/LOCAL-GUARDRAILS.md) |
| CI verification | [`docs/standards/CI-GUARDRAILS.md`](docs/standards/CI-GUARDRAILS.md) |

Historical sprint documents remain useful evidence, but they do not define current implementation state.

## Core Capabilities

Current source should be treated as the final evidence for what is implemented. The repository is organized around these product areas:

- product/catalog management and data-quality tooling;
- sales and POS workflows with inventory effects;
- inventory, batch, movement, and expiration monitoring;
- role-aware authentication and protected operations;
- historical-sales preparation and SARIMA forecasting;
- forecast/inventory-driven recommendation support;
- customer storefront, product browsing, search, cart/checkout or pickup-order behavior where present in current source;
- Electron desktop/runtime integration;
- validation, security, testing, reporting, and repository guardrails.

See [`docs/PROJECT-SCOPE.md`](docs/PROJECT-SCOPE.md) for the distinction between thesis-core requirements, currently implemented product extensions, and future extensions.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript |
| Styling/UI | Tailwind CSS and repository-approved component patterns |
| Desktop | Electron |
| Backend | Node.js, Express.js, TypeScript |
| ORM | Prisma |
| Database | MySQL Community Server |
| Forecasting | Python, statsmodels SARIMA/SARIMAX |
| Validation | Zod and domain validation |
| Quality | ESLint, Prettier, Husky, GitHub Actions |
| Packaging | electron-builder |

## Local Development

Copy `.env.example` to `.env` and keep local secrets only in the ignored environment file.

```bash
npm install
npm run dev
```

Useful commands:

```bash
# Browser-focused local stack without Electron
npm run dev:web

# Resolved runtime endpoints without credentials
npm run runtime:report

# Standard code-quality verification
npm run verify:code

# Active sprint / artifact verification
npm run verify:status -- --member m1
```

The normal local renderer/API defaults are `http://localhost:5173` and `http://localhost:3001`. The root development orchestrator owns the processes it starts and should fail clearly instead of silently moving to random ports.

## Repository Context for Coding Agents

Sprint 5 adds a persistent repository-context layer so coding-agent sessions do not need to rediscover stable architecture on every task.

```bash
npm run repo:context:status -- --json
npm run repo:context:query -- "Fix POS stock deduction after a completed sale" --json
npm run repo:context:benchmark -- "Fix POS stock deduction after a completed sale" --json
npm run repo:context:test
```

Task retrieval automatically refreshes stale mapped context. `status` remains diagnostic. Query results distinguish **primary implementation files** from **secondary dependencies** so an agent can inspect the smallest useful source set first.

Generated context lives in `.ysabelle-context/` and is ignored by Git. It is a navigation cache, not a copy of repository source and not a replacement for current code/schema/configuration.

See [`tools/repo-context/README.md`](tools/repo-context/README.md) for CLI/MCP details.

## Repository Structure

```text
YsabelleStore/
├── frontend/             React/Vite renderer and customer/internal UI
├── backend/              Express API, controllers, services, validation
├── electron/             Desktop main/preload/packaging boundary
├── database/             Prisma schema, migrations, database guidance
├── forecasting-service/  Python SARIMA service and tests
├── docs/                 Architecture, API, security, standards, sprint records
├── testing/              Test and validation guidance
├── deployment/           Build/release/installer guidance
├── scripts/              Repository automation and focused validation tools
├── tools/repo-context/   Persistent repository-context implementation
├── .agents/skills/       Project coding-agent Skill(s)
└── .codex/               Project-scoped Codex/MCP configuration
```

The canonical folder map is [`docs/architecture/03-folder-architecture.md`](docs/architecture/03-folder-architecture.md).

## Engineering Principles

- Keep UI, API, database, forecasting, and desktop responsibilities separated.
- Preserve inventory/data integrity before optimizing convenience.
- Make business rules explainable and testable for thesis evaluation.
- Prefer targeted, reversible changes over unrelated refactors.
- Use the smallest sufficient verification tier during iteration, then run final checks appropriate to risk.
- Treat the current repository as the implementation source of truth; update documentation when reality changes instead of forcing code to match stale plans.
