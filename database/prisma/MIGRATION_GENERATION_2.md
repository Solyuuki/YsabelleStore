# Prisma Migration Generation 2

This is the authoritative active Prisma lineage.

## Isolation

- `database/prisma/migrations/`: active migrations only.
- `database/prisma/migration-history-archive/generation-1/`: read-only legacy history.
- `database/prisma/state/migration-checksums.json`: frozen active migration checksums.
- `database/prisma/state/legacy-migration-blobs.json`: frozen Git-blob fingerprints for the Generation 1 archive.
- `database/prisma/state/canonical-state.json`: canonical schema/catalog/asset state.

## Security

```powershell
npm run migration:security
```

The migration guard is read-only and blocks duplicate creators, missing model coverage, legacy migrations re-entering the active lineage, Generation 1 archive fingerprint drift, frozen active-checksum drift, migration-provider drift, destructive forward DDL, and missing raw-SQL contracts. `npm run state:security` separately verifies the canonical schema/catalog hashes and every tracked product-image asset against the state manifest.

CI runs `npm run migration:upgrade:rehearsal` against a disposable MySQL database. The rehearsal first deploys only the frozen Generation 2 baseline, writes a sentinel row, then exposes the remaining active migrations and runs `prisma migrate deploy` again. It must preserve the sentinel, produce complete `_prisma_migrations` metadata, and match the canonical state marker. This proves both empty-database replay and previous-canonical-to-latest forward upgrade; `db push` is no longer accepted as migration-history proof.

## Future migrations

Never edit `0000_generation2_baseline` or the Generation 1 archive/fingerprint registry. Create an additive migration, review it, then register only a previously unseen checksum with:

```powershell
npm run migration:checksums:add
```

The checksum command refuses to rewrite an already-frozen migration. Forward migrations are non-destructive by default: `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, `RENAME TABLE`, and column drops are blocked by migration security. A future destructive cutover requires a separately designed and explicitly reviewed recovery procedure rather than bypassing the guard.

Canonical data and product-image changes are versioned separately from schema migrations and converge through the state-sync layer.

## Push freshness contract

`npm run state:push:guard` is wired into Husky pre-push. It refreshes the Sprint canonical ref and blocks stale branch bases, uncommitted canonical state, Generation 1 archive edits, frozen migration checksum rewrites, and schema/catalog/asset changes without the corresponding version bump. GitHub CI independently replays the migration lineage and verifies canonical state/assets.

## Commit preparation contract

Husky pre-commit runs `npm run state:prepare`. For staged canonical changes it refreshes the schema/catalog hashes, appends checksums only for new migrations, rebuilds the tracked product-image manifest from the Git index, bumps the affected canonical version once, and stages those generated metadata files. It refuses partially staged canonical files and refuses edits to already-frozen migrations.

## Local state marker

Migration `0001_system_canonical_state` adds a singleton database marker used by the pull-sync layer to distinguish a valid Generation 2 database from a legacy or drifted database. Schema, catalog, and asset versions are tracked independently.

Legacy database replacement remains fail-closed while `distributionReady` is false. The current blocker is the incomplete canonical product-image corpus; a populated legacy database must not be replaced with a state that would lose its working image assets.

## Pull convergence contract

Husky `post-merge` runs `npm run state:pull:sync` after a pull/merge that changes canonical database or product-image sources. It validates migration/state security, regenerates Prisma safely when schema files changed, classifies the local database, and automatically runs additive Generation 2 migrations for compatible databases.

Legacy and empty database replacement is intentionally fail-closed while `distributionReady` is false. This prevents an automatic pull from replacing a working database before the complete approved catalog-image corpus and canonical data distribution package are available.
