-- Owner sign-off on target-stock policies is a new explicit authorization.
-- All existing product targets remain unapproved until reviewed by Owner.
ALTER TABLE `products`
  ADD COLUMN `restock_target_approved_level` INTEGER UNSIGNED NULL,
  ADD COLUMN `restock_target_approved_at` DATETIME(3) NULL,
  ADD COLUMN `restock_target_approved_by_id` VARCHAR(191) NULL;
