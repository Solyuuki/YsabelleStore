# YsabelleStore Deployment and Operations Runbook

> **Baseline:** `sprint/v0.10/sprint-10`
>
> **Purpose:** define the current build, startup, health, dependency, packaging, failure-handling, recovery, and release-operational boundaries for YsabelleStore. This runbook distinguishes **configured capability** from **release-proven capability**.

## 1. Current Deployment Model

| Layer                | Current Runtime / Boundary                   | Deployment Responsibility                         |
| -------------------- | -------------------------------------------- | ------------------------------------------------- |
| Desktop shell        | Electron                                     | Launch packaged renderer and desktop integrations |
| Frontend             | React/Vite build                             | Packaged renderer UI                              |
| Backend              | Node.js + Express                            | Local HTTP API and business logic                 |
| ORM                  | Prisma                                       | Backend database access                           |
| Database             | MySQL                                        | Persistent business data                          |
| Forecasting          | Python + pandas/NumPy/statsmodels            | Local forecasting execution boundary              |
| Catalog image engine | Python                                       | Catalog image processing/quality workflows        |
| External email       | Resend production; Gmail SMTP development QA | Network/provider-dependent optional integration   |
| External social auth | Google OAuth, Facebook/Meta OAuth            | Network/provider-dependent optional integration   |
| Packaging            | electron-builder                             | Windows desktop package generation                |
| Installer            | NSIS                                         | User-scoped Windows installation target           |

### Deployment classification

The intended architecture is **local/offline-first desktop operation with optional network-dependent integrations**. Cloud hosting is not the current production deployment envelope.

## 2. Supported / Validated Runtime Baseline

| Requirement | Repository / CI Evidence                            | Operational Treatment                                                      |
| ----------- | --------------------------------------------------- | -------------------------------------------------------------------------- |
| Windows     | Electron Builder targets `win` / `nsis`             | Current packaged target                                                    |
| Node.js     | Engine `>=20.11.0`; CI Node 22                      | Prefer CI-validated Node 22 for release engineering                        |
| npm         | Engine `>=10.0.0`                                   | Required for repository install/build                                      |
| MySQL       | CI service uses MySQL 8.0                           | MySQL 8.0 is the currently CI-validated database family/version            |
| Python      | CI uses Python 3.12                                 | Use Python 3.12 until another version is validated                         |
| Electron    | workspace declares `^42.5.0`; builder pins `42.8.1` | Normalize or intentionally document release runtime before final packaging |
| Prisma      | v6 family in manifests                              | Generate/validate client/schema before startup                             |

Do not claim macOS/Linux packaged support until dedicated package targets and QA evidence exist.

## 3. Critical Packaging Boundary

The current Electron Builder configuration packages:

- Electron workspace build output (`dist/**/*`);
- Electron workspace `package.json`;
- built frontend from `../frontend/dist` as an extra resource.

The active Builder configuration does **not** show the backend build, forecasting-service source/runtime, catalog-image engine, MySQL server, or Python interpreter being embedded into the NSIS artifact.

### Consequence

The current NSIS configuration should be described as a **configured desktop shell/renderer package**, not yet as a proven self-contained full-stack installer.

Before a formal production release, release engineering must choose and validate one of these deployment models:

| Model                             | Requirement                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Managed local prerequisites       | Install/configure MySQL, backend runtime and Python forecasting runtime separately; document exact versions and startup procedure |
| Bundled local services            | Extend packaging so required backend/Python resources and service startup logic are included and verified                         |
| Dedicated local service installer | Package dependent services separately with controlled installation/versioning                                                     |

Until one model is completed and target-machine tested, “one-click full-stack installer” must not be claimed.

## 4. Environment Configuration

Start from `.env.example`; never commit real secrets.

| Variable / Group          | Purpose                           | Required Boundary                                                  |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`            | Prisma/MySQL connection           | Required for database-backed backend readiness                     |
| `JWT_SECRET`              | Internal JWT signing/verification | Required for backend readiness                                     |
| `FRONTEND_URL`            | Local browser frontend URL        | Development/runtime origin configuration                           |
| `VITE_API_BASE_URL`       | Frontend API base                 | Must point renderer to reachable backend                           |
| `CORS_ORIGINS`            | Browser/Electron allowed origins  | Packaged `file://` renderer uses `null` origin in current template |
| Forecast timeouts/workers | SARIMA process controls           | Operational performance tuning                                     |
| Resend credentials        | Production customer email         | Required only when production email is in scope                    |
| Gmail SMTP credentials    | Development OTP QA                | Development-only                                                   |
| OAuth transaction key     | Protect OAuth transaction state   | Required for social-auth deployment                                |
| Google credentials        | Google OAuth                      | Optional/provider-dependent                                        |
| Meta credentials          | Facebook/Meta OAuth               | Optional/provider-dependent                                        |

