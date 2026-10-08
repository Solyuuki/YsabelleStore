# m1 Task Register

## Completed

| Task ID          | Date       | Scope                                                                   | Affected Files/Modules                                                                                   | Evidence                                | Validation                                                                                           |
| ---------------- | ---------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| YSB-M1-DOC-001   | 2026-06-24 | Repository documentation foundation                                     | `README.md`, `docs/standards/**`, `docs/architecture/**`                                                 | Commits `2413075`, `b70aa63`, `daca167` | Required files exist in repository history; no full validation transcript available for each commit. |
| YSB-M1-FOUND-001 | 2026-06-25 | Cross-layer foundation scaffolds                                        | `backend/**`, `frontend/**`, `electron/**`, `database/**`, `config/**`, `deployment/**`, `testing/**`    | Commits `bbbfdc7` through `c9a8228`     | Later root validation and workspace builds confirmed these foundations compile.                      |
| YSB-M1-GOV-001   | 2026-06-25 | Sprint 1 branch and PR governance                                       | `.github/**`, `docs/GITHUB-WORKFLOW.md`, `docs/sprints/sprint-1/**`                                      | Commits `4431fdb`, `6d845c1`            | Governance files exist and branch rules are documented.                                              |
| YSB-M1-UI-001    | 2026-06-27 | Sprint 1 React frontend app shell                                       | `frontend/src/app/**`, `frontend/src/layouts/**`, `frontend/src/pages/**`, `frontend/src/components/**`  | Commit `68fabf4`                        | `npm run build --workspace frontend` passed; full validation passed with temporary Prisma URL.       |
| YSB-M1-UI-002    | 2026-06-27 | Welcome screen polish                                                   | `frontend/src/pages/WelcomePage.tsx`, `frontend/src/styles/global.css`                                   | Commit `f1edd82`                        | Focused frontend build and full validation recorded as passed.                                       |
| YSB-M1-UI-003    | 2026-06-27 | Welcome footer restoration and alignment                                | `frontend/src/pages/WelcomePage.tsx`, `frontend/src/styles/global.css`, `frontend/tsconfig.app.json`     | Commits `a4bd881`, `15ea425`            | Focused frontend build and full validation recorded as passed.                                       |
| YSB-M1-GOV-002   | 2026-06-27 | Husky and PR guardrail strengthening                                    | `.husky/pre-push`, `.github/workflows/pull-request-checks.yml`, `docs/GITHUB-WORKFLOW.md`                | Commits `ff8a2c7`, `c83060e`, `b3edf99` | Existing report records lint, format, build, and audit passed.                                       |
| YSB-M1-UI-004    | 2026-06-27 | Enterprise shell cohesion and final UI polish                           | `frontend/src/components/app/**`, `frontend/src/layouts/AppLayout.tsx`, `frontend/src/styles/global.css` | Commit `a189f14`                        | Existing report records format, lint, frontend typecheck, build, and audit passed.                   |
| YSB-M1-DOC-002   | 2026-06-29 | Implementation artifact reconstruction and migration rule documentation | `docs/implementation-artifacts/**`, `database/docs/**`, `docs/standards/**`                              | Current documentation-only work         | Validation recorded in this update after commands are run.                                           |

| Task ID                 | Scope                                                      | Status       | Evidence                                                             | Next Action                                                |
| ----------------------- | ---------------------------------------------------------- | ------------ | -------------------------------------------------------------------- | ---------------------------------------------------------- | ----------- |
| YSB-M1-INT-001          | Sprint 1 integration documentation and ownership cleanup   | In progress  | Current `sprint/v0.1/sprint-1` branch and 2026-06-29 artifact update | Complete validation, commit docs, and prepare review.      |
| YSB-M1-ABARADO-20260707 | Maintain current implementation and documentation evidence | Needs Review | m1/v0.2/feat/auth-fullstack-flow                                     | Review generated artifact updates before commit.           |
| YSB-M1-BIZ-20260708     | Sprint 3 planning and integration preparation              | Planned      | docs/sprints/sprint-3/\*\*                                           | Review new Sprint 3 scope and keep UI integration focused. |
| YSB-M1-ABARADO-20260708 | Maintain current implementation and documentation evidence | Completed    | m1/v0.2/feat/auth-fullstack-flow                                     | Review generated artifact updates before commit.           |
| YSB-M1-ABARADO-20260709 | Polish auth UI and session safety flow                     | Needs Review | m1/v0.3/feat/pos-sales-integration                                   | Run push-ready validation and resolve any failures.        | ore commit. |

## Pending

| Task ID            | Scope                                     | Reason Pending                                                                                     | Required Evidence Before Start                           |
| ------------------ | ----------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| YSB-M1-ELC-001     | Electron package smoke/release validation | Electron foundation exists, but packaged desktop release is not yet produced in Sprint 1 evidence. | Electron package/build command and startup smoke result. |
| YSB-M1-FEATURE-001 | Data-connected frontend modules           | Sprint 1 shell is static by design; backend feature APIs are future scope.                         | Approved API endpoints, DTOs, and test data.             |

