-- Stores test-only checkout attempts separately from pickup fulfillment.
-- Do not insert live PayMongo transactions into this table.
CREATE TABLE `customer_paymongo_checkouts` (
  `id` VARCHAR(191) NOT NULL,
  `order_id` VARCHAR(191) NOT NULL,
  `order_number` VARCHAR(80) NOT NULL,
  `access_token_hash` VARCHAR(64) NOT NULL,
  `session_id` VARCHAR(191) NULL,
  `checkout_url` TEXT NULL,
  `payment_id` VARCHAR(191) NULL,
  `status` ENUM('CREATING','AWAITING_PAYMENT','PAID','FAILED') NOT NULL DEFAULT 'CREATING',
  `amount_centavos` BIGINT UNSIGNED NOT NULL,
  `paid_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uq_customer_paymongo_order` (`order_id`),
  UNIQUE INDEX `uq_customer_paymongo_order_number` (`order_number`),
  UNIQUE INDEX `uq_customer_paymongo_session` (`session_id`),
  UNIQUE INDEX `uq_customer_paymongo_payment` (`payment_id`),
  INDEX `idx_customer_paymongo_status_created` (`status`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
