# Windows Installer

> **Current baseline:** `sprint/v0.10/sprint-10`

## Purpose

This document describes the **currently configured** Windows installer boundary for YsabelleStore and separates packaging configuration from release-proven behavior.

## Current Packaging Configuration

| Item | Current Configuration | Verification State |
| --- | --- | --- |
| Desktop shell | Electron | Configured |
| Packager | `electron-builder` | Configured |
| App ID | `com.ysabellestore.desktop` | Configured |
| Product name | `YsabelleStore` | Configured |
| Windows target | NSIS | Configured |
| One-click installer | `false` | Configured |
| Per-machine installation | `false` | Configured as user-scoped |
| Installation directory | User can change directory | Configured |
| Application icon | `electron/build/icon.ico` prepared by workspace script | Configured; target-machine visual QA required |
| Package output | `electron/release` | Configured |
| Bundled renderer | `frontend/dist` copied into packaged resources | Configured |
| Auto-update | Not configured | Not supported |
| macOS/Linux installer | No active package target | Not claimed |

## Important Full-Stack Boundary

The current Electron Builder configuration packages the Electron output and built frontend renderer. It does **not** by itself establish that all of the following are embedded or automatically provisioned by the installer:

| Runtime Dependency | Current Installer Evidence |
| --- | --- |
| Node/Express backend service | Not shown as an `electron-builder` packaged resource/service |
| MySQL Server/database provisioning | Not shown as installer-managed provisioning |
| Python runtime | Not shown as embedded |
| Forecasting-service Python dependencies | Not shown as embedded |
| Catalog-image Python runtime/dependencies | Not shown as embedded |
| Production secrets/configuration | Must be supplied outside committed source; not installer-bundled by evidence reviewed |

Therefore, **do not describe the current NSIS artifact as a self-contained one-click full-stack installer** until target-machine packaging/startup evidence proves that claim.

## Installer Generation

From the repository after prerequisite validation:

```bash
npm run build
npm run package --workspace electron
```

The Electron package command prepares the Windows icon and invokes `electron-builder` with `electron/electron-builder.config.cjs`.

## Required Target-Machine Acceptance

A release candidate is not accepted merely because `electron-builder` produces an installer. Validate on a clean/supported Windows target:

1. Installer starts and presents the expected NSIS flow.
2. Installation directory selection works.
3. Installed application launches without fatal Electron errors.
4. Renderer assets load correctly from the packaged resource path.
5. Required backend/database/forecasting dependencies are available through the documented deployment procedure.
6. Health/readiness checks succeed before operational workflows are accepted.
7. OWNER/STAFF login and critical POS/inventory workflows pass smoke testing.
8. Forecasting is tested when it is part of the release scope.
9. Uninstall behavior is observed and documented; business data must not be assumed safe or removed without an explicit policy.

## Release Blockers

- Electron runtime version mismatch between workspace declaration and builder configuration is unresolved unless intentionally normalized/documented for the release.
- A package that cannot reach its required backend/database runtime is not a valid full application release.
- Missing production secrets or database configuration blocks readiness even when Electron itself launches.
- Installer signing/publisher reputation must not be claimed unless actually configured and evidenced.

## Related Documentation

- [`OPERATIONS-RUNBOOK.md`](OPERATIONS-RUNBOOK.md)
- [`RELEASE-VERIFICATION-MATRIX.md`](RELEASE-VERIFICATION-MATRIX.md)
- [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md)
- [`../SYSTEM_SUPPORT_MATRIX.md`](../SYSTEM_SUPPORT_MATRIX.md)

## Source of Truth

`electron/electron-builder.config.cjs`, the Electron workspace manifest/source, the built artifact, and target-machine QA outrank historical installer planning notes.
