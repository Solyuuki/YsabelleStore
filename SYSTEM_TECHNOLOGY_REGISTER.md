# YsabelleStore System Technology Register

> **Audited baseline:** `sprint/v0.10/sprint-10`
>
> This register describes the technologies that materially form the current system. It separates project-authored capabilities from third-party software and external services so architectural ownership and licensing obligations are not confused.

## 1. System Architecture Summary

| Layer                | Primary Technology / Boundary                       | Ownership                                                     | Purpose                                             |
| -------------------- | --------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Customer/Internal UI | React 19 + TypeScript + Vite 6                      | Project code on third-party frameworks                        | Storefront and protected operational interfaces     |
| Styling              | Tailwind CSS 3.4.19, PostCSS                        | Third-party framework + project-authored design rules         | Utility-driven design system and layout             |
| UI primitives        | Base UI, Radix UI, class-variance-authority, clsx   | Third-party                                                   | Accessible/reusable component behavior and variants |
| Motion               | GSAP                                                | Third-party                                                   | Interface animation/motion                          |
| Icons                | Lucide React                                        | Third-party                                                   | Interface iconography                               |
| Charts               | Chart.js, react-chartjs-2, Recharts                 | Third-party                                                   | Sales/forecast/data visualization                   |
| Validation           | Zod + domain validators                             | Third-party + project code                                    | Runtime input/schema validation                     |
| Application API      | Express 4 + TypeScript                              | Project-authored API on third-party framework                 | REST-style backend and domain orchestration         |
| Persistence          | Prisma 6                                            | Third-party ORM                                               | Controlled application access to MySQL              |
| Database             | MySQL Community Server                              | Third-party database runtime                                  | Primary persistent source of truth                  |
| Forecasting          | Python + pandas + NumPy + statsmodels               | Project-authored workflow on third-party scientific libraries | SARIMA demand forecasting and evaluation            |
| Desktop shell        | Electron                                            | Third-party runtime + project code                            | Windows desktop application boundary                |
| Packaging            | electron-builder + NSIS target                      | Third-party tooling                                           | Windows installer packaging                         |
| Quality / CI         | ESLint, Prettier, TypeScript, Husky, GitHub Actions | Third-party tooling + project configuration                   | Static quality, verification and CI gates           |

## 2. Frontend Register

The active frontend manifest declares the following material packages.

| Package                    | Declared Version | System Role                                 |
| -------------------------- | ---------------: | ------------------------------------------- |
| `react`                    |        `^19.0.0` | UI framework                                |
| `react-dom`                |        `^19.0.0` | Browser rendering                           |
| `vite`                     |         `^6.0.7` | Build/dev server                            |
| `tailwindcss`              |        `^3.4.17` | Styling framework; lockfile resolves 3.4.19 |
| `@base-ui/react`           |         `^1.7.0` | UI primitives                               |
| `@radix-ui/react-dialog`   |        `^1.1.19` | Dialog primitive                            |
| `@radix-ui/react-slot`     |         `^1.1.1` | Composition primitive                       |
| `class-variance-authority` |         `^0.7.1` | Component variants                          |
| `clsx`                     |         `^2.1.1` | Conditional class composition               |
| `tailwind-merge`           |         `^2.6.0` | Tailwind class conflict resolution          |
| `lucide-react`             |       `^0.468.0` | Icons                                       |
| `gsap`                     |        `^3.15.0` | Motion                                      |
| `chart.js`                 |         `^4.4.7` | Chart engine                                |
| `react-chartjs-2`          |         `^5.2.0` | React Chart.js binding                      |
| `recharts`                 |        `^2.15.0` | React charts                                |
| `driver.js`                |         `^1.8.0` | Guided UI/onboarding behavior where used    |
| `input-otp`                |         `^1.5.0` | OTP input UI                                |
| `jspdf`                    |         `^4.2.1` | PDF generation capability where used        |
| `jspdf-autotable`          |         `^5.0.8` | PDF table generation capability where used  |
| `zod`                      |        `^3.24.1` | Validation                                  |

Dependency presence establishes a technical dependency, not automatically a user-facing feature. User-facing capability claims must still be backed by source/routes/tests.

## 3. Backend Register

| Package / Runtime |                       Declared Version | System Role                                       |
| ----------------- | -------------------------------------: | ------------------------------------------------- |
| Node.js           | `>=20.11.0` root engine; Node 22 in CI | Server runtime                                    |
| TypeScript        |                          `^5.7.3` root | Typed application language/tooling                |
| `express`         |                              `^4.21.2` | HTTP/API framework                                |
| `@prisma/client`  |                               `^6.2.1` | ORM client                                        |
| `prisma`          |                               `^6.2.1` | Schema/client/migration tooling                   |
| `cors`            |                               `^2.8.5` | CORS middleware                                   |
| `jsonwebtoken`    |                               `^9.0.2` | JWT support                                       |
| `zod`             |                              `^3.24.1` | Request/domain validation                         |
| `multer`          |                               `^2.3.0` | Multipart/upload handling                         |
| `read-excel-file` |                               `^9.3.1` | Spreadsheet import parsing                        |
| `jszip`           |                              `^3.10.2` | ZIP processing                                    |
| `pdfjs-dist`      |                             `^6.3.289` | PDF parsing capability where used                 |
| `tesseract.js`    |                               `^7.0.0` | OCR capability where used                         |
| `saxen`           |                              `^11.0.2` | XML/SAX processing dependency                     |
| `dotenv`          |                              `^16.4.7` | Environment configuration                         |
| `tsx`             |                              `^4.19.2` | TypeScript execution in development/tests/scripts |

