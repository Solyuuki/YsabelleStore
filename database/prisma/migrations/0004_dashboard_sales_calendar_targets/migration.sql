-- Add durable per-business-day sales targets for the dashboard sales calendar.

CREATE TABLE `daily_sales_targets` (
  `id` VARCHAR(191) NOT NULL,
  `business_date` DATE NOT NULL,
  `target_amount` DECIMAL(12, 2) NOT NULL,
  `created_by_id` VARCHAR(191) NULL,
  `updated_by_id` VARCHAR(191) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uq_daily_sales_targets_business_date`(`business_date`),
  INDEX `idx_daily_sales_targets_created_by`(`created_by_id`),
  INDEX `idx_daily_sales_targets_updated_by`(`updated_by_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `daily_sales_targets`
  ADD CONSTRAINT `fk_daily_sales_targets_created_by`
  FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_daily_sales_targets_updated_by`
  FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `system_canonical_state`
SET `schema_version` = 5,
    `release_id` = 'g2-s5-c5-a2'
WHERE `id` = 1;
