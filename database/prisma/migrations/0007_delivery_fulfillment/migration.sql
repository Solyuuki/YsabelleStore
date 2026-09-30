-- Convert the storefront fulfillment contract from pickup/COP to delivery/COD.
-- Historical migrations remain immutable; this migration moves existing runtime rows forward.

ALTER TABLE `customer_orders`
  MODIFY `fulfillment_method` ENUM('STORE_PICKUP', 'DELIVERY') NOT NULL DEFAULT 'DELIVERY',
  MODIFY `payment_method` ENUM('CASH_ON_PICKUP', 'CASH_ON_DELIVERY', 'PAYMONGO') NOT NULL DEFAULT 'CASH_ON_DELIVERY',
  MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'PROCESSING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

UPDATE `customer_orders`
SET `payment_status` = 'PAID',
    `paid_at` = COALESCE(`paid_at`, `updated_at`)
WHERE `payment_method` = 'CASH_ON_PICKUP'
  AND `status` = 'COMPLETED'
  AND `payment_status` = 'PENDING';

ALTER TABLE `customer_orders`
  ADD COLUMN `delivery_ticket_number` VARCHAR(96) NULL AFTER `order_number`,
  ADD COLUMN `delivery_status` ENUM('ORDER_PLACED', 'PREPARING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED') NOT NULL DEFAULT 'ORDER_PLACED' AFTER `payment_status`,
  ADD COLUMN `courier_provider` VARCHAR(80) NULL AFTER `delivery_status`,
  ADD COLUMN `courier_reference` VARCHAR(120) NULL AFTER `courier_provider`,
  ADD COLUMN `delivery_notes` VARCHAR(255) NULL AFTER `courier_reference`,
  ADD COLUMN `dispatched_at` DATETIME(3) NULL AFTER `delivery_notes`,
  ADD COLUMN `delivered_at` DATETIME(3) NULL AFTER `dispatched_at`,
  ADD COLUMN `customer_confirmed_at` DATETIME(3) NULL AFTER `delivered_at`,
  ADD COLUMN `cod_collected_at` DATETIME(3) NULL AFTER `customer_confirmed_at`,
  ADD COLUMN `cod_collected_by_id` VARCHAR(191) NULL AFTER `cod_collected_at`,
  ADD COLUMN `sale_id` VARCHAR(191) NULL AFTER `cod_collected_by_id`;

UPDATE `customer_orders`
SET `delivery_ticket_number` = CONCAT('DEL-', `order_number`),
    `delivery_status` = CASE
      WHEN `status` = 'COMPLETED' THEN 'DELIVERED'
      WHEN `status` = 'CANCELLED' THEN 'CANCELLED'
      WHEN `status` = 'READY_FOR_PICKUP' THEN 'READY_FOR_DELIVERY'
      WHEN `status` = 'CONFIRMED' THEN 'PREPARING'
      ELSE 'ORDER_PLACED'
    END,
    `delivered_at` = CASE WHEN `status` = 'COMPLETED' THEN `updated_at` ELSE NULL END,
    `fulfillment_method` = 'DELIVERY',
    `payment_method` = CASE
      WHEN `payment_method` = 'CASH_ON_PICKUP' THEN 'CASH_ON_DELIVERY'
      ELSE `payment_method`
    END;

UPDATE `customer_orders`
SET `status` = 'PROCESSING'
WHERE `status` = 'READY_FOR_PICKUP';

ALTER TABLE `customer_orders`
  MODIFY `delivery_ticket_number` VARCHAR(96) NOT NULL,
  MODIFY `fulfillment_method` ENUM('DELIVERY') NOT NULL DEFAULT 'DELIVERY',
  MODIFY `payment_method` ENUM('CASH_ON_DELIVERY', 'PAYMONGO') NOT NULL DEFAULT 'CASH_ON_DELIVERY',
  MODIFY `status` ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING';

CREATE UNIQUE INDEX `uq_customer_orders_delivery_ticket`
  ON `customer_orders`(`delivery_ticket_number`);

CREATE UNIQUE INDEX `uq_customer_orders_sale`
  ON `customer_orders`(`sale_id`);

CREATE INDEX `idx_customer_orders_delivery_status_updated`
  ON `customer_orders`(`delivery_status`, `updated_at`);

CREATE INDEX `idx_customer_orders_cod_collected_by`
  ON `customer_orders`(`cod_collected_by_id`);

ALTER TABLE `customer_orders`
  ADD CONSTRAINT `fk_customer_orders_cod_collected_by`
    FOREIGN KEY (`cod_collected_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_customer_orders_sale`
    FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE `customer_delivery_events` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `status` ENUM('ORDER_PLACED', 'PREPARING', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED') NOT NULL,
  `actor_type` ENUM('SYSTEM', 'STAFF', 'CUSTOMER') NOT NULL,
  `actor_user_id` VARCHAR(191) NULL,
  `actor_customer_account_id` VARCHAR(191) NULL,
  `note` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `idx_customer_delivery_events_order_created`(`order_id`, `created_at`),
  INDEX `idx_customer_delivery_events_user`(`actor_user_id`),
  INDEX `idx_customer_delivery_events_customer`(`actor_customer_account_id`),

  CONSTRAINT `fk_customer_delivery_events_order`
    FOREIGN KEY (`order_id`) REFERENCES `customer_orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_delivery_events_user`
    FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_delivery_events_customer`
    FOREIGN KEY (`actor_customer_account_id`) REFERENCES `customer_accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `customer_delivery_events` (
  `id`,
  `order_id`,
  `status`,
  `actor_type`,
  `note`,
  `created_at`
)
SELECT
  CONCAT('migrated-', `id`),
  `id`,
  `delivery_status`,
  'SYSTEM',
  'Delivery tracking initialized during COD migration.',
  `updated_at`
FROM `customer_orders`;

UPDATE `system_canonical_state`
SET `schema_version` = 8,
    `release_id` = 'g2-s8-c5-a2'
WHERE `id` = 1;
