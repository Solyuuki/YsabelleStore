CREATE TABLE `customer_accounts` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(40) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uq_customer_accounts_email`(`email`),
  INDEX `idx_customer_accounts_status`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `customer_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `customer_account_id` VARCHAR(191) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `last_used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `uq_customer_sessions_token_hash`(`token_hash`),
  INDEX `idx_customer_sessions_customer`(`customer_account_id`),
  INDEX `idx_customer_sessions_expires`(`expires_at`),
  INDEX `idx_customer_sessions_revoked`(`revoked_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `customer_sessions_customer_account_fkey`
    FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_orders`
  ADD COLUMN `customer_account_id` VARCHAR(191) NULL,
  ADD INDEX `idx_customer_orders_customer_created`(`customer_account_id`, `created_at`),
  ADD CONSTRAINT `customer_orders_customer_account_fkey`
    FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
