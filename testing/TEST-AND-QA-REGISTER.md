# YsabelleStore Test and Quality Assurance Register

> **Baseline:** `sprint/v0.10/sprint-10`
>
> **Authority:** current package scripts, executable tests, GitHub Actions workflows, Prisma configuration, forecasting tests, and release validation source. This register summarizes implemented verification; it does not treat an old planning document as evidence that a test exists or has passed.

## 1. Quality Architecture

YsabelleStore uses layered verification rather than one test runner. A release decision must combine static analysis, schema validation, automated behavior tests, statistical/forecast validation, build verification, security checks, domain audits, and manual target-environment QA.

| Verification Layer | Current Mechanism | Primary Entry Point | Automated in Main CI |
| --- | --- | --- | --- |
| Formatting | Prettier repository check | `npm run format:check` | Yes |
| Static analysis | ESLint | `npm run lint` | Yes |
| Type safety | TypeScript root + workspace typechecks | `npm run typecheck` | Yes |
| Prisma generation | Prisma Client generation | `npm run prisma:generate` | Yes |
| Prisma schema | Prisma validation | `npm run prisma:validate` | Yes |
| Disposable DB | MySQL 8.0 + `prisma db push` | CI workflow | Yes |
| Repository guardrails | Node test suite + preflight/status/version checks | `npm run test:guardrails` | Yes |
| Backend behavior/security | Node test runner through `tsx` | `npm test --workspace backend` | Yes |
| Frontend contracts | TypeScript contract-test scripts | `npm test --workspace frontend` | Yes |
| Forecasting | Python `pytest` | `npm run forecast:test` | Yes |
| Full build | Root workspace build + Prisma validation | `npm run build` | Yes |
| Workspace build | Frontend/backend/Electron matrix | CI `workspace-validation` | Yes |
| Dependency security | Production reachability audit | `npm run security:audit:production` | Yes |
| Version consistency | Repository version check | `npm run version:check` | Yes |
| Sprint/artifact consistency | Guardrail status verification | `npm run verify:status` | Yes |
| Installer/package QA | Electron Builder + target-machine validation | `npm run package --workspace electron` | Package command exists; target-machine QA is manual |
| Accessibility/HCI evidence | Lighthouse/axe/DevTools/WebAIM/manual keyboard verification as applicable | Manual evidence workflow | Not established as a CI gate |

## 2. Runtime Versions Validated by CI

| Runtime / Service | CI Baseline | Notes |
| --- | --- | --- |
| Node.js | 22 | Repository engine floor is Node `>=20.11.0` |
| npm | Repository engine floor `>=10.0.0` | CI uses npm supplied with Node setup |
| Python | 3.12 | Forecast dependencies installed from `forecasting-service/requirements.txt` |
| MySQL | 8.0 | Disposable service database `ysabellestore_ci` |
| Prisma | Workspace dependency/configuration | Client generated and schema validated in CI |

A release environment outside this validated envelope must be treated as unverified until tested.

## 3. Main CI Gate Sequence

The canonical `.github/workflows/ci.yml` repository-quality job currently performs the following ordered gates:

| Order | Gate | Command / Mechanism | Release Meaning |
| ---: | --- | --- | --- |
| 1 | Checkout | `actions/checkout@v4`, full history | Repository state available for guardrails |
| 2 | Node setup | `actions/setup-node@v4`, Node 22 | JavaScript/TypeScript runtime prepared |
| 3 | Python setup | `actions/setup-python@v5`, Python 3.12 | Forecast test runtime prepared |
| 4 | Dependency install | `npm ci` | Lockfile-consistent Node dependency graph |
| 5 | Forecast dependency install | `pip install -r forecasting-service/requirements.txt` | Python forecast packages available |
| 6 | Prisma client | `npm run prisma:generate` | ORM client generation succeeds |
| 7 | Prisma validation | `npm run prisma:validate` | Schema parses and validates |
| 8 | Disposable DB | `prisma db push` against MySQL 8 | Schema materializes in isolated CI DB |
| 9 | Guardrail preflight | `npm run guardrail:preflight` | Repository/sprint preconditions pass |
| 10 | Formatting | `npm run format:check` | No formatting drift |
| 11 | Lint | `npm run lint` | Static lint rules pass |
| 12 | Typecheck | `npm run typecheck` | TypeScript contracts compile without emit |
| 13 | Guardrail tests | `npm run test:guardrails` | Repository automation contracts pass |
| 14 | Workspace tests | `npm test --workspaces --if-present` | Backend and frontend test entry points pass |
| 15 | Forecast tests | `npm run forecast:test` | Python forecast suite passes |
| 16 | Repository build | `npm run build` | Workspaces build and Prisma remains valid |
| 17 | Security audit | `npm run security:audit:production` | Production dependency reachability policy passes |
| 18 | Version check | `npm run version:check` | Version metadata is internally consistent |
| 19 | Sprint/artifact status | `npm run verify:status` | Committed sprint/evidence state satisfies guardrails |
| 20 | Workspace build matrix | frontend, backend, electron | Each workspace builds independently |

