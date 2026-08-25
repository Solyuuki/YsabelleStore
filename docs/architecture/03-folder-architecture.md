# Repository Folder Architecture

This document is the canonical map for the **current** top-level repository layout. It describes active responsibilities, not a future scaffold plan. When a path in this document disagrees with the repository, current source is authoritative and this document should be updated.

## Current Top-Level Structure

```text
YsabelleStore/
├── frontend/
│   └── src/
├── backend/
│   └── src/
├── electron/
├── database/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── migrations/
│   └── seed/
├── forecasting-service/
├── docs/
├── testing/
├── deployment/
├── config/
├── scripts/
├── tools/
│   └── repo-context/
├── .agents/
│   └── skills/
└── .codex/
```

The exact contents below these boundaries evolve with implementation. Do not invent a path from an older planning document when the current repository uses a different structure.

## Responsibility Map

| Folder                 | Primary Responsibility                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `frontend/`            | React/Vite UI, pages, components, layouts, hooks, schemas, client services, presentation state.  |
| `backend/`             | Express routes/controllers/services, validation, middleware, domain logic, backend integrations. |
| `electron/`            | Electron main/preload/IPC/runtime and desktop packaging integration.                             |
| `database/`            | Prisma schema, migrations, seed utilities, and database-specific guidance.                       |
| `forecasting-service/` | Python SARIMA execution/evaluation and forecast-service tests.                                   |
| `docs/`                | Current architecture/contracts/standards plus sprint and historical evidence.                    |
| `testing/`             | Cross-project testing and validation guidance.                                                   |
| `deployment/`          | Build, release, installer, and deployment guidance.                                              |
| `config/`              | Repository/application configuration that is safe to commit.                                     |
| `scripts/`             | Deterministic development, audit, validation, and repository automation.                         |
| `tools/repo-context/`  | Persistent repository-context index, freshness, CLI, MCP, and related tests.                     |
| `.agents/skills/`      | Project-level reusable coding-agent operating policy.                                            |
| `.codex/`              | Project-scoped Codex configuration such as the repository-context MCP registration.              |

## Architecture Boundaries

| Work                                               | Correct Boundary                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| React/customer/internal UI                         | `frontend/`                                                      |
| HTTP routing, validation, business/domain services | `backend/`                                                       |
| Prisma model/schema change                         | `database/prisma/schema.prisma` + `database/migrations/`         |
| SARIMA/statistical implementation                  | `forecasting-service/` and approved backend integration boundary |
| Electron lifecycle or secure preload/IPC           | `electron/`                                                      |
| Repository automation                              | `scripts/` or a focused tool under `tools/`                      |
| Current architecture/contract guidance             | `docs/`                                                          |
| Persistent generated repository context            | `.ysabelle-context/` locally; never committed                    |

## Placement Rules

- Keep frontend code out of backend/database internals.
- Keep backend business rules out of route declarations when a service boundary exists.
- Keep Prisma/MySQL access behind backend/database boundaries; the renderer must not access it directly.
- Keep Python forecasting logic outside Express route handlers.
- Keep generated output and local persistent context ignored unless a project rule explicitly requires committing it.
- Prefer extending an existing coherent module before creating a new top-level folder.
- When introducing a genuinely new top-level responsibility, update this document and `config/repository-context.json` in the same coherent change.

## Historical Note

`docs/standards/02-folder-map.md` originated as a pre-implementation planning map. It is retained as a compatibility pointer, but this document and the current repository are the active folder authority.
