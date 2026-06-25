# Database Foundation

This folder is the controlled database foundation for YsabelleStore. It defines the database structure, documentation standards, Prisma entry point, migration holding area, and seed holding area before the project enters schema implementation.

## Responsibility Matrix

| Area          | Responsibility                                                 | Current Phase Rule                 |
| ------------- | -------------------------------------------------------------- | ---------------------------------- |
| Prisma schema | Holds the generator, datasource, and future model sections     | Do not add models yet              |
| Migrations    | Stores future Prisma migration folders                         | Keep empty except `.gitkeep`       |
| Seed          | Stores future seed scripts and fixtures                        | Document only; do not seed         |
| Database docs | Defines architecture, naming, ERD plan, and migration workflow | Keep evaluator-ready               |
| Environment   | Documents the `DATABASE_URL` contract                          | Do not connect MySQL in this phase |

## Structure Overview

```text
database/
|-- prisma/
|   |-- schema.prisma
|   `-- README.md
|-- migrations/
|   `-- .gitkeep
|-- seed/
|   |-- README.md
|   `-- .gitkeep
|-- docs/
|   |-- DATABASE-FOUNDATION.md
|   |-- ERD-PLAN.md
|   |-- NAMING-CONVENTIONS.md
|   `-- MIGRATION-GUIDE.md
|-- .env.example
`-- README.md
```

## Foundation Boundaries

| Allowed Now                       | Reserved for Later                              |
| --------------------------------- | ----------------------------------------------- |
| Folder structure                  | Prisma models                                   |
| Documentation                     | Business fields                                 |
| Generator declaration             | Relationships                                   |
| Datasource declaration            | Indexes and constraints                         |
| Validation with `prisma validate` | Migrations, seed scripts, and client generation |

## Future Implementation Roadmap

| Step                           | Purpose                                               | Entry Condition                         |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------- |
| 1. Schema design review        | Approve entities and relationships                    | Foundation docs accepted                |
| 2. Prisma model implementation | Add models, mapped table names, and field definitions | ERD and naming decisions approved       |
| 3. Migration creation          | Generate first migration from approved schema         | MySQL environment confirmed             |
| 4. Seed strategy               | Add controlled development seed data                  | Core models and constraints stable      |
| 5. Backend integration         | Connect services to Prisma Client                     | Database validation and migrations pass |

## Foundation Validation Checklist

- [x] Database folder has a clear ownership boundary
- [x] Prisma schema contains generator and datasource only
- [x] Documentation defines future implementation standards
- [x] Migration and seed folders are present without implementation
- [x] No business models, fields, relationships, indexes, constraints, or seed data are implemented