The main CI is configured for pull requests targeting `main`, `staging`, and `sprint/**`. Passing a historical workflow or one targeted test does not substitute for the current full gate set.

## 4. Backend Test Register

The backend workspace contains an explicit ordered test command. Coverage is behavior/contract-oriented and includes the following current groups.

| Domain | Representative Test Areas | Risk Protected |
| --- | --- | --- |
| Internal authentication | auth security, Bearer token behavior | Unauthorized internal access |
| Customer authentication | login/register HTTP contracts | Customer access/session regressions |
| Customer account security | sensitive mutations, password changes | Account takeover / unsafe mutations |
| Concurrency | account/password/recovery concurrency | Race conditions and double-use flows |
| Recovery/OTP | OTP cryptography, recovery HTTP, rate limiting | Token abuse and recovery bypass |
| Social authentication | social auth and OAuth transactions | Google/Meta flow/state regressions |
| Email authentication | registration/email auth verification | Verification bypass / broken delivery contracts |
| Remembered authentication | remembered-account flows | Persistent-auth regressions |
| Customer orders | account/order association | Incorrect order ownership/history |
| CORS | allowed/rejected origins | Browser/Electron origin boundary regressions |
| Catalog/barcodes | barcode identity/import | Duplicate identity and scan errors |
| Receiving | barcode receiving stock | Incorrect stock reception |
| Inventory truth | stock truth | Aggregate/batch inconsistency |
| POS | product search / checkout-related domain behavior | POS lookup and sales flow regressions |
| Catalog images | process gate, runner, storage, approval, storefront, URL, backfill | Image pipeline integrity |
| Catalog quality | quality rules / operational readiness | Invalid storefront/catalog state |
| Data flow/dashboard | synchronization contracts | Stale/misaligned operational summaries |
| Storefront | storefront/product detail | Customer browsing/API regressions |
| Forecasting | delivery, overlay, realized accuracy, fallback, Phase 12 input | Incorrect forecast input/output behavior |
| Historical sales | historical-sales rules | Invalid import/overlap behavior |
| Inventory import | stock import | Unsafe stock ingestion |
| Restock | Phase 4–11 contracts, bulk delivery, decision logic | Procurement lifecycle regressions |
| HTTP reliability | status contract, health/readiness | Incorrect status/readiness behavior |
| Error security | error-handler safety | Sensitive server-error leakage |
| Traceability | request ID behavior | Missing request correlation |

## 5. Frontend Contract Test Register

The frontend workspace runs TypeScript contract tests rather than a browser E2E framework in its default `test` script.

| Area | Current Contract Test Coverage |
| --- | --- |
| Customer authentication | frontend state/contract behavior |
| Auth UI | login/register UI contract |
| Form behavior | customer authentication form contracts |
| Social auth | social-auth UI contract |
| Customer account | account frontend contract |
| Internal auth boundary | separation of internal protected UI |
| Role navigation | OWNER/STAFF route/navigation contract |
| Owner modules | owner-only module visibility/contracts |
| Receiving | barcode receiving UI contract |
| POS | POS feedback UI contract |
| Restock | Phase 4–10 UI contracts |
| Reliability UX | system-health reliability state contract |

**Boundary:** these scripts provide valuable frontend contract regression coverage, but they should not be described as a full real-browser E2E suite unless a browser-driving test is actually executed.

## 6. Forecasting and Python Verification

