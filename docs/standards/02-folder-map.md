# Folder Map

This document defines the planned repository layout. Application folders are introduced when development begins; documentation and governance files exist immediately.

## Current Foundation Structure

```text
YsabelleStore/
  .github/
    PULL_REQUEST_TEMPLATE.md
    workflows/
      repository-governance.yml
  docs/
    GITHUB-WORKFLOW.md
    implementation-artifacts/
      m1-abarado/
      m2-ramos/
      m3-vito/
    standards/
      01-big-picture.md
      02-folder-map.md
      03-folder-guide.md
      04-env.md
      05-naming-rules.md
      06-coding-standards.md
      07-member-ownership.md
      08-merge-collisions.md
      09-edge-cases.md
      010-golden-rules.md
  README.md
```

## Planned Application Structure

```text
YsabelleStore/
  app/
    electron/
    frontend/
    backend/
    forecasting/
  prisma/
    schema.prisma
    migrations/
  scripts/
  tests/
```

## Folder Ownership Map

| Folder | Owner | Purpose |
| --- | --- | --- |
| `.github/` | m1 | Pull request template and GitHub Actions governance |
| `docs/` | m1 | Project standards, workflow, and thesis implementation artifacts |
| `app/electron/` | m1 | Electron main process, preload scripts, desktop packaging integration |
| `app/frontend/` | m1 | React, TypeScript, Tailwind CSS, shadcn/ui screens and UI shell |
| `app/backend/` | m2 | Express API, services, validators, and backend tests |
| `app/forecasting/` | m3 | Python SARIMA scripts, model validation, forecast outputs |
| `prisma/` | m2 | Prisma schema, migrations, seed data, database rules |
| `scripts/` | Shared | Developer automation approved by task owner |
| `tests/` | Shared | Cross-layer tests and fixtures |

## Decision Table

| Question | Standard |
| --- | --- |
| Where do React components go? | `app/frontend/src/components/` |
| Where do pages go? | `app/frontend/src/pages/` or router-specific equivalent |
| Where do API routes go? | `app/backend/src/routes/` |
| Where do Prisma models live? | `prisma/schema.prisma` |
| Where do SARIMA scripts live? | `app/forecasting/` |
| Where do thesis progress artifacts go? | `docs/implementation-artifacts/<member-folder>/` |

## Validation Checklist

- [ ] New files are placed in the correct owner folder
- [ ] Shared files list affected owners in the task record
- [ ] New folders are documented before they become active development areas
- [ ] Generated files are not committed unless required by the project standard

