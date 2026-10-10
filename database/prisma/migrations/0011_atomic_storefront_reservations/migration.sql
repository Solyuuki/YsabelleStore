-- Additive only. Do not execute against shared/live DB until a preflight
-- verifies all active customer orders, stock invariants, and rollback plan.
-- Legacy customer orders deliberately remain without backfilled reservations.
ALTER TABLE `customer_orders`
  ADD COLUMN `checkout_request_key` VARCHAR(191) NULL,
  ADD UNIQUE INDEX `uq_customer_order_checkout_key` (`checkout_request_key`);

CREATE TABLE `inventory_reservations` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `quantity` INTEGER UNSIGNED NOT NULL,
  `status` ENUM('ACTIVE', 'CONSUMED', 'RELEASED') NOT NULL DEFAULT 'ACTIVE',
  `consumed_at` DATETIME(3) NULL,
  `released_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uq_inventory_reservations_order_product` (`order_id`, `product_id`),
  INDEX `idx_inventory_reservations_product_status` (`product_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `inventory_reservations`
  ADD CONSTRAINT `inventory_reservations_order_id_fkey`
    FOREIGN KEY (`order_id`) REFERENCES `customer_orders`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `inventory_reservations_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
