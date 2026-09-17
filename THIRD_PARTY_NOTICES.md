# Third-Party Notices

> **Project:** YsabelleStore
> **Audited baseline:** `sprint/v0.10/sprint-10`

YsabelleStore contains project-authored application code and depends on third-party open-source software, development tooling, runtime software, and external hosted services. This document is an attribution and compliance register; it does **not** relicense YsabelleStore project source code.

## 1. License Position

- The root npm package and the frontend/backend/electron workspaces are marked `private`.
- No blanket open-source license is granted for the entire YsabelleStore repository by this notice.
- Third-party components remain governed by their respective licenses.
- Original third-party license/copyright notices must be preserved when required by the applicable license.
- External hosted services are governed by their provider terms and are not redistributed under this repository's notices.

## 2. Primary UI / HCI Library Declaration

| Component | Resolved / Declared Version | Purpose | License | Copyright / Maintainer | Source / Evidence | Modification Status |
| --- | ---: | --- | --- | --- | --- | --- |
| Tailwind CSS | **3.4.19 resolved** (`^3.4.17` declared) | Primary utility styling framework | MIT | Tailwind Labs, Inc. | `package-lock.json`; official Tailwind `v3.4.19/LICENSE` | Project configuration/utilities are customized; Tailwind library source is not represented as project-authored |

The official Tailwind CSS v3.4.19 license text is retained in `docs/licenses/TAILWIND-CSS-LICENSE.md` for local evidence and attribution. The authoritative upstream license remains the Tailwind CSS repository release/tag used for verification.

## 3. Frontend Third-Party Components

The following packages are direct frontend dependencies or development dependencies in `frontend/package.json`.

| Component | Declared Version | Role | Compliance Treatment |
| --- | ---: | --- | --- |
| React | `^19.0.0` | UI framework | Third-party; preserve applicable license notices |
| React DOM | `^19.0.0` | Browser renderer | Third-party; preserve applicable license notices |
| Vite | `^6.0.7` | Build/dev tooling | Third-party tooling |
| Tailwind CSS | `^3.4.17` → 3.4.19 resolved | Styling | MIT notice retained separately |
| Base UI React | `^1.7.0` | UI primitives | Third-party |
| Radix UI Dialog | `^1.1.19` | Dialog primitive | Third-party |
| Radix UI Slot | `^1.1.1` | Component composition | Third-party |
| class-variance-authority | `^0.7.1` | Component variants | Third-party |
| clsx | `^2.1.1` | Class composition | Third-party |
| tailwind-merge | `^2.6.0` | Tailwind class merging | Third-party |
| GSAP | `^3.15.0` | UI animation | Third-party; distribution/use terms must be reviewed for the release model |
| Lucide React | `^0.468.0` | Icons | Third-party |
| Chart.js | `^4.4.7` | Charts | Third-party |
| react-chartjs-2 | `^5.2.0` | React Chart.js binding | Third-party |
| Recharts | `^2.15.0` | Charts | Third-party |
| driver.js | `^1.8.0` | Guided interaction/onboarding where used | Third-party |
| input-otp | `^1.5.0` | OTP input component | Third-party |
| jsPDF | `^4.2.1` | PDF generation capability where used | Third-party |
| jsPDF AutoTable | `^5.0.8` | PDF table generation where used | Third-party |
| Zod | `^3.24.1` | Validation | Third-party |
| PostCSS | `^8.4.49` | CSS processing | Third-party tooling |
| Autoprefixer | `^10.4.20` | CSS processing | Third-party tooling |

## 4. Backend Third-Party Components

