# Release Checklist

> **Current baseline:** `sprint/v0.10/sprint-10`

## Purpose

This checklist is the operational release gate for YsabelleStore. A checked item means evidence was produced for the **exact release candidate commit/artifact**; this file does not itself prove that the latest branch head has passed the gate.

## 1. Source and Repository Identity

- [ ] Exact release commit SHA recorded.
- [ ] Release branch/tag recorded.
- [ ] Working tree/source artifact matches the recorded SHA.
- [ ] Version consistency passes with `npm run version:check`.
- [ ] Sprint/artifact state passes with `npm run verify:status`.
- [ ] Applicable PR/CI/repository-governance checks are green.

## 2. Dependency and Compliance

- [ ] `npm ci` completes from the committed lockfile.
- [ ] `npm run security:audit:production` passes or every exception has a documented risk acceptance.
- [ ] Development-only dependency findings are reviewed where relevant.
- [ ] Direct/material dependency licenses and third-party notices are reviewed against the exact release dependency set.
- [ ] Python forecasting dependencies are frozen/recorded for the release or the release explicitly documents that reproducibility gap.
- [ ] External provider terms/configuration are reviewed when Resend, Google OAuth, or Meta/Facebook OAuth is in release scope.
- [ ] Required third-party notices/license texts are included or otherwise preserved as applicable.

## 3. Static and Schema Gates

- [ ] `npm run guardrail:preflight`
- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run prisma:generate`
- [ ] `npm run prisma:validate`
- [ ] Release database schema/migration state reviewed.

## 4. Automated Tests

- [ ] `npm run test:guardrails`
- [ ] `npm test --workspaces --if-present`
- [ ] `npm run forecast:test`
- [ ] Targeted barcode/inventory/restock/security tests run when affected.
- [ ] Health/readiness, error-safety, and request-traceability regressions pass.
- [ ] Any failing/skipped test has documented disposition; no unexplained release-critical failure remains.

## 5. Build and Packaging

- [ ] `npm run build`
- [ ] Frontend workspace build succeeds.
- [ ] Backend workspace build succeeds.
- [ ] Electron workspace build succeeds.
- [ ] `npm run package --workspace electron` succeeds for Windows release scope.
- [ ] Generated NSIS installer/artifact is archived with checksum or equivalent identity evidence.
- [ ] Electron runtime version used by the package is explicitly recorded and reconciled with the workspace/config declarations.

## 6. Runtime / Target-Machine Acceptance

- [ ] Installer tested on the intended supported Windows target.
- [ ] Installed application launches.
- [ ] Packaged renderer loads correctly.
- [ ] Backend is available through the documented deployment procedure.
- [ ] MySQL/database connection is configured and healthy.
- [ ] `GET /api/health/live` returns healthy liveness.
- [ ] `GET /api/health/ready` reports ready before business operations are accepted.
- [ ] OWNER login succeeds.
- [ ] STAFF login/role restrictions succeed where applicable.
- [ ] Critical POS transaction smoke test succeeds.
- [ ] Inventory movement/stock truth smoke test succeeds.
- [ ] Storefront/customer flow is tested when included in release scope.
- [ ] Forecast generation/delivery is tested when included in release scope.

## 7. Data Safety and Recovery

- [ ] Production/business database backup captured before upgrade/deployment where applicable.
- [ ] Backup location and retention owner recorded.
- [ ] Restore procedure is known and, for a formal production release, has evidence from an appropriate restore drill or controlled validation.
- [ ] Migration/rollback plan documented for schema-affecting changes.
- [ ] Application rollback commit/artifact recorded.
- [ ] Rollback does not assume incompatible database changes can be reversed without data review.

## 8. Security / Secrets

- [ ] Real secrets are absent from committed source and release documentation.
- [ ] `JWT_SECRET` and database credentials are supplied through approved runtime configuration.
- [ ] `CUSTOMER_OAUTH_TRANSACTION_KEY` is configured when social auth is enabled.
- [ ] Resend/Google/Meta credentials are provided only when those integrations are enabled.
- [ ] CORS origins match the intended renderer/web deployment.
- [ ] Sensitive customer-auth responses remain non-cacheable.
- [ ] Upload-limit discrepancy and other known security hardening items are either fixed or explicitly accepted for the release.

## 9. UI / Accessibility / HCI Evidence

- [ ] Primary Tailwind CSS license evidence captured from the authoritative upstream source.
- [ ] At least four representative application screens/states captured, including one error or empty state.
- [ ] WCAG contrast measurements recorded with a named tool.
- [ ] Touch-target measurements/inspection completed for representative interactive controls.
- [ ] Keyboard navigation and visible focus tested for representative workflows.
- [ ] Color-coded statuses provide a secondary non-color cue.
- [ ] README/About attribution evidence captured.

## 10. Release Decision Matrix

| Gate                     | Pass Means                                                      | Fail Means                                                    |
| ------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------- |
| CI/static                | Repository quality checks pass                                  | Release blocked until corrected/accepted                      |
| Tests                    | Critical behavior/security contracts pass                       | Release blocked for release-critical failure                  |
| Schema/database          | Prisma/schema/runtime DB state is valid                         | Release blocked                                               |
| Security audit           | No unresolved production-reachable high/critical risk           | Remediate or formally reject release                          |
| Packaging                | Expected Windows artifact is generated                          | No distributable candidate                                    |
| Full-stack runtime       | UI, backend, DB and required forecasting boundary work together | Installer/package is not an accepted full application release |
| Data recovery            | Backup/rollback responsibilities are established                | Production deployment blocked                                 |
| Documentation/compliance | Support/license/runtime claims match release artifact           | Correct records before release                                |
| Manual acceptance        | Critical user workflows pass on target machine                  | Release blocked                                               |

## 11. Final Approval Record

| Field                      | Value                     |
| -------------------------- | ------------------------- |
| Release commit SHA         | _Record at release time_  |
| Version                    | _Record at release time_  |
| Artifact/installer         | _Record at release time_  |
| Target Windows environment | _Record at release time_  |
| CI evidence                | _Link/ID at release time_ |
| Database backup evidence   | _Record at release time_  |
| Known accepted risks       | _Record at release time_  |
| Approved by                | _Record at release time_  |
| Approval date              | _Record at release time_  |

For detailed gate definitions, see [`RELEASE-VERIFICATION-MATRIX.md`](RELEASE-VERIFICATION-MATRIX.md) and [`OPERATIONS-RUNBOOK.md`](OPERATIONS-RUNBOOK.md).