| Check | Command / Source | Purpose |
| --- | --- | --- |
| Forecast data validation | `npm run forecast:validate-data` | Validate forecast input readiness |
| Forecast generation | `npm run forecast:generate` | Execute generation path |
| Forecast smoke | `npm run forecast:smoke` | Focused operational smoke check |
| Forecast tests | `npm run forecast:test` | `python -m pytest forecasting-service/tests` |
| SARIMA catalog verify | `npm run catalog:sarima:verify` | Verify source/canonical product mapping |
| Catalog image engine | `npm run catalog-images:test` | Python `unittest` image-engine suite |

The forecasting requirements file is currently unpinned. CI proves compatibility with the dependency set resolved at installation time, but a formal release should freeze exact Python package versions for stronger reproducibility.

## 7. Domain Audits and Operational Verification

Not every meaningful safety check is a unit/integration test. The repository includes operational audit commands:

| Command | Purpose |
| --- | --- |
| `npm run inventory:audit` | Audit inventory integrity |
| `npm run inventory:reconcile` | Reconciliation tooling |
| `npm run catalog:audit` | Catalog quality audit |
| `npm run storefront:parity` | Storefront/data parity check |
| `npm run storefront:images:verify` | Storefront image readiness |
| `npm run product-images:cutouts:verify` | Product image processing verification |
| `npm run runtime:report` | Report resolved local runtime endpoints |
| `npm run healthcheck` | Backend/runtime health verification |
| `npm run verify:local` | Composite local verification workflow |
| `npm run prepush:local` / `npm run push-ready` | Pre-push readiness workflows |

These checks should be selected according to the changed subsystem and release risk.

## 8. Repository Governance QA

| Governance Area | Implemented Check |
| --- | --- |
| PR title | Conventional-Commit-style PR title validation |
| PR body | Required Summary, Task Metadata, Files Changed, Validation, Risks, Ownership, Merge Checklist sections |
| Branch naming | `main`, `staging`, sprint, or member branch naming patterns |
| Documentation foundation | Required foundational files must exist and be non-empty |
| Unfinished markers | Governance workflow checks README/docs/.github for unfinished markers |

Workflow presence does not guarantee branch protection. Repository branch/ruleset settings must be reviewed separately for release governance.

## 9. Manual QA Matrix

The following cannot be considered proven merely because CI builds successfully.

| Manual QA | Minimum Evidence |
| --- | --- |
| Windows installer | Installer launches, installs, uninstalls/reinstalls as expected on target Windows environment |
| Packaged Electron renderer | App starts from installed package and loads packaged frontend |
| Full-stack packaged runtime | Backend/database/forecast dependencies are available through the documented deployment model |
| Authentication | OWNER/STAFF and customer auth flows exercised against target configuration |
| Storefront | Browse, cart/checkout/pickup-order workflows exercised |
| POS / inventory | Sale/stock movements verified without inventory drift |
| Restock/receiving | Approval and receiving lifecycle exercised with stock effects verified |
| Forecasting | Generation and fallback path tested with representative data |
| External providers | Email and OAuth integrations tested when included in release scope |
| Accessibility | Keyboard, focus, contrast, touch-target and non-color status evidence captured when required |
| Failure states | DB unavailable/backend unavailable/offline/degraded behavior observed and documented |

## 10. Coverage Measurement Status

The repository currently documents a **risk-based coverage philosophy**, not a numeric code-coverage threshold. `testing/COVERAGE-STANDARDS.md` explicitly states that no coverage tool is configured in that foundation document. Therefore:

- do not claim a percentage such as “90% test coverage” without measured evidence;
- use test inventory and CI results as behavior coverage evidence;
- if numeric coverage becomes a release requirement, add a coverage tool, committed configuration, threshold, and archived CI result.

## 11. Release Evidence Policy

For every release candidate, record at minimum:

1. Exact commit SHA and branch/tag.
2. CI workflow run URL/status for the exact commit.
3. Commands used for any required local/domain verification.
4. Installer/package artifact identifier and checksum where available.
5. Target-machine manual QA result.
6. Known accepted limitations and open release blockers.
7. Accessibility/HCI evidence when part of the acceptance criteria.
8. Dependency/security audit result against the exact release dependency graph.

A document saying a test exists is not evidence that the current release commit passed it.