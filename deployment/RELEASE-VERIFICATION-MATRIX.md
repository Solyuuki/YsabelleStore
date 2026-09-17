# YsabelleStore Release Verification Matrix

> **Baseline:** `sprint/v0.10/sprint-10`
>
> **Purpose:** define the evidence required to classify a commit/artifact as release-ready. This matrix records whether a gate is automated, manual, conditional, or currently a known gap. It does **not** claim that the latest branch head has passed a gate unless an exact run/evidence record is attached.

## 1. Verification State Definitions

| State                     | Meaning                                                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Automated gate**        | Implemented in repository/CI and expected to execute for the applicable pipeline                |
| **Manual gate**           | Must be executed by a reviewer/operator on the target environment                               |
| **Conditional gate**      | Required only when the related feature/integration is in release scope                          |
| **Configured capability** | Code/config exists, but release acceptance still requires execution evidence                    |
| **Known gap**             | Missing/inconsistent control that must be resolved or explicitly accepted before formal release |
| **Not claimed**           | No support/release assertion should be made without evidence                                    |

## 2. Core Release Gate Matrix

| Gate                          | Type                        | Repository Mechanism                   | Required Evidence                                               | Release Rule                                                                       |
| ----------------------------- | --------------------------- | -------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Exact source identity         | Manual/record               | Git SHA/tag                            | Commit SHA + branch/tag                                         | Mandatory                                                                          |
| Clean dependency install      | Automated                   | `npm ci`                               | CI log                                                          | Mandatory                                                                          |
| Prisma client generation      | Automated                   | `npm run prisma:generate`              | CI log                                                          | Mandatory                                                                          |
| Prisma schema validation      | Automated                   | `npm run prisma:validate`              | CI log                                                          | Mandatory                                                                          |
| Disposable DB materialization | Automated                   | MySQL 8.0 + `prisma db push` in CI     | CI log                                                          | Mandatory                                                                          |
| Guardrail preflight           | Automated                   | `npm run guardrail:preflight`          | CI log                                                          | Mandatory                                                                          |
| Formatting                    | Automated                   | `npm run format:check`                 | CI log                                                          | Mandatory                                                                          |
| Lint                          | Automated                   | `npm run lint`                         | CI log                                                          | Mandatory                                                                          |
| Typecheck                     | Automated                   | `npm run typecheck`                    | CI log                                                          | Mandatory                                                                          |
| Repository guardrail tests    | Automated                   | `npm run test:guardrails`              | CI log                                                          | Mandatory                                                                          |
| Backend tests                 | Automated                   | backend workspace `test`               | CI log                                                          | Mandatory                                                                          |
| Frontend contract tests       | Automated                   | frontend workspace `test`              | CI log                                                          | Mandatory                                                                          |
| Forecast pytest               | Automated                   | `npm run forecast:test`                | CI log                                                          | Mandatory when forecasting is included; current product scope includes forecasting |
| Full repository build         | Automated                   | `npm run build`                        | CI log                                                          | Mandatory                                                                          |
| Frontend build                | Automated                   | workspace build matrix                 | CI log                                                          | Mandatory                                                                          |
| Backend build                 | Automated                   | workspace build matrix                 | CI log                                                          | Mandatory                                                                          |
| Electron build                | Automated                   | workspace build matrix                 | CI log                                                          | Mandatory                                                                          |
| Production dependency audit   | Automated                   | `npm run security:audit:production`    | CI log                                                          | Mandatory                                                                          |
| Version consistency           | Automated                   | `npm run version:check`                | CI log                                                          | Mandatory                                                                          |
| Sprint/artifact consistency   | Automated                   | `npm run verify:status`                | CI log                                                          | Mandatory for sprint/release process                                               |
| NSIS package generation       | Configured/manual execution | `npm run package --workspace electron` | Packaging log + artifact                                        | Mandatory for Windows desktop release                                              |
| Installer clean-machine test  | Manual                      | Target Windows machine                 | QA record                                                       | Mandatory for Windows release                                                      |
| Backend readiness             | Manual/runtime              | `/api/health/ready`                    | HTTP/result capture                                             | Mandatory                                                                          |
| Full-stack packaged topology  | Manual/release architecture | Deployment runbook                     | Evidence backend/DB/Python are available from approved topology | Mandatory                                                                          |
| Backup/restore readiness      | Manual/operations           | Deployment procedure                   | Backup ID + restore drill evidence                              | Mandatory before production business-data deployment                               |
| Known-risk review             | Manual                      | Release notes/checklist                | Signed/approved accepted-risk list                              | Mandatory                                                                          |

## 3. Application Acceptance Matrix