Secrets must be supplied through local/host secret handling, not committed files.

## 5. Clean Environment Provisioning

### 5.1 Source checkout

Use the exact approved release commit/tag. Record the SHA before installation.

### 5.2 Node dependencies

```bash
npm ci
```

For release reproducibility, use the committed lockfile and avoid ad-hoc dependency upgrades during packaging.

### 5.3 Python forecasting dependencies

```bash
python -m pip install -r forecasting-service/requirements.txt
```

**Known reproducibility limitation:** current Python requirements are not pinned to exact versions. Freeze an approved set before formal release distribution.

### 5.4 Database

Provision a MySQL database matching the configured `DATABASE_URL`.

Then:

```bash
npm run prisma:generate
npm run prisma:validate
```

Development/local schema synchronization exists through:

```bash
npm run prisma:sync:dev
```

Do not use a development schema-sync command as a substitute for a controlled production migration procedure without explicit release approval.

## 6. Build Procedure

Run release validation before packaging.

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

Workspace builds can also be checked independently:

```bash
npm run build --workspace frontend
npm run build --workspace backend
npm run build --workspace electron
```

## 7. Windows Packaging Procedure

After successful validation:

```bash
npm run package --workspace electron
```

Current Builder settings:

| Setting                      | Value                       |
| ---------------------------- | --------------------------- |
| App ID                       | `com.ysabellestore.desktop` |
| Product name                 | `YsabelleStore`             |
| Electron Builder runtime pin | `42.8.1`                    |
| Target                       | NSIS                        |
| One-click                    | `false`                     |
| Per-machine                  | `false`                     |
| Installation directory       | User may change directory   |
| Package output               | `electron/release`          |

The package must be tested on a clean/representative Windows target. Successful artifact generation alone is not deployment acceptance.

## 8. Runtime Startup Order

For a full-stack local deployment, use this dependency order:

```text
1. MySQL available
2. Environment/secrets loaded
3. Backend starts
4. /api/health/live responds
5. /api/health/ready returns ready=true / HTTP 200
6. Frontend/Electron renderer starts
7. Authentication/domain smoke tests
8. Forecasting execution checked when forecast capability is required
9. External email/OAuth checked only when included in deployment scope
```

The Electron main process currently loads the packaged frontend. It does not, by itself, prove that MySQL/backend/Python services have been started.

## 9. Health and Readiness Operations

| Endpoint                | Meaning                  | Expected Use                      |
| ----------------------- | ------------------------ | --------------------------------- |
| `GET /api/health`       | Aggregate backend status | Diagnostic summary                |
| `GET /api/health/live`  | Process liveness         | Confirms backend process responds |
| `GET /api/health/ready` | Critical readiness       | Release/runtime readiness gate    |

Readiness depends on database connectivity and required backend configuration such as `JWT_SECRET`. A live process can still be **not ready**.

Operational rule: do not allow staff to treat “process running” as “system ready” when readiness is failing.

## 10. Operational Smoke Tests

Minimum target-environment smoke test after startup:

| Area          | Check                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| Backend       | Liveness + readiness                                                        |
| Internal auth | OWNER/STAFF sign-in and protected API access                                |
| Customer auth | Customer sign-in/session if customer account capability is in release scope |
| Catalog       | Product list/detail loads                                                   |
| Inventory     | Inventory values load and no reconciliation warning appears                 |
| POS           | Product lookup and controlled test transaction path                         |
| Storefront    | Product browsing and order path                                             |
| Restock       | Current approved sprint lifecycle path                                      |
| Forecast      | Existing forecast load/generation smoke if enabled                          |
| Renderer      | Packaged Electron frontend loads without fatal error                        |
| Error states  | Backend/DB failure state is understandable and recoverable                  |

Use disposable/test records for release QA; do not alter live business data merely to prove a smoke check.

## 11. Observability and Diagnostics

Current backend observability includes:

- server-generated `x-request-id`;
- structured request-completion logs containing method, path, status, duration and request ID;
- sanitized server-error responses;
- health/readiness endpoints;
- runtime reporting via `npm run runtime:report`;
- health check script via `npm run healthcheck`.

When investigating an incident, preserve the request ID and relevant safe logs. Do not collect or paste authentication tokens, passwords, OTP values, OAuth secrets, or full request headers into support evidence.

## 12. Incident Response Matrix

