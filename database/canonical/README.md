# Canonical Development Distribution

The Generation 2 canonical development state is split into three independently versioned domains:

1. Prisma schema migrations.
2. Canonical catalog/master data.
3. Product image source assets.

The active production-catalog release is `g2-s2-c2-a2`.

## Canonical scope

The release contains the exact reviewed production cohort of 50 SARIMA products and their approved product-master fields. Canonical catalog synchronization may update master data, but it must not publish or overwrite runtime/private records.

Runtime-owned data includes customer accounts, sessions, carts, orders, sales, inventory, inventory batches, and inventory movements. Those records are excluded by contract.

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
