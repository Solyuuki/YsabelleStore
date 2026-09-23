# Canonical Development Distribution

The Generation 2 canonical development state is split into three independently versioned domains:

1. Prisma schema migrations.
2. Canonical catalog/master data.
3. Product image source assets.

The active production-catalog release is `g2-s2-c3-a2`.

## Canonical scope

The release contains the exact reviewed production cohort of 50 SARIMA products and their approved product-master fields. Canonical catalog synchronization may update master data, but it must not publish or overwrite runtime/private records.

Production/runtime-owned data remains excluded from canonical publication. For local development and team QA only, pull convergence now applies a deterministic team fixture after the canonical catalog is materialized: the documented owner/staff test accounts plus a repeatable verified-50 inventory/batch baseline. This fixture is local-only, refuses production/non-local database targets, and exists so a teammate can `git pull` and reproduce the same login and storefront stock baseline without committing real customer, session, order, or production data.

## Product images

All 50 exact source images are stored under `database/canonical/product-images/sources/` and pinned by Git blob identity in the release manifest. The source bytes came from the reviewed Drive identities already used by the catalog-image reconciliation pipeline.

The persistent backend catalog-image variants are materialized from these pinned sources by the pull convergence layer. Source files are canonical; developer-local image caches are not.

## Release security

Run:

```powershell
npm run release:security
```

The guard verifies the 50-product identity set, runtime-data exclusions, unique barcodes and source identities, release/state version agreement, exact source-image byte identity, and image-asset provenance.

Automatic destructive legacy replacement remains disabled until Phase 4 activates the guarded pull materializer and recovery path.


## Development team parity

On a local development database, `npm run state:pull:sync` now converges the synthetic team test state after schema/catalog/image convergence. The expected internal logins are `owner@ysabellestore.local` / `OwnerPass#2026` and `staff@ysabellestore.local` / `StaffPass#2026`. All 50 canonical products receive the same deterministic QA stock quantities and one active team batch, while older local batches are left as history but neutralized to zero remaining stock. Run `npm run team-state:verify` to verify the local parity contract.
