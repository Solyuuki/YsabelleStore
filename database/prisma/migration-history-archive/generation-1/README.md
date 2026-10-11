# Migration Generation 1 archive

Status: **read-only historical/recovery evidence**.

These migrations were the active Prisma lineage before the Sprint 11 Migration Generation 2 cutover. They live outside `database/prisma/migrations/` so Prisma never replays the known-broken legacy chain.

- Never point Prisma migration commands at this archive.
- Never edit archived `migration.sql` files in place.
- Use Git history plus this archive only for forensic/recovery comparison.
- The active lineage begins at `database/prisma/migrations/0000_generation2_baseline/migration.sql`.
- Existing Generation 1 development DBs are legacy states and must converge through the Generation 2 recovery/sync workflow rather than falsified migration metadata.

Cutover source commit: `265fb7e9b5f6ac162f0b49ea75794ce6659f0e8f`.
