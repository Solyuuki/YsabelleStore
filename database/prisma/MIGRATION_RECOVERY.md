# Prisma migration recovery — migration safety gate

Status: **BLOCKED** for migration writes. This is an operator runbook, not a migration or a database backup.

## Why this is blocked

The local `ysabelle_store` database was observed with 42 application tables and no `_prisma_migrations` tracking table. Prisma reports all 22 repository migrations as pending, although the application tables largely exist. The exported DDL contains two address tables that exist in migration `20260916230000_customer_saved_contact_address` but are absent from `schema.prisma`, plus two mobile-auth tables modeled by Prisma but absent from the repository's 22 migration SQL files. `20260707055138_sync_trusted_device_sessions` duplicates table creation from `0001_sprint_1_database_foundation`. A literal replay can therefore fail on a fresh database; do not silently rewrite historical migration files since deployed environments may have checksums for them.

The `20260818170000_add_product_reviews` SQL specifies a rating range CHECK, but the supplied schema export did not contain that constraint. Four data-integrity counts from the owner: 50 products with barcodes, zero mismatched barcode identity rows, zero products without inventory, and zero out-of-range review ratings. These _limited counts_ do not prove all historical DML ran, nor do they establish constraint enforcement. The four-auth migration doctor passed but covers only those four contracts.

## Repository-only static check

Run from the repository root:

```powershell
node scripts/prisma-migration-readiness.mjs
node --test scripts/test/prisma-migration-readiness.test.mjs
```

The first command **intentionally returns a nonzero status** while duplicate table creations, datamodel gaps or migration gaps remain. It only reads local source files; it never reads `.env`, connects to a database, creates migration metadata or modifies source. A clean source check is _not_ permission to run a migration: it cannot inspect live MySQL, applied checksums, data backfills or restore reliability.

## Approved sequence before any database or PayMongo changes

1. Preserve the existing SQL and full backup, verify archive integrity, and test full restore in a _distinct disposable database_ under explicit operator approval. Do not import the schema-only ZIP as a backup.
2. Choose and review one canonical, fresh-install migration lineage, with an explicit rollout plan for environments that may already have existing `_prisma_migrations` records. Preserve old SQL/checksums; do not patch a potentially applied migration in place or blindly mark all 22 migrations applied. The duplicate-foundation conflict must be resolved in that coordinated plan, not by `CREATE TABLE IF NOT EXISTS` masking drift.
3. Model the two existing address tables exactly in `schema.prisma` (`@map`, one-to-one FK ownership, defaults and `ON UPDATE CURRENT_TIMESTAMP(3)` handling), then run `prisma validate` and a **read-only** `migrate diff --from-schema-datasource ... --to-schema-datamodel ...` and inspect its direction carefully. No generated destructive SQL should be executed. Also make fresh-install migration coverage explicit for the two existing mobile-auth tables.
4. Review the actual MySQL version and metadata for the absent `product_reviews` CHECK constraint. Design a separate additive change only after validating existing ratings and testing on the isolated database; Prisma schema alone does not represent all SQL CHECK semantics.
5. Verify data-only effects of `0002_products_inventory_foundation` (inventory backfill and status transfer) and `20260910170000_product_barcode_identity` (barcode backfill) with purpose-built read-only queries and restore/replay tests. Zero current anomalies alone cannot attest historical execution.
6. Once schema, fresh replay, data invariants, restore test, and environment-specific history/checksum plan pass independent review, request separate approval for live migration metadata / DDL operations. _Only then_ begin PayMongo test-only, card-only Hosted Checkout changes.

## Prohibited until separately approved

- `prisma migrate dev`, `prisma migrate deploy`, `prisma migrate reset`, `prisma db push`, `npm run prisma:sync:dev` against the working database.
- `npm run db:migration-history:repair`, `prisma migrate resolve --applied` (including marking only four migrations without the complete sequencing plan), or any generated DROP statements.
- Committing uploaded data-bearing backup archives, DB credentials, customer rows, `.env`, or PayMongo keys.

Repository-side guardrails are not equivalent to a validated clean baseline. Do not describe source findings as a completed repair.
