ALTER TABLE `customer_orders`
  MODIFY `payment_method` ENUM('CASH_ON_PICKUP', 'PAYMONGO') NOT NULL DEFAULT 'CASH_ON_PICKUP',
  ADD COLUMN `payment_status` ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING' AFTER `payment_method`,
  ADD COLUMN `paymongo_checkout_session_id` VARCHAR(191) NULL AFTER `payment_status`,
  ADD COLUMN `paymongo_checkout_url` VARCHAR(2048) NULL AFTER `paymongo_checkout_session_id`,
  ADD COLUMN `paymongo_payment_intent_id` VARCHAR(191) NULL AFTER `paymongo_checkout_url`,
  ADD COLUMN `paymongo_payment_id` VARCHAR(191) NULL AFTER `paymongo_payment_intent_id`,
  ADD COLUMN `paid_at` DATETIME(3) NULL AFTER `paymongo_payment_id`;

CREATE UNIQUE INDEX `uq_customer_orders_paymongo_checkout_session`
  ON `customer_orders`(`paymongo_checkout_session_id`);

CREATE UNIQUE INDEX `uq_customer_orders_paymongo_payment`
  ON `customer_orders`(`paymongo_payment_id`);

CREATE INDEX `idx_customer_orders_payment_status_created`
  ON `customer_orders`(`payment_status`, `created_at`);

UPDATE `system_canonical_state`
SET `schema_version` = 3,
    `release_id` = 'g2-s3-c3-a2'
WHERE `id` = 1;
