# Deployment Foundation

## Purpose

This folder defines the deployment foundation for the YsabelleStore Electron desktop application. It documents how the app should be built, packaged, validated, versioned, and released in the future without creating a production release.

## Scope

- Offline-first Windows desktop deployment
- Local installation behavior
- Electron Builder packaging workflow
- Version and release planning
- Build and validation expectations

## Responsibilities

| Area             | Responsibility                                                  |
| ---------------- | --------------------------------------------------------------- |
| Deployment model | Keep deployment local, offline-first, and Windows-focused       |
| Packaging        | Document the future `electron-builder` flow                     |
| Versioning       | Define version labels and semantic versioning policy            |
| Validation       | Describe checks required before a release candidate is promoted |
| Troubleshooting  | Capture common build and packaging failures                     |

## Future Deployment Flow

```text
Development
  -> Validation
  -> Build
  -> Packaging
  -> Installer
  -> Release Candidate
  -> Final Release
```

## Future Implementation Notes

- Deployment artifacts should remain separate from source code.
- The deployment process should support local MySQL and offline use.
- No cloud hosting, release publishing, or auto-update logic belongs here.

## Local Development Deployment Notes

Docker Compose is used only to provide the local MySQL database during development. It does not replace the npm workspace commands for the backend, frontend, or Electron app.

Recommended local setup after pulling the repository:

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run prisma:validate
npm run dev --workspace backend
npm run dev --workspace frontend
```

For Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env
```

Stop the local database:

```bash
docker compose down
```

Reset the local database volume only when local data can be deleted:

```bash
docker compose down -v
docker compose up -d
```

## Validation Checklist

- [x] Purpose is defined
- [x] Deployment scope is limited
- [x] Responsibilities are documented
- [x] Future deployment flow is outlined
- [x] No production deployment logic is included