| Capability                          | Automated Evidence                                       | Manual Acceptance                                        | Release Requirement                                   |
| ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Internal OWNER/STAFF authentication | Backend auth/security tests + frontend boundary tests    | Sign-in, role navigation, logout/trusted-device behavior | Mandatory for internal operations                     |
| Customer authentication             | Customer auth/account/recovery/social tests              | Customer login/session/account flow                      | Mandatory if storefront customer accounts are enabled |
| Catalog                             | Catalog quality/barcode/image tests                      | Product/category CRUD/display smoke                      | Mandatory                                             |
| POS                                 | POS product/search/domain tests                          | Controlled checkout/receipt smoke                        | Mandatory                                             |
| Inventory                           | Stock truth, import, receiving tests                     | Stock-in/deduct/adjust/movement verification             | Mandatory                                             |
| Batch/expiry                        | Stock/batch domain tests                                 | FEFO/expiry-related representative flow where included   | Mandatory for inventory release                       |
| Historical sales                    | Historical-sales rules/tests                             | Preview/confirm/rollback representative QA               | Mandatory when import management is exposed           |
| Forecasting                         | Forecast delivery/input/fallback/accuracy tests + pytest | Generate/load representative forecast                    | Mandatory for thesis forecasting release              |
| Recommendations/restock             | Restock Phase 4–11 tests                                 | Owner/Staff request, approval, receiving flow            | Mandatory for implemented Sprint 10 scope             |
| Storefront                          | Storefront/detail/order tests                            | Browse/search/cart/checkout/pickup QA                    | Mandatory when storefront is released                 |
| Product images                      | Catalog-image test suites                                | Upload/process/approve/storefront visual check           | Mandatory when image workflow is released             |
| Health/reliability                  | HTTP/readiness/error/request-ID tests                    | Simulate/observe degraded DB/backend states              | Mandatory                                             |
| Electron renderer                   | Electron build                                           | Installed app launches packaged frontend                 | Mandatory for desktop release                         |

## 4. Security Acceptance Matrix

| Security Control                  | Evidence Source                                                | Release Gate                                                         |
| --------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Internal JWT authentication       | Backend auth tests + `requireAuth`                             | Required                                                             |
| OWNER/STAFF authorization         | Role middleware + route tests/contracts                        | Required                                                             |
| Password hashing                  | scrypt service/tests                                           | Required                                                             |
| Customer session cookie           | HTTP-only/SameSite/secure-in-production implementation + tests | Required                                                             |
| Customer sensitive-origin control | `requireAllowedCustomerAuthOrigin` + CORS tests                | Required                                                             |
| Auth rate limiting                | auth limiter + focused tests                                   | Required                                                             |
| OAuth transaction state           | OAuth transaction/service tests                                | Conditional on social login scope                                    |
| OTP/password recovery             | Recovery/OTP tests                                             | Conditional on customer auth scope                                   |
| Security headers                  | Middleware/config + HTTP verification                          | Required                                                             |
| Sanitized errors                  | Error-handler security tests                                   | Required                                                             |
| Request correlation               | Request-traceability tests                                     | Required                                                             |
| Production dependency audit       | `security:audit:production`                                    | Required                                                             |
| Secret exclusion                  | `.env.example` placeholders + repository review                | Required                                                             |
| Upload-size consistency           | Security register discrepancy                                  | **Known gap — normalize before formal release or explicitly accept** |

## 5. Data Integrity Acceptance Matrix

| Data Area               | Automated / Tooling Evidence                                      | Manual / Release Evidence                                        |
| ----------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Prisma schema           | `prisma validate`, CI DB build                                    | Migration/release review                                         |
| Inventory truth         | `stock-truth` tests, `inventory:audit`                            | Reconciliation evidence if anomalies exist                       |
| Inventory receiving     | Receiving barcode/restock/bulk-delivery tests                     | Representative receiving transaction                             |
| Historical data         | Import tests + rollback contracts                                 | Import preview/confirm/rollback QA                               |
| Forecast source mapping | SARIMA catalog verification                                       | Mapping review for release dataset                               |
| Customer/session data   | Auth/account tests                                                | Privacy/secrets review                                           |
| Catalog identity        | Barcode/alias/mapping tests/tools                                 | Duplicate/quality review                                         |
| Release DB recovery     | No dedicated automated app backup subsystem currently established | **Backup + restore drill required before production deployment** |

## 6. Deployment and Packaging Acceptance