| Component | Declared Version | Role |
| --- | ---: | --- |
| Express | `^4.21.2` | HTTP/API framework |
| CORS | `^2.8.5` | CORS middleware |
| dotenv | `^16.4.7` | Environment configuration |
| jsonwebtoken | `^9.0.2` | JWT support |
| JSZip | `^3.10.2` | ZIP processing |
| Multer | `^2.3.0` | Multipart upload handling |
| pdfjs-dist | `^6.3.289` | PDF parsing capability |
| read-excel-file | `^9.3.1` | XLSX parsing/import |
| saxen | `^11.0.2` | XML/SAX processing |
| Tesseract.js | `^7.0.0` | OCR capability |
| Zod | `^3.24.1` | Validation |
| Prisma Client | `^6.2.1` | ORM client |
| Prisma CLI | `^6.2.1` | Schema/client tooling |

## 5. Desktop / Build / Repository Tooling

| Component | Declared / Configured Version | Role |
| --- | ---: | --- |
| Electron | `^42.5.0` package declaration | Desktop runtime |
| Electron runtime override/config | `42.8.1` in Electron Builder config | Packaging runtime selection |
| electron-builder | `^26.15.3` | Windows packaging |
| esbuild | `^0.25.12` | Preload/build bundling |
| TypeScript | `^5.7.3` root | Type system/compiler |
| ESLint | `^9.18.0` | Static analysis |
| Prettier | `^3.4.2` | Formatting |
| Husky | `^9.1.7` | Git hook integration |
| GitHub Actions actions | `actions/checkout@v4`, `actions/setup-node@v4`, `actions/setup-python@v5` | CI automation |

## 6. Python Forecasting Dependencies

`forecasting-service/requirements.txt` currently declares package names without pinned versions:

| Package | Purpose | Current Reproducibility Status |
| --- | --- | --- |
| pandas | Time-series/tabular manipulation | Version unpinned |
| NumPy | Numerical arrays/math | Version unpinned |
| statsmodels | SARIMA statistical implementation | Version unpinned |
| python-dotenv | Environment configuration | Version unpinned |
| pytest | Forecast service tests | Version unpinned |

**Release control:** before a formal distributable release, freeze an approved Python dependency set and capture exact versions/licenses in the release SBOM or equivalent software component inventory. This notice intentionally does not invent versions that are not committed.

## 7. External Hosted Services

These services are integrations, not redistributed open-source dependencies:

| Provider | Current Purpose | Credential / Terms Boundary |
| --- | --- | --- |
| Resend | Production customer email, OTP and password-recovery delivery | API key required; provider terms apply |
| Gmail SMTP | Development-only registration/login OTP QA | Google account + App Password; development-only |
| Google OAuth | Customer social authentication | OAuth client credentials; Google terms apply |
| Facebook / Meta OAuth and Graph API | Customer social authentication | App credentials; Meta platform terms apply |

## 8. Internally Authored Components

The following are project implementation and should **not** be misrepresented as third-party packages or external APIs:

- YsabelleStore Express routes/controllers/services/validators and API contracts.
- Prisma application schema and YsabelleStore migrations.
- Inventory, POS, catalog, historical-sales, storefront, authentication and recommendation business logic.
- Python forecasting orchestration, candidate selection policy, fallback logic and service contract under `forecasting-service/`.
- Reliability/health endpoints, request correlation, safe error handling and application logging configuration.
- Electron main/preload/IPC integration and project packaging configuration.
- Project tests, guardrails, verification scripts and repository tooling.

These project-authored components may use third-party frameworks/libraries; ownership of the application code does not replace or supersede third-party notices.

## 9. Compliance Maintenance Procedure

For every material dependency or external service change:

1. Update the relevant package manifest/requirements/configuration.
2. Regenerate or update lockfiles where applicable.
3. Verify the dependency license from an authoritative source.
4. Record the component, purpose, version, license and obligations in the software component inventory.
5. Preserve required copyright/license text when distributing the dependency or substantial portions of it.
6. Run repository verification and production dependency/security audits.
7. Update this notice when a new material runtime dependency, UI library, external provider or packaging component is introduced.

## 10. Disclaimer

This file is an engineering compliance record, not legal advice. For commercial/public distribution, the release owner should perform a final dependency/SBOM license review against the exact distributable artifact.
