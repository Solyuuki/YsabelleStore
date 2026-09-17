# Software Component Inventory

> **System:** YsabelleStore  
> **Audited baseline:** `sprint/v0.10/sprint-10`

This inventory is the engineering record of material components that form the current full-stack system. It is not a generated SBOM and does not replace release-time lockfile/package-manager analysis.

## Component Register

| Component | Category | Version / Baseline | Origin | Role | Runtime Classification | License / Terms Tracking |
| --- | --- | --- | --- | --- | --- | --- |
| YsabelleStore frontend | Application | Project `0.1.0` | Project-authored | Storefront/internal UI | Runtime | Project ownership; private package |
| React | Framework | `^19.0.0` | Third-party | UI framework | Runtime | Third-party notice required |
| Vite | Build tooling | `^6.0.7` | Third-party | Frontend build/dev | Build/dev | Third-party notice |
| Tailwind CSS | UI framework | **3.4.19 resolved** | Third-party | Primary styling | Build/runtime CSS output | MIT; verified notice retained |
| Base UI | UI library | `^1.7.0` | Third-party | UI primitives | Runtime | Third-party notice |
| Radix UI | UI library | Dialog `^1.1.19`, Slot `^1.1.1` | Third-party | Accessible/composable primitives | Runtime | Third-party notice |
| GSAP | Motion | `^3.15.0` | Third-party | UI animation | Runtime | Review distribution/use terms for release |
| Lucide React | Icons | `^0.468.0` | Third-party | UI icons | Runtime | Third-party notice |
| Chart.js ecosystem | Visualization | Chart.js `^4.4.7`, react-chartjs-2 `^5.2.0` | Third-party | Charts | Runtime | Third-party notice |
| Recharts | Visualization | `^2.15.0` | Third-party | Charts | Runtime | Third-party notice |
| Zod | Validation | `^3.24.1` | Third-party | Frontend/backend validation | Runtime | Third-party notice |
| YsabelleStore backend | Application/API | Project `0.1.0` | Project-authored | Business API/domain orchestration | Runtime | Project ownership; private package |
| Express | Backend framework | `^4.21.2` | Third-party | HTTP API | Runtime | Third-party notice |
| Prisma Client / Prisma | ORM/tooling | `^6.2.1` | Third-party | MySQL data access/schema tooling | Runtime/build | Third-party notice |
| MySQL Community Server | Database | CI validates MySQL 8.0 | Third-party runtime | Primary persistence | Runtime | Governed separately by MySQL licensing |
| JSON Web Token library | Security dependency | `jsonwebtoken ^9.0.2` | Third-party | JWT implementation support | Runtime | Third-party notice |
| Multer | Upload | `^2.3.0` | Third-party | Multipart handling | Runtime | Third-party notice |
| read-excel-file | Import | `^9.3.1` | Third-party | XLSX parsing | Runtime | Third-party notice |
| pdfjs-dist | Document processing | `^6.3.289` | Third-party | PDF parsing capability | Runtime | Third-party notice |
| Tesseract.js | OCR | `^7.0.0` | Third-party | OCR capability | Runtime | Third-party notice |
| YsabelleStore forecasting service | Statistical service | Project code | Project-authored | SARIMA orchestration/evaluation | Runtime | Project code; underlying scientific libraries separate |
| pandas | Python library | Unpinned in requirements | Third-party | Data/time-series manipulation | Runtime | Freeze/version/license review before formal release |
| NumPy | Python library | Unpinned | Third-party | Numerical computation | Runtime | Freeze/version/license review before formal release |
| statsmodels | Statistical library | Unpinned | Third-party | SARIMA implementation | Runtime | Freeze/version/license review before formal release |
| pytest | Test framework | Unpinned | Third-party | Forecast tests | Test/dev | Freeze/version/license review |
| Electron | Desktop runtime | `^42.5.0`; builder config `42.8.1` | Third-party | Desktop shell | Runtime | Third-party notice; version discrepancy tracked |
| electron-builder | Packaging | `^26.15.3` | Third-party | Windows package/installer | Build/release | Third-party notice |
| NSIS target | Installer technology | Via electron-builder | Third-party | Windows installer | Distribution | Review installer/distribution notices during release |
| ESLint | Quality | `^9.18.0` | Third-party | Static analysis | Dev/CI | Third-party tooling |
| Prettier | Quality | `^3.4.2` | Third-party | Formatting | Dev/CI | Third-party tooling |
| Husky | Quality | `^9.1.7` | Third-party | Git hooks | Dev | Third-party tooling |
| GitHub Actions | CI service/tooling | actions checkout/setup versions in workflow | External service + actions | CI | CI | Provider/action terms apply |
| Resend | Hosted service | Deployment-configured | External provider | Production email/OTP/recovery | External | Provider terms; API key secret |
| Gmail SMTP | Hosted service | Development-only | External provider | OTP QA delivery | Dev external | Google terms; App Password secret |
| Google OAuth | Hosted identity | Configured | External provider | Social login | External | Google platform terms |
| Facebook/Meta OAuth | Hosted identity | Configured; Graph API version env-controlled | External provider | Social login | External | Meta platform terms |

## Project-Authored Domain Components

The following major subsystems are application code, not separate third-party products:

- Product/catalog identity and quality control.
- POS and sales persistence.
- Aggregate/batch inventory, movements and expiration state.
- Historical-sales validation/import/rollback-oriented data management.
- Forecast generation/delivery and persistence.
- Restock/recommendation decision support.
- Customer storefront, account, order and authentication flows.
- Internal OWNER/STAFF authentication/authorization.
- Server health, liveness, readiness, error safety, request IDs and safe logging.
- Catalog-image pipeline orchestration and quality states.
- Repository guardrails, audits and deterministic validation scripts.

## API Ownership

Routes under the YsabelleStore backend are **project-authored APIs**. Framework dependencies such as Express enable the server but do not own the API design. External provider calls such as Google/Meta OAuth or Resend email are separately classified as integrations.

## Forecast Model Ownership and Dependency Boundary

YsabelleStore defines the forecast workflow and policy: monthly input preparation, constrained SARIMA candidate set, lowest-finite-AIC selection, fallbacks, metrics, persistence and delivery. `statsmodels` supplies statistical model implementation primitives. The project must therefore attribute the library while accurately describing the surrounding forecasting workflow as project code.

## Release Compliance Gaps to Keep Visible

| Gap | Required Release Action |
| --- | --- |
| Python requirements are unpinned | Freeze approved exact versions before production distribution. |
| Complete transitive dependency license set is not stored manually here | Generate/review an SBOM or equivalent dependency-license report from the exact release lockfile/artifact. |
| Electron manifest/config versions differ | Normalize or intentionally document the selected release runtime. |
| Provider terms can change | Revalidate external service terms/configuration at release time. |

## Maintenance

Update this file when a material runtime dependency, UI framework, database, statistical model dependency, external API/service, deployment technology or licensing obligation changes.