# YsabelleStore Deployment and Release Foundation

> **Current baseline:** `sprint/v0.10/sprint-10`

## Purpose

This directory documents how the current YsabelleStore application is built, validated, packaged and prepared for a Windows desktop release. The repository now contains a configured Electron/electron-builder packaging boundary; this document distinguishes what is implemented from what still requires final release operations.

## Current Deployment Model

| Area | Current State |
| --- | --- |
| Primary deployment | Local/offline-first Windows desktop application |
| Frontend | React/Vite build bundled into the desktop application |
| Backend | Local Node.js/Express service boundary |
| Database | Local MySQL through Prisma |
| Forecasting | Local Python forecasting process/service boundary |
| Desktop shell | Electron |
| Packaging | electron-builder |
| Installer target | Windows NSIS |
| Cloud hosting | Not part of the current production deployment envelope |
| Auto-update | Not implemented in the current foundation |
| Public release publishing | Requires explicit release process; not implied by packaging configuration |

## Electron Packaging Configuration

The active Electron Builder configuration currently declares:

| Setting | Value |
| --- | --- |
| App ID | `com.ysabellestore.desktop` |
| Product name | `YsabelleStore` |
| Electron version in builder config | `42.8.1` |
| Build resources | `electron/build` |
| Output | `electron/release` |
| Windows target | `nsis` |
| One-click install | `false` |
| Per-machine install | `false` |
| Custom install directory | Allowed |
| Bundled frontend | `frontend/dist` copied as an extra resource |

The Electron workspace manifest declares `electron: ^42.5.0` while the builder configuration pins `42.8.1`. Release engineering should normalize or intentionally document the selected runtime before a formal release.

## Build and Package Commands

From the repository/workspace as appropriate:

```bash
npm run build
npm run build --workspace frontend
npm run build --workspace backend
npm run build --workspace electron
npm run package --workspace electron
```

Packaging should only follow successful prerequisite validation.

## Release Validation Baseline

The main CI pipeline uses MySQL 8.0, Node 22 and Python 3.12 and validates:

- clean dependency installation;
- Prisma generation/schema validation;
- disposable database setup;
- guardrail preflight;
- formatting;
- linting;
- TypeScript types;
- repository/workspace tests;
- Python forecast tests;
- full and per-workspace builds;
- production dependency/security audit;
- version consistency;
- sprint/artifact status.

A distributable release should additionally validate the packaged Windows installer and runtime on the target deployment machine.

## Release Flow

```text
Development
  -> Source / schema / test validation
  -> CI quality gates
  -> Build
  -> Electron packaging
  -> Windows installer validation
  -> Release Candidate
  -> Deployment acceptance
  -> Final Release
```

## Deployment Configuration

Production/deployment secrets must not be committed. Environment-specific values include database credentials, JWT/OAuth protection secrets, email provider credentials and social OAuth credentials. `.env.example` exists only as a configuration template.

External features such as Resend email, Google OAuth and Meta OAuth require provider/network availability. They do not change the core local deployment classification.

## Operational Health

The backend exposes health endpoints suitable for local runtime verification:

- `GET /api/health`
- `GET /api/health/live`
- `GET /api/health/ready`

Readiness must be used to distinguish a running process from a runtime that is actually ready to serve critical operations.

## Current Non-Goals

- No production cloud-hosting architecture is declared here.
- No macOS/Linux package target is currently declared.
- No automatic update mechanism is currently part of the deployment foundation.
- No silent external supplier purchase is initiated by recommendations.
- Packaging configuration alone must not be represented as evidence that a final signed/released installer has already been published.

## Release Documentation

The following repository documents should be reviewed with each release candidate:

- `SYSTEM_SUPPORT_MATRIX.md`
- `SYSTEM_TECHNOLOGY_REGISTER.md`
- `THIRD_PARTY_NOTICES.md`
- `docs/compliance/SOFTWARE-COMPONENT-INVENTORY.md`
- `docs/support/LIMITATIONS-AND-NON-GOALS.md`
- `testing/README.md`
- current CI configuration and sprint/release evidence

## Source of Truth

Executable packaging configuration, package manifests, CI workflows and current source outrank stale planning notes. Update this document when the active deployment envelope changes.