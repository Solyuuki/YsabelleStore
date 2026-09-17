# YsabelleStore Testing and Quality Assurance

> **Current baseline:** `sprint/v0.10/sprint-10`

## Purpose

This directory documents the repository-wide testing architecture for YsabelleStore. Earlier versions of this file described a future testing foundation; the current repository now contains implemented backend, frontend-contract, forecasting, guardrail, security and CI verification. Current executable tests and CI configuration are authoritative.

## Testing Philosophy

| Principle | Description |
| --- | --- |
| Test the boundary | Verify behavior at the layer where failure would be meaningful and diagnosable. |
| Protect contracts | Prioritize API, data, security, inventory and forecasting contracts that span modules. |
| Keep tests focused | A test should state a clear behavior/regression boundary. |
| Separate concerns | Unit/contract/integration/statistical/release checks should remain distinguishable. |
| Validate early | Run fast static/contract checks before promotion; run broader CI gates before release. |
| Make failures traceable | A failure should identify the affected subsystem or contract. |
| Keep production data safe | CI uses disposable/test data and dedicated test configuration rather than production secrets/data. |

## Implemented Test Layers

| Layer | Current Coverage / Mechanism |
| --- | --- |
| Repository guardrails | Node test suite under `scripts/test/`, preflight/status/version checks |
| Frontend contract tests | Customer auth/account, internal auth/role navigation, owner modules, receiving barcode, POS feedback, restock phases and system-health reliability scripts |
| Backend tests | Authentication/security, customer account/recovery/social auth, orders, CORS, catalog/barcodes/images, stock truth, POS search, storefront, forecasts, historical sales, inventory import, restock, HTTP status, health/readiness, error security and request traceability |
| Forecast tests | Python `pytest` suite under `forecasting-service/tests` |
| Database validation | Prisma client generation, schema validation and disposable CI database build |
| Static quality | Prettier, ESLint, TypeScript typecheck |
| Build verification | Full repository build plus individual frontend/backend/electron workspace builds |
| Security verification | `security:audit:production` plus focused backend security regression tests |
| Domain audits | Inventory audit/reconciliation, catalog/SARIMA mapping checks, image/storefront audits where invoked |

## Backend Test Entry Point

`backend/package.json` contains the active backend test command. Major groups include:

- Internal authentication security.
- Customer authentication and HTTP contracts.
- Account/password concurrency and recovery/OTP cryptography.
- Recovery rate limiting.
- Google/Meta social-auth transaction boundaries.
- Remembered authentication.
- Customer order/account behavior.
- CORS.
- Barcode identity/import/receiving.
- Stock truth and POS product search.
- Catalog-image processing/storage/approval/storefront behavior.
- Catalog quality and data flow/dashboard synchronization.
- Storefront/product detail.
- Forecast delivery, overlays, realized accuracy, fallback and Phase 12 input contracts.
- Historical-sales rules and inventory import.
- Restock phases and bulk-delivery/decision contracts.
- HTTP status, health/readiness, error-handler security and request traceability.

## Frontend Test Entry Point

`frontend/package.json` runs TypeScript-based contract tests covering authentication/account behavior, internal authorization/navigation, owner modules, barcode receiving, POS feedback, restock workflows and system-health reliability.

## Forecast Verification

```bash
npm run forecast:validate-data
npm run forecast:generate
npm run forecast:smoke
npm run forecast:test
```

The forecast test command runs `python -m pytest forecasting-service/tests`.

## CI Quality Gate

The primary GitHub Actions CI workflow validates pull requests to `main`, `staging` and `sprint/**` using:

- Ubuntu runner.
- MySQL 8.0 disposable service database.
- Node.js 22.
- Python 3.12.

CI executes, in order:

1. Checkout with repository history.
2. Node/Python setup.
3. `npm ci`.
4. Forecast dependency installation.
5. Prisma client generation.
6. Prisma schema validation.
7. Disposable database creation.
8. Guardrail preflight.
9. Formatting check.
10. ESLint.
11. TypeScript typecheck.
12. Guardrail tests.
13. Workspace tests.
14. Forecast pytest suite.
15. Full repository build.
16. Production dependency/security audit.
17. Version consistency check.
18. Sprint/artifact status verification.
19. Individual frontend/backend/electron workspace builds.

## Useful Verification Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:guardrails
npm test --workspaces --if-present
npm run forecast:test
npm run build
npm run security:audit:production
npm run version:check
npm run verify:status
```

Additional targeted scripts are defined in the root/workspace package manifests.

## Release Assurance Rule

A green single test is not equivalent to release readiness. Promotion should consider the relevant static checks, domain tests, database validation, forecasting tests, security audit, builds and sprint/release evidence together.

## Source of Truth

When this document conflicts with executable tests or `.github/workflows/ci.yml`, the current test source/package scripts/CI workflow are authoritative and this document should be corrected.