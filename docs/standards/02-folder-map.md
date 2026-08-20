# Folder Map Compatibility Note

This file is retained because older sprint records and links may reference it. It is **not** the active repository-layout authority.

Use [`../architecture/03-folder-architecture.md`](../architecture/03-folder-architecture.md) for the current folder architecture and inspect the current repository before creating or moving files.

## Current Top-Level Boundaries

| Path | Responsibility |
| --- | --- |
| `frontend/` | React/Vite UI and client-side application code. |
| `backend/` | Express API, validation, services, middleware, and backend domain logic. |
| `electron/` | Desktop runtime, preload/IPC, and packaging integration. |
| `database/` | Prisma schema, migrations, seed support, and database guidance. |
| `forecasting-service/` | Python SARIMA execution and model evaluation. |
| `docs/` | Architecture, contracts, standards, sprint/history records. |
| `testing/` | Testing and validation guidance. |
| `deployment/` | Build/release/installer guidance. |
| `scripts/` | Deterministic repository automation and validation. |
| `tools/` | Focused engineering tools such as persistent repository context. |

## Rule

Do not use historical planned folder names to decide where current code belongs. Current source plus the canonical folder architecture define active placement.
