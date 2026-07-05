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

Local MySQL Community Server is used to provide the development database. It does not replace the npm workspace commands for the backend, frontend, or Electron app.

Recommended local setup after pulling the repository:

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:validate
npx prisma db push --schema database/prisma/schema.prisma
npm run db:seed
npm run dev --workspace backend
npm run dev --workspace frontend
```

For Windows PowerShell, copy the environment file with:

```powershell
Copy-Item .env.example .env
Start-Service MySQL80
```

If the local database needs to be restarted, use the MySQL80 service controls and recreate the `ysabellestore` database only when local data can be deleted.

## Validation Checklist

- [x] Purpose is defined
- [x] Deployment scope is limited
- [x] Responsibilities are documented
- [x] Future deployment flow is outlined
- [x] No production deployment logic is included
