# Folder Guide

This guide explains how to use each repository area during development.

## Folder Usage Table

| Folder                           | Allowed Content                                    | Not Allowed              |
| -------------------------------- | -------------------------------------------------- | ------------------------ |
| `.github/`                       | PR templates, GitHub Actions workflows             | Application source code  |
| `docs/standards/`                | Approved engineering standards                     | Personal notes or drafts |
| `docs/implementation-artifacts/` | Sprint planning, progress, blockers, testing notes | Source code              |
| `app/frontend/`                  | React components, pages, hooks, services           | Database migrations      |
| `app/backend/`                   | Express routes, controllers, services, validators  | React UI components      |
| `app/electron/`                  | Electron main process and desktop integration      | Forecasting model logic  |
| `app/forecasting/`               | Python SARIMA engine and forecast validation       | Express route handlers   |
| `prisma/`                        | Schema, migrations, seeds                          | UI state management      |

## File Placement Examples

| Good Placement                                 | Bad Placement                                 |
| ---------------------------------------------- | --------------------------------------------- |
| `app/frontend/src/components/ProductTable.tsx` | `docs/ProductTable.tsx`                       |
| `app/backend/src/routes/inventory.routes.ts`   | `app/frontend/src/routes/inventory.routes.ts` |
| `app/forecasting/sarima_engine.py`             | `app/backend/src/sarima_engine.py`            |
| `prisma/schema.prisma`                         | `app/backend/schema.prisma`                   |

## Process Flow

```text
New Task
  -> Check ownership
  -> Confirm folder location
  -> Create focused branch
  -> Implement within assigned folder
  -> Record affected files
  -> Validate
  -> Open PR
```

## Shared File Rules

| Shared File Type            | Required Action             |
| --------------------------- | --------------------------- |
| `README.md`                 | Coordinate with m1          |
| `prisma/schema.prisma`      | Coordinate with m2          |
| Forecast output contract    | Coordinate with m2 and m3   |
| Electron preload contract   | Coordinate with m1 and m2   |
| Recommendation output shape | Coordinate with all members |

## Folder Checklist

- [ ] The file belongs to the assigned member's ownership area
- [ ] Shared files have owner approval
- [ ] The folder path matches the naming standard
- [ ] The file is small enough to remain maintainable
- [ ] The file has a clear purpose
