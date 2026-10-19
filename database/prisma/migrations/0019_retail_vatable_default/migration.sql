-- Apply owner-selected regular VAT treatment to unclassified products.
-- Preserve explicit VAT_EXEMPT/ZERO_RATED assignments and historical sales.
ALTER TABLE `products`
  ALTER COLUMN `vat_category` SET DEFAULT 'VATABLE';

UPDATE `products`
SET `vat_category` = 'VATABLE'
WHERE `vat_category` = 'UNCLASSIFIED';

UPDATE `system_canonical_state`
SET
  `schema_version` = 14,
  `updated_at` = CURRENT_TIMESTAMP(3)
WHERE `id` = 1
  AND `migration_epoch` = 2
  AND `schema_version` = 13;
