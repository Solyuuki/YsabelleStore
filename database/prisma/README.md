# Prisma Foundation

The Prisma folder contains the official Prisma entry point for the future YsabelleStore database schema.

## Current Contents

| File            | Purpose                                                                                  | Phase Rule                        |
| --------------- | ---------------------------------------------------------------------------------------- | --------------------------------- |
| `schema.prisma` | Declares the Prisma Client generator, MySQL datasource, and future architecture sections | No models in the foundation phase |

## Prisma Role

| Responsibility    | Description                                                                        |
| ----------------- | ---------------------------------------------------------------------------------- |
| Schema authority  | Future models will be declared here after ERD approval                             |
| Database mapping  | Prisma names will remain application-friendly while database names stay consistent |
| Validation        | `prisma validate` confirms schema syntax before implementation continues           |
| Client generation | Future backend code will use generated Prisma Client after schema implementation   |

## Current Guardrails

- Keep `schema.prisma` model-free.
- Keep credentials out of the schema.
- Use `env("DATABASE_URL")` for the datasource URL.
- Do not run `prisma generate` during foundation setup.
- Do not create or edit migrations during foundation setup.

## Future Model Section Order

| Order | Section        | Reason                                                     |
| ----- | -------------- | ---------------------------------------------------------- |
| 1     | User           | Supports future ownership and audit workflows              |
| 2     | Product        | Anchors inventory, sales, forecasts, and recommendations   |
| 3     | Inventory      | Represents stock state after product structure is approved |
| 4     | BatchInventory | Adds expiration-aware stock details                        |
| 5     | Sales          | Provides historical demand input                           |
| 6     | Forecast       | Stores future SARIMA demand outputs                        |
| 7     | Recommendation | Stores future inventory guidance outputs                   |