## 4. Database and Domain Model Register

**Database provider:** MySQL. **ORM boundary:** Prisma. Frontend code must not directly access MySQL or Prisma.

Material persisted domains include:

| Domain             | Representative Models / Records                                                            |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Internal identity  | `User`, `TrustedDevice`                                                                    |
| Customer identity  | `CustomerAccount`, sessions, remembered-auth and OTP/recovery challenge records            |
| Social identity    | Provider identity, OAuth transaction/link/handoff records                                  |
| Catalog            | `Category`, `Product`, aliases, barcode identity, canonical mappings, duplicate candidates |
| Product experience | Reviews and governed product-image assets                                                  |
| Inventory          | `Inventory`, `InventoryBatch`, `InventoryMovement`                                         |
| POS/Sales          | `Sale`, `SaleItem`                                                                         |
| Customer commerce  | `CustomerOrder`, `CustomerOrderItem`                                                       |
| Historical sales   | Import batch/row records and monthly sales                                                 |
| Forecasting        | Forecast records, batch cache and product forecast results                                 |
| Recommendations    | Recommendation records and replenishment/restock workflow records                          |

## 5. Forecasting / Statistical Model Register

YsabelleStore does **not** call an external AI forecasting API for its thesis forecast. The forecasting service is project-authored Python code that executes local statistical models using `statsmodels`.

| Priority    | Model / Rule              | Role                                                            |
| ----------- | ------------------------- | --------------------------------------------------------------- |
| Candidate 1 | `SARIMA(0,1,1)(0,1,1,12)` | Monthly seasonal candidate                                      |
| Candidate 2 | `SARIMA(1,1,0)(0,1,1,12)` | Monthly seasonal candidate                                      |
| Candidate 3 | `SARIMA(1,0,0)(1,0,0,12)` | Monthly seasonal candidate                                      |
| Selection   | Lowest finite AIC         | Select successful fitted candidate                              |
| Fallback 1  | Seasonal naive            | Used when fitted SARIMA cannot produce valid finite output      |
| Fallback 2  | Moving average            | Used when seasonal history cannot support seasonal-naive output |
| Metrics     | MAE, RMSE, MAPE, WAPE     | Forecast evaluation                                             |

Python requirements currently include `pandas`, `numpy`, `statsmodels`, `python-dotenv`, and `pytest`. Versions are not pinned in `forecasting-service/requirements.txt`; release-grade reproducibility should therefore record/pin an approved dependency set before a formal distributable release.

## 6. Project-Authored API Register

The Express API is a YsabelleStore implementation, not a third-party service. Major mounted boundaries include:

`/auth`, `/customer-auth`, `/customer-account`, `/dashboard`, `/forecasts`, `/historical-sales`, `/health`, `/products`, `/pos`, `/catalog/products`, `/catalog/categories`, `/inventory`, `/restock-orders`, `/sales`, `/search`, and `/storefront` under the application API root.

The route registry additionally distinguishes implemented and planned generic groups. Documentation must not promote a registry item marked `planned` to supported merely because related data/models exist.

## 7. Reliability and Observability Register

| Capability              | Current Mechanism                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Health summary          | `GET /api/health`                                                                                                             |
| Liveness                | `GET /api/health/live`                                                                                                        |
| Readiness               | `GET /api/health/ready`                                                                                                       |
| Readiness degradation   | Critical dependency/config checks with degraded behavior                                                                      |
| Request correlation     | Server-generated request ID / `x-request-id`                                                                                  |
| Error boundary          | Sanitized server error responses                                                                                              |
| Logging                 | Structured safe request/error logging                                                                                         |
| Frontend reliability UX | Healthy, degraded, database-unavailable, backend-unavailable, timeout and offline states documented in current project README |

## 8. Desktop and Packaging Register

| Component               | Current Configuration                            |
| ----------------------- | ------------------------------------------------ |
| Application ID          | `com.ysabellestore.desktop`                      |
| Product name            | `YsabelleStore`                                  |
| Electron Builder target | Windows `nsis`                                   |
| Installation mode       | Non-one-click; per-user (`perMachine: false`)    |
| Install directory       | User may change installation directory           |
| Bundled UI              | Built frontend copied as Electron extra resource |
| Release output          | `release/`                                       |

The Electron package manifest declares Electron `^42.5.0`; the Electron Builder configuration explicitly sets `electronVersion: 42.8.1`. This discrepancy is documented rather than hidden and should be normalized before a production release if both values remain active.

## 9. External Services

| Service                           | Use                                                           |
| --------------------------------- | ------------------------------------------------------------- |
| Resend                            | Production email/OTP/password-recovery delivery configuration |
| Gmail SMTP                        | Development-only OTP delivery QA                              |
| Google OAuth                      | Customer social authentication                                |
| Facebook / Meta OAuth + Graph API | Customer social authentication                                |
| PayMongo                          | Test-mode hosted card checkout and server-side payment confirmation |

Credentials are deployment secrets and must never be committed.

## 10. Verification Toolchain

The active CI workflow validates with Ubuntu, MySQL 8.0, Node 22 and Python 3.12. Quality gates include dependency installation, Prisma generation/schema validation, disposable CI database setup, guardrail preflight, formatting, linting, typechecking, guardrail tests, workspace tests, forecasting tests, repository build, production dependency security audit, version consistency and committed status verification. Frontend/backend/electron workspaces also receive separate build validation.

## 11. Governance Rule

This register is descriptive, not a blanket license grant. YsabelleStore project code remains separate from third-party licenses. Third-party license notices are maintained in `THIRD_PARTY_NOTICES.md` and `docs/licenses/`.
