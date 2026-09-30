-- Add a customer shopping-profile contact number without changing protected auth phone identity.
-- Existing verified/registered phone values become the initial checkout default when available.

ALTER TABLE `customer_accounts`
  ADD COLUMN `default_contact_phone` VARCHAR(40) NULL AFTER `phone`;

UPDATE `customer_accounts`
SET `default_contact_phone` = `phone`
WHERE `default_contact_phone` IS NULL
  AND `phone` IS NOT NULL
  AND TRIM(`phone`) <> '';

UPDATE `system_canonical_state`
SET `schema_version` = 9,
    `release_id` = 'g2-s9-c5-a2'
WHERE `id` = 1;