## Cancelled

| Task ID | Scope | Reason                                                     | Evidence        |
| ------- | ----- | ---------------------------------------------------------- | --------------- |
| None    | None  | No M1 task is recorded as cancelled in repository history. | Not applicable. |

## Completion Rule

A task is complete only when implementation evidence and the matching artifact updates are both present.

## In Progress

| Task ID                 | Scope                                                          | Status             | Evidence                                | Next Action                                           |
| ----------------------- | -------------------------------------------------------------- | ------------------ | --------------------------------------- | ----------------------------------------------------- |
| YSB-M1-ABARADO-20260709 | Polish auth UI and session safety flow                         | Manual QA Required | m1/v0.3/feat/pos-sales-integration      | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260710 | Preserve artifact markdown templates during automation updates | Manual QA Required | sprint/v0.3/sprint-3                    | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260711 | Polish auth UI and session safety flow                         | Manual QA Required | sprint/v0.3/sprint-3                    | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260712 | Preserve artifact markdown templates during automation updates | Manual QA Required | sprint/v0.3/sprint-3                    | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260715 | Preserve artifact markdown templates during automation updates | Manual QA Required | sprint/v0.3/sprint-3                    | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260716 | Preserve artifact markdown templates during automation updates | Manual QA Required | sprint/v0.3/sprint-3                    | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260809 | Polish auth UI and session safety flow                         | In Progress        | sprint/v0.4/sprint-4                    | Run push-ready validation and resolve any failures.   |
| YSB-M1-ABARADO-20260810 | Preserve artifact markdown templates during automation updates | Needs Review       | sprint/v0.4/sprint-4                    | Run push-ready validation and resolve any failures.   |
| YSB-M1-ABARADO-20260811 | Polish auth UI and session safety flow                         | In Progress        | sprint/v0.4/sprint-4                    | Run push-ready validation and resolve any failures.   |
| YSB-M1-ABARADO-20260814 | Preserve artifact markdown templates during automation updates | Needs Review       | sprint/v0.4/sprint-4                    | Run push-ready validation and resolve any failures.   |
| YSB-M1-ABARADO-20260818 | Preserve artifact markdown templates during automation updates | Manual QA Required | sprint/v0.4/sprint-4                    | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260823 | Preserve artifact markdown templates during automation updates | Needs Review       | sprint/v0.6/sprint-6                    | Review generated artifact updates before commit.      |
| YSB-M1-ABARADO-20260824 | Preserve artifact markdown templates during automation updates | Manual QA Required | m1/v0.7/fix/sprint6-sprint7-integration | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260826 | Maintain current implementation and documentation evidence     | Completed          | m1/v0.9/feat/customer-auth-access       | Review generated artifact updates before commit.      |
| YSB-M1-ABARADO-20260827 | Preserve artifact markdown templates during automation updates | Manual QA Required | m1/v0.9/feat/customer-account-recovery  | Perform manual QA on the changed auth/device/UI flow. |
| YSB-M1-ABARADO-20260830 | Maintain current implementation and documentation evidence     | Completed          | m1/v0.9/feat/customer-social-auth       | Review generated artifact updates before commit.      |
| YSB-M1-ABARADO-20260901 | Maintain current implementation and documentation evidence     | Completed          | m1/v0.9/feat/customer-mobile-otp        | Review generated artifact updates before commit.      |
| YSB-M1-ABARADO-20260906 | Maintain current implementation and documentation evidence     | Needs Review       | unknown                                 | Review generated artifact updates before commit.      |
| YSB-M1-ABARADO-20260910 | Maintain current implementation and documentation evidence     | Needs Review       | m1/v0.9/feat/catalog-data-readiness     | Review generated artifact updates before commit.      |

## Sprint 11 HTTP Reliability

| Task ID             | Date       | Scope                                                   | Status    | Evidence                                    | Next Action                                                  |
| ------------------- | ---------- | ------------------------------------------------------- | --------- | ------------------------------------------- | ------------------------------------------------------------ |
| YSB-M1-QOL-HTTP-001 | 2026-09-18 | Complete and standardize HTTP status/transport handling | In Review | `m1/v0.11/fix/http-status-contract`; PR #41 | Complete exact-head automated validation before integration. |

## Sprint 11 Full-Screen Status UX

| Task ID           | Date       | Scope                                                        | Status              | Evidence                                     | Next Action                            |
| ----------------- | ---------- | ------------------------------------------------------------ | ------------------- | -------------------------------------------- | -------------------------------------- |
| YSB-M1-QOL-UI-002 | 2026-09-26 | Standardize full-screen HTTP and reliability status surfaces | Ready for manual QA | `m1/v0.11/feat/status-screen-system`; PR #43 | QA 401/403/404/503 and reliability UI. |

## Sprint 11 CIE White Canvas

Task YSB-M1-CIE-IMG-003 standardizes CIE derivatives and storefront media on pure white.

