-- Advance the canonical schema marker after the additive stock reservation,
-- POS idempotency, and Owner restock authorization migrations.
-- Preserve the database's actual catalog and asset versions.
UPDATE `system_canonical_state`
SET
  `schema_version` = 12,
  `release_id` = CONCAT('g2-s12-c', `catalog_version`, '-a', `asset_version`),
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `id` = 1
  AND `migration_epoch` = 2
  AND `schema_version` = 11;