| Item                      | Current State                                   | Acceptance Requirement                                        |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------- |
| Electron Builder          | Configured                                      | Build/package log                                             |
| Windows NSIS target       | Configured                                      | Installer artifact generated                                  |
| Custom install directory  | Configured                                      | Installer QA confirms behavior                                |
| Frontend bundle           | Included as `extraResources`                    | Installed renderer loads correctly                            |
| Backend bundle            | Not evidenced in current Builder resources      | Approved deployment topology must provide backend             |
| Python forecast runtime   | Not evidenced in current Builder resources      | Approved deployment topology must provide Python/dependencies |
| MySQL                     | External/local prerequisite in current evidence | Installation/provisioning + connectivity QA                   |
| Auto-update               | Not implemented                                 | Do not claim                                                  |
| macOS/Linux package       | Not configured                                  | Do not claim                                                  |
| Cloud production topology | Not current deployment envelope                 | Do not claim                                                  |

## 7. External Integration Acceptance

| Integration         | Type                         | Required Test                                                                     |
| ------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Resend              | Conditional production email | Real provider QA using approved test account/address without exposing credentials |
| Gmail SMTP          | Development-only             | Do not treat as production email path                                             |
| Google OAuth        | Conditional                  | Start/callback/session QA with production-like callback configuration             |
| Facebook/Meta OAuth | Conditional                  | Start/callback/session QA with approved app/config                                |

Provider success should be recorded separately from local core-system acceptance because external availability is not controlled by YsabelleStore.

## 8. HCI / Accessibility Acceptance

Accessibility evidence is not currently a canonical CI gate. When required for academic or release acceptance, archive measured evidence rather than statements of intent.

| Check                     | Required Evidence                                        |
| ------------------------- | -------------------------------------------------------- |
| Text contrast             | Named contrast tool + measured ratio                     |
| Focus contrast/visibility | DevTools/axe/manual focus capture                        |
| Keyboard navigation       | Keyboard walkthrough evidence                            |
| Touch targets             | Measured target sizes for applicable mobile/touch views  |
| Non-color status cues     | Screens showing text/icon/shape cue in addition to color |
| Error/empty state         | Actual system screen/state                               |
| Lighthouse/axe            | Report/export/screenshot tied to current UI build        |

Do not claim WCAG conformance solely because a component library advertises accessibility.

## 9. Browser / Platform Support Verification

| Platform                  | Current Claim Status                                    | Evidence Needed                                                     |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| Windows packaged Electron | Target configured                                       | Installer + runtime QA                                              |
| Browser development mode  | Implemented for development                             | Browser-specific matrix required before broad browser-support claim |
| Chrome                    | Not independently certified by current release register | Version + workflow QA                                               |
| Edge                      | Not independently certified                             | Version + workflow QA                                               |
| Firefox                   | Not independently certified                             | Version + workflow QA                                               |
| Safari                    | Not independently certified                             | Version + workflow QA                                               |
| macOS                     | No packaged target                                      | Do not claim                                                        |
| Linux                     | No packaged target                                      | Do not claim                                                        |

## 10. Repository Governance Verification

Current repository workflows validate PR titles, PR body structure, branch naming, required documentation files, and unfinished-marker checks.

For `sprint/v0.10/sprint-10`, current branch metadata reports the branch as **not protected**. Workflow definitions therefore provide automated checks when triggered, but branch metadata on this sprint branch should not be represented as enforced protected-branch policy.

Before formal production governance, verify repository rules/required checks on the actual release branches (`staging`/`main`) rather than assuming sprint-branch settings apply to them.

## 11. Release Decision Record

For each release candidate create/attach a decision record containing:

| Field                     | Required Value                               |
| ------------------------- | -------------------------------------------- |
| Release version           | Exact application version                    |
| Commit                    | Exact SHA                                    |
| Source branch/tag         | Exact ref                                    |
| CI run                    | Exact run identifier/URL                     |
| CI result                 | Pass/fail                                    |
| Production security audit | Pass/fail + report reference                 |
| Package artifact          | File name/version/checksum                   |
| Target machine            | Windows version/hardware context used for QA |
| Database version          | Exact MySQL version                          |
| Node/Python runtime       | Exact versions used by deployment topology   |
| Installer QA              | Pass/fail                                    |
| Full-stack runtime QA     | Pass/fail                                    |
| Backup/restore evidence   | Reference or accepted blocker                |
| External integrations     | Tested/not in scope/degraded                 |
| Accessibility evidence    | Reference when required                      |
| Known risks               | Explicit list                                |
| Approval                  | Responsible release owner/reviewer           |

## 12. No-Go Conditions

A release candidate should remain blocked when any applicable mandatory gate fails, when the exact release commit lacks verification evidence, when critical/high production-reachable security findings are unresolved, when database integrity is uncertain, when the packaged runtime cannot reach required services, or when a required backup/restore control has not been demonstrated for production data.

Passing source builds alone is not equivalent to production acceptance.