Evidence: `m1/v0.11/fix/cie-white-catalog-canvas`

Status: In review. Complete exact-head automated validation before integration.

## Sprint 11 Storefront Size Variants

Task YSB-M1-STOREFRONT-VARIANT-004 upgrades the existing product-detail experience with a stock-aware, image-backed package-size selector while preserving each size as an independent product.

Evidence: `sprint/v0.11/sprint-11`; `backend/src/services/storefrontService.ts`; `backend/test/storefront-product-detail.test.ts`; `frontend/src/components/customer/ProductSizeSelector.tsx`; `frontend/src/pages/customer/ProductDetailPage.tsx`; `frontend/src/styles/customer.css`; `scripts/test/storefront-size-variant-ui.test.mjs`

Status: Ready for manual QA. CI #1635 passed on implementation head `b2f0ac6954e19e15857ab320b2b99b697e9389cd`.

## Sprint 11 Product Error State Polish

Task YSB-M1-STOREFRONT-ERROR-005 replaces the product-detail fallback with a compact, premium storefront error card using safe customer-facing copy, balanced typography, responsive action spacing, and a regression guard that prevents raw service URLs from being rendered.

Evidence: `sprint/v0.11/sprint-11`; `frontend/src/pages/customer/ProductDetailPage.tsx`; `frontend/src/styles/customer.css`; `scripts/test/storefront-product-error-state.test.mjs`

Status: Ready for manual QA. CI #1653 passed on implementation head `a46254b427c65fad8448a5c9442123687f7c4a19`.

## Sprint 11 Catalog Identity Hardening

Task YSB-M1-CATALOG-IDENTITY-006 closes the variant-readiness gap across Owner Products, CSV/XLSX import, ZIP package import, and the canonical 50-product release.

Evidence: `backend/src/services/productImportService.ts`; `frontend/src/services/catalogApi.ts`; `frontend/src/pages/ProductsPageLegacy.tsx`; `frontend/src/components/catalog/ProductPackageImportDialog.tsx`; `database/canonical/product-identities.json`; `database/canonical/releases/g2-s2-c4-a2.json`; `database/seed/canonical-catalog-v1.sql`; `scripts/canonical-release-security.mjs`; `scripts/test/catalog-product-identity-contract.test.mjs`

Status: Ready for manual QA. CI #1693 passed on implementation head `6f148cb3b8fcc76e32608e254e1e71ab67511e51`.

## Sprint 11 Canonical Product Reconstruction Gap

Task YSB-M1-CANONICAL-MATERIALIZE-007 tracks a GEN2 canonical materialization defect discovered during manual QA after legacy recovery. The authoritative release `g2-s2-c4-a2` contains descriptions and manufacturer barcodes for all 50 canonical products, but the canonical SQL/materializer currently reconstructs only 3/50 descriptions and 1/50 legacy `products.barcode` values. The `product_barcodes` domain is also outside the current canonical materialized table set.

Observed gap:

- Release descriptions: 50/50; seed/materialized descriptions: 3/50; missing after reconstruction: 47.
- Release manufacturer barcodes: 50/50; seed/materialized legacy barcodes: 1/50; missing after reconstruction: 49.
- Brand/variant/package-size metadata currently matches the enriched release where present.

Required acceptance criteria:

- Every populated canonical release product field is reproduced in the GEN2 database unless explicitly classified runtime-only.
- `manufacturerBarcode` is restored to the product primary barcode identity and canonical barcode registry used by Owner, POS, Receiving, and barcode search.
- Canonical descriptions are restored exactly.
- Canonical convergence verification fails when release values become null, blank, or different in the materialized DB.
- Clean recovery and repeated pull-sync remain idempotent.

Status: Tracked / implementation not started.

## Sprint 11 Dark Mode System Upgrade (YSB-M1-THEME-008)

Scope: independent Storefront top-bar and Retail Settings preferences; semantic midnight text and border tokens; new dark-only Midnight Velvet, Graphite Glass, Indigo Silk, and closing-section SVG textures; component contrast coverage for Storefront Home, Shop, Product Detail, Reviews, Cart, Checkout, Account, Login/Register/Recovery, Support, Privacy, and retail sidebar/panels.

Evidence: `frontend/src/context/AppearanceContext.tsx`, `frontend/src/styles/theme-storefront.css`, `frontend/src/styles/theme-storefront-contrast.css`, `frontend/src/styles/theme-retail.css`, `frontend/public/textures/ys-dark-*.svg`, `frontend/public/media/ys-dark-delivery-closing.svg`, `scripts/test/appearance-theme.test.mjs`, `scripts/test/appearance-contrast.test.mjs`, `.github/workflows/ci.yml`.

Status: code implemented on `sprint/v0.11/sprint-11`; automated theme contracts and three workspace builds passed in CI run 37739767192; root formatting gate failed. Real rendered Light/Dark screenshot comparison, accessibility testing of every interactive state, and full repository verification remain pending. Do not mark release-ready. The approved About scenes and original Light Mode images remain unchanged.

