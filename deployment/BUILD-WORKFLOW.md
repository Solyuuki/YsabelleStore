# Build Workflow

## Purpose

This document defines the documentation-only build workflow for the YsabelleStore deployment foundation.

## Scope

- Development validation
- Build preparation
- Packaging preparation
- Installer handoff
- Release candidate promotion

## Workflow

```text
Development
  -> Validation
  -> Build
  -> Packaging
  -> Installer
  -> Release Candidate
  -> Final Release
```

## Workflow Stages

| Stage             | Goal                                    | Output                   |
| ----------------- | --------------------------------------- | ------------------------ |
| Development       | Make source changes in a focused branch | Updated code and docs    |
| Validation        | Confirm code quality and schema health  | Passing checks           |
| Build             | Compile the app and workspace packages  | Build artifacts          |
| Packaging         | Prepare the Windows desktop package     | Electron bundle          |
| Installer         | Generate the Windows Setup executable   | `YsabelleStoreSetup.exe` |
| Release Candidate | Review a near-final build set           | Candidate package        |
| Final Release     | Promote approved release assets         | Release-ready files      |

## Documentation-Only Commands

```bash
npm run format
npm run format:check
npm run lint
npm run build
npm audit --audit-level=high
npx prisma validate --schema=database/prisma/schema.prisma
```

## Future Implementation Notes

- Build validation should happen before packaging.
- Packaging should happen before any release candidate is reviewed.
- Release candidate approval should be based on validation evidence, not assumptions.

## Validation Checklist

- [x] Workflow stages are documented
- [x] Commands are listed as documentation only
- [x] Release progression is clear
- [x] No packaging implementation is included