| Symptom                                   | First Checks                                          | Likely Boundary       | Safe Response                                                                     |
| ----------------------------------------- | ----------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------- |
| App window opens but data does not load   | `/api/health/ready`, API base URL                     | Backend/DB/config     | Restore backend readiness before normal operations                                |
| Backend live but not ready                | DB status, `DATABASE_URL`, `JWT_SECRET`               | Database/config       | Correct dependency/configuration; do not bypass readiness                         |
| Database unavailable                      | MySQL service/credentials/connectivity                | MySQL                 | Stop write operations until DB is restored                                        |
| Login fails broadly                       | readiness, JWT secret, account status                 | Auth/backend          | Verify config before resetting accounts                                           |
| Customer email OTP fails                  | provider credentials/network                          | Resend/Gmail boundary | Use documented provider path; do not expose secrets                               |
| Social auth fails                         | OAuth credentials/callback/public URL/provider status | Google/Meta           | Check exact callback/config and provider availability                             |
| Forecast generation fails                 | Python env, requirements, input validation, timeout   | Forecast service/data | Run validation/smoke; allow documented fallback behavior only where implemented   |
| Product image processing fails            | Python image engine/input/state                       | Catalog image engine  | Preserve original asset/state and retry through governed pipeline                 |
| Installer runs but app lacks backend data | deployment topology/prerequisites                     | Packaging gap         | Verify backend/MySQL/Python deployment; do not claim self-contained install       |
| Inventory mismatch suspected              | inventory audit/reconciliation                        | Stock domain          | Stop corrective guessing; run audit/reconciliation and preserve movement evidence |

## 13. Backup and Recovery Position

A branch-level repository scan does not establish a dedicated automated production database-backup subsystem or a complete disaster-recovery automation path.

Therefore the current documentation must **not** claim automatic backups.

Before production use, the deployment owner should define and test:

| Recovery Requirement | Minimum Control                                                                 |
| -------------------- | ------------------------------------------------------------------------------- |
| Database backup      | Scheduled MySQL-compatible backup outside the application process               |
| Backup retention     | Defined retention window and storage location                                   |
| Restore drill        | Verified restoration into a non-production database                             |
| Release snapshot     | Backup before schema/data migration or high-risk release                        |
| File assets          | Backup governed local catalog/image assets if stored outside DB                 |
| Secrets              | Secure recovery procedure; secrets must not be embedded in backup documentation |
| Recovery evidence    | Date, operator, backup ID/path, restore result                                  |

Until a restore drill is completed, backup existence alone is not proof of recoverability.

## 14. Rollback Policy

Application rollback and data rollback are separate operations.

| Rollback Area    | Policy                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Source/app       | Redeploy the last approved release artifact/commit                                                         |
| Database schema  | Do not blindly reverse schema changes; use reviewed migration/repair procedure                             |
| Business data    | Restore only through an approved backup/recovery or domain-specific rollback workflow                      |
| Historical sales | Use the application’s explicit historical-sales rollback contract where applicable                         |
| Inventory        | Never “fix” stock through direct DB edits when auditable inventory movements/reconciliation should be used |
| Forecast data    | Regenerate/rebuild only through supported forecasting workflow                                             |

Record rollback reason, exact versions/SHAs, database state, and post-rollback verification.

## 15. External-Service Degradation

Resend, Gmail SMTP, Google OAuth and Meta OAuth require provider/network availability. Failure of these services should not be described as failure of every local core capability.

Document which deployment functions require network access and provide an explicit degraded-state message where the current UI supports it.

## 16. Release Blockers / Hardening Items

The following should be resolved or explicitly accepted before calling the system production/company release ready:

| Item                               | Current State                                                                                 |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Full-stack installer topology      | Electron package does not currently evidence bundled backend/Python/MySQL                     |
| Python dependency pinning          | Requirements are currently unpinned                                                           |
| Electron runtime version alignment | Manifest range and Builder pin differ                                                         |
| Installer target-machine QA        | Must be executed and evidenced per release                                                    |
| Backup/restore automation          | No dedicated automated production backup subsystem established in current repository evidence |
| Upload-size policy consistency     | Import middleware/error/security constants require normalization per security register        |
| Browser compatibility              | Do not claim broad browser support without QA matrix                                          |
| macOS/Linux packaging              | Not currently targeted/verified                                                               |
| Auto-update                        | Not currently implemented                                                                     |

## 17. Release Evidence Package

For each approved release retain:

1. release commit SHA/tag;
2. CI result for that exact SHA;
3. dependency/security audit result;
4. build/package log;
5. installer artifact identifier/checksum;
6. target-machine QA checklist;
7. database backup/restore evidence when required;
8. configuration/version inventory without secrets;
9. known limitations/accepted risks;
10. third-party compliance/SBOM evidence.

Operational documentation should be updated whenever packaging, runtime topology, database handling, or external provider boundaries change.
