# Sprint 12 — Staging-to-Main Release Review

> **Integration PR:** [#56](https://github.com/Solyuuki/YsabelleStore/pull/56)  
> **Source:** `staging` (from `sprint/v0.12/sprint-12`)  
> **Target:** `main`  
> **Implementation baseline:** `30614b44831a022da30acf245374159968dd6144`  
> **Status:** Review candidate only; no cloud hosting or production deployment performed.

## Abstract

Sprint 12 extends YsabelleStore's mobile retail experience, MPOS camera scanner,
customer storefront, and responsive internal workspaces while preserving the
existing sales/inventory authority. It also adds verified Gardenia product-family
matching, controlled catalog-image persistence/recovery, catalog import
improvements, and privacy-aware rider delivery handoff.

## Verified release identity

| Field                             | Value                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------- |
| Active sprint                     | 12                                                                               |
| App display version               | v0.2.0 (independent of sprint number)                                            |
| npm workspace version             | 0.1.0                                                                            |
| Canonical release                 | `g2-s12-c5-a2`                                                                   |
| Schema / catalog / media versions | 12 / 5 / 2                                                                       |
| Reviewed canonical source catalog | 50 products, 200 media variants                                                  |
| Pre-promotion CI                  | [6/6 passed](https://github.com/Solyuuki/YsabelleStore/actions/runs/38697541211) |
| PR-specific checks                | Must pass on current PR head and reviewed integration result                     |

## New and improved

| Newly added                                                      | Updated / improved                                         |
| ---------------------------------------------------------------- | ---------------------------------------------------------- |
| `dev:mob` and mobile QA preview                                  | Storefront, checkout, account and product-details layouts  |
| Mobile camera barcode scanner                                    | POS, inventory, receiving, dashboard and reporting density |
| Product-family entities and verified Gardenia size membership    | Catalog import identity checks and size selection          |
| Image audit, guarded recovery and reviewed media proposal/export | Owner-edited catalog preservation and PDP freshness        |
| Role-aware rider handoff with privacy boundary                   | Delivery presentation and mobile notification/status UX    |

## Local accounts

| Role     | Local synthetic account                        | Boundaries                        |
| -------- | ---------------------------------------------- | --------------------------------- |
| OWNER    | `owner@ysabellestore.local`                    | Local fixture only                |
| STAFF    | `staff@ysabellestore.local`                    | Local fixture only                |
| CUSTOMER | Register against an isolated local QA database | No shared production user fixture |
| GUEST    | Not authenticated                              | Browsing only where supported     |

Do not use development fixture credentials or populated test databases on a
public server. OAuth, PayMongo, email and Gmail credentials are environment-specific
and must stay outside Git.

## Quick Windows QA guide

**Requirements:** Node 22, npm 10+, Python 3.12, MySQL 8, and the approved
local QA `.env`. Review the target `DATABASE_URL`, create an independent SQL
backup and separately back up the catalog-image storage before any data operation.

```powershell
git clone --branch staging https://github.com/Solyuuki/YsabelleStore.git
cd YsabelleStore
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Edit .env to point to your own QA database; do not use a production URL.
npm ci
python -m pip install -r forecasting-service/requirements.txt
python -m pip install -r catalog-image-engine/requirements.txt

npx prisma migrate deploy --schema database/prisma/schema.prisma
npm run prisma:generate

# Web + API (alternative: npm run dev:mob, or npm run dev for Electron)
npm run dev:web
```

Default local URLs: web `http://localhost:5173`, API
`http://localhost:3001`, mobile preview `http://localhost:5174/mobile-preview.html`.
For a newly empty _disposable_ QA DB, follow the documented explicit initial
canonical convergence procedure. Do not run `state:pull:sync --force` on live data.

```powershell
npm run release:security
npm run asset-distribution:verify
npm run team-state:verify
npm run test:mobile
npm run verify:code
```

## Release approval boundaries

- `main` has additional documentation/evidence commits; reconcile and check PR mergeability.
- Migrations `0015_rider_handoff_customer_note` and `0016_verified_product_families`
  require an authorized backup-first database upgrade.
- The locally approved Happy Cotton runtime image is **not** in the Git-pinned
  canonical media package. The original local QA image recovery did not
  publish Git blobs or a new image version.
- Confirm real-phone camera/HTTPS behavior, POS/storefront concurrency,
  light/dark QA, browser checkout, and safe inventory operations before launch.
- This PR does not configure Railway, create a cloud environment, reset a
  database, or authorize production deployment.

The [PR description](https://github.com/Solyuuki/YsabelleStore/pull/56)
contains the detailed change report, full run guide, CI evidence, risk matrix,
ownership table, and reviewer merge checklist.
