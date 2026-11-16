-- Advance only the canonical schema marker for additive Retail VAT columns.
-- Retain the existing catalog/asset versions and pinned Sprint 12 catalog release.
UPDATE `system_canonical_state`
SET
  `schema_version` = 13,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `id` = 1
  AND `migration_epoch` = 2
  AND `schema_version` = 12;
