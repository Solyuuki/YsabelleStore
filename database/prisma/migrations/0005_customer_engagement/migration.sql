-- Add verified customer reviews, persistent favorites, and customer moderation states.

ALTER TABLE `customer_accounts`
  MODIFY `status` ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'BANNED')
  NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE `product_reviews`
  ADD COLUMN `customer_account_id` VARCHAR(191) NULL,
  ADD COLUMN `verified_order_id` VARCHAR(191) NULL,
  ADD COLUMN `status` ENUM('VISIBLE', 'HIDDEN', 'REMOVED') NOT NULL DEFAULT 'VISIBLE',
  ADD COLUMN `moderated_by_id` VARCHAR(191) NULL,
  ADD COLUMN `moderation_reason` VARCHAR(500) NULL,
  ADD COLUMN `moderated_at` DATETIME(3) NULL,
  ADD UNIQUE INDEX `uq_product_reviews_customer_product`(`customer_account_id`, `product_id`),
  ADD INDEX `idx_product_reviews_product_status_created`(`product_id`, `status`, `created_at`),
  ADD INDEX `idx_product_reviews_product_status_rating_created`(`product_id`, `status`, `rating`, `created_at`),
  ADD INDEX `idx_product_reviews_customer_created`(`customer_account_id`, `created_at`),
  ADD INDEX `idx_product_reviews_verified_order`(`verified_order_id`),
  ADD INDEX `idx_product_reviews_moderated_by`(`moderated_by_id`);

ALTER TABLE `product_reviews`
  ADD CONSTRAINT `fk_product_reviews_customer_account`
  FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_product_reviews_verified_order`
  FOREIGN KEY (`verified_order_id`) REFERENCES `customer_orders`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_product_reviews_moderated_by`
  FOREIGN KEY (`moderated_by_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `customer_favorites` (
  `id` VARCHAR(191) NOT NULL,
  `customer_account_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `uq_customer_favorites_customer_product`(`customer_account_id`, `product_id`),
  INDEX `idx_customer_favorites_customer_created`(`customer_account_id`, `created_at`),
  INDEX `idx_customer_favorites_product_created`(`product_id`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_favorites`
  ADD CONSTRAINT `fk_customer_favorites_customer_account`
  FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_customer_favorites_product`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE `system_canonical_state`
SET `schema_version` = 6,
    `release_id` = 'g2-s6-c5-a2'
WHERE `id` = 1;
