# Folder Architecture

This document describes the future application folder structure. These folders are architecture targets only and must not be created until the matching implementation sprint begins.

## Future Folder Tree

```text
YsabelleStore/
  frontend/
    src/
      components/
      pages/
      hooks/
      services/
      validation/
      state/
  backend/
    src/
      routes/
      controllers/
      services/
      validators/
      middleware/
  electron/
    main/
    preload/
    packaging/
  database/
    prisma/
      schema.prisma
      migrations/
  forecasting-service/
    models/
    services/
    validation/
  docs/
    architecture/
    standards/
    implementation-artifacts/
```

## Folder Rules

| Folder                 | Rule                                                       |
| ---------------------- | ---------------------------------------------------------- |
| `frontend/`            | Frontend code must stay inside `frontend/`                 |
| `backend/`             | Backend code must stay inside `backend/`                   |
| `electron/`            | Electron desktop shell must stay inside `electron/`        |
| `database/`            | Prisma and database files must stay inside `database/`     |
| `forecasting-service/` | Python forecasting must stay inside `forecasting-service/` |
| `docs/`                | Documentation must stay inside `docs/`                     |

## Responsibility Map

| Folder                 | Primary Content                                                  | Owner                 |
| ---------------------- | ---------------------------------------------------------------- | --------------------- |
| `frontend/`            | React UI, pages, components, hooks, API service clients          | m1                    |
| `backend/`             | Express routes, controllers, services, validators, middleware    | m2                    |
| `electron/`            | Main process, preload scripts, packaging configuration           | m1                    |
| `database/`            | Prisma schema, migrations, seed strategy                         | m2                    |
| `forecasting-service/` | Python SARIMA model, forecast validation, recommendation support | m3                    |
| `docs/`                | Standards, architecture, workflow, sprint artifacts              | m1 with shared review |

## Placement Decision Table

| Work Item           | Correct Folder                   | Incorrect Folder       |
| ------------------- | -------------------------------- | ---------------------- |
| Dashboard page      | `frontend/`                      | `backend/`             |
| Product API route   | `backend/`                       | `frontend/`            |
| Prisma model        | `database/`                      | `forecasting-service/` |
| SARIMA model script | `forecasting-service/`           | `electron/`            |
| Secure IPC bridge   | `electron/`                      | `database/`            |
| Sprint report       | `docs/implementation-artifacts/` | `frontend/`            |

## Validation Checklist

- [ ] New files are placed in the approved future folder
- [ ] Cross-folder changes are justified by task scope
- [ ] Folder ownership is respected
- [ ] No application folders are created before the approved implementation sprint
- [ ] Documentation examples are not mistaken for generated source code
