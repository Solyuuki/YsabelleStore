# Prisma Migration Generation 2

This is the authoritative active Prisma lineage.

## Isolation

- `database/prisma/migrations/`: active migrations only.
- `database/prisma/migration-history-archive/generation-1/`: read-only legacy history.
- `database/prisma/state/migration-checksums.json`: frozen active migration checksums.
- `database/prisma/state/canonical-state.json`: canonical schema/catalog/asset state.

## Security

```powershell
npm run migration:security
```

The migration guard is read-only and blocks duplicate creators, missing model coverage, legacy migrations re-entering the active lineage, frozen checksum drift, and missing raw-SQL contracts. `npm run state:security` separately verifies the canonical schema/catalog hashes and every tracked product-image asset against the state manifest.

CI uses `prisma migrate deploy` on a disposable MySQL database. A green build therefore proves the active lineage replays; `db push` is no longer accepted as migration-history proof.

## Future migrations

Never edit `0000_generation2_baseline`. Create an additive migration, review it, then register only a previously unseen checksum with:

```powershell
npm run migration:checksums:add
```

The checksum command refuses to rewrite an already-frozen migration.

Canonical data and product-image changes are versioned separately from schema migrations and converge through the state-sync layer.

## Push freshness contract

`npm run state:push:guard` is wired into Husky pre-push. It refreshes the Sprint canonical ref and blocks stale branch bases, uncommitted canonical state, Generation 1 archive edits, frozen migration checksum rewrites, and schema/catalog/asset changes without the corresponding version bump. GitHub CI independently replays the migration lineage and verifies canonical state/assets.

## Commit preparation contract

Husky pre-commit runs `npm run state:prepare`. For staged canonical changes it refreshes the schema/catalog hashes, appends checksums only for new migrations, rebuilds the tracked product-image manifest from the Git index, bumps the affected canonical version once, and stages those generated metadata files. It refuses partially staged canonical files and refuses edits to already-frozen migrations.
