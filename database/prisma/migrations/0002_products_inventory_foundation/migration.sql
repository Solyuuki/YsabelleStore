-- Sprint 3 M3 products and inventory foundation migration for YsabelleStore.
-- Reviewable Prisma migration artifact for the current schema changes.

-- Add product status and preserve existing active/inactive state.
ALTER TABLE `products`
  ADD COLUMN `status` ENUM('ACTIVE', 'INACTIVE', 'DISCONTINUED') NOT NULL DEFAULT 'ACTIVE' AFTER `target_stock_level`;

UPDATE `products`
SET `status` = IF(`is_active`, 'ACTIVE', 'INACTIVE');

ALTER TABLE `products`
  DROP INDEX `idx_products_category_active`,
  ADD INDEX `idx_products_category_status`(`category_id`, `status`),
  ADD INDEX `idx_products_status_created`(`status`, `created_at`),
  DROP COLUMN `is_active`;

-- Create the current inventory state table.
CREATE TABLE `inventory` (
  `id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `quantity_on_hand` INT UNSIGNED NOT NULL DEFAULT 0,
  `last_stock_updated_at` DATETIME(3) NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uq_inventory_product`(`product_id`),
  INDEX `idx_inventory_quantity_on_hand`(`quantity_on_hand`),
  INDEX `idx_inventory_last_stock_updated_at`(`last_stock_updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `inventory` (
  `id`,
  `product_id`,
  `quantity_on_hand`,
  `last_stock_updated_at`,
  `version`,
  `created_at`,
  `updated_at`
)
SELECT
  `p`.`id`,
  `p`.`id`,
  COALESCE(SUM(`b`.`quantity_remaining`), 0),
  COALESCE(MAX(`b`.`updated_at`), MAX(`b`.`received_at`), CURRENT_TIMESTAMP(3)),
  0,
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
FROM `products` `p`
LEFT JOIN `inventory_batches` `b` ON `b`.`product_id` = `p`.`id`
GROUP BY `p`.`id`;

ALTER TABLE `inventory`
  ADD CONSTRAINT `inventory_product_id_fkey`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add inventory state and movement traceability.
ALTER TABLE `inventory_movements`
  ADD COLUMN `inventory_id` VARCHAR(191) NULL AFTER `product_id`,
  ADD COLUMN `quantity_before` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `quantity`,
  ADD COLUMN `quantity_after` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `quantity_before`,
  MODIFY `type` ENUM(
    'STOCK_IN',
    'SALE',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'RETURN_IN',
    'RETURN_OUT',
    'DAMAGE',
    'EXPIRED',
    'INITIAL_STOCK',
    'STOCK_OUT',
    'ADJUSTMENT',
    'RETURN',
    'DAMAGED'
  ) NOT NULL;

UPDATE `inventory_movements`
SET `inventory_id` = `product_id`
WHERE `inventory_id` IS NULL;

ALTER TABLE `inventory_movements`
  MODIFY `quantity_before` INT UNSIGNED NOT NULL,
  MODIFY `quantity_after` INT UNSIGNED NOT NULL;

ALTER TABLE `inventory_movements`
  MODIFY `inventory_id` VARCHAR(191) NOT NULL,
  ADD INDEX `idx_inventory_movements_inventory_created`(`inventory_id`, `created_at`),
  ADD INDEX `idx_inventory_movements_reference`(`reference_type`, `reference_id`);

ALTER TABLE `inventory_movements`
  ADD CONSTRAINT `inventory_movements_inventory_id_fkey`
  FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
