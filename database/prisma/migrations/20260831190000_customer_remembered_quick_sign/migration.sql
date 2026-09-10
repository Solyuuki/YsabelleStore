CREATE TABLE `customer_remembered_auth` (
  `id` VARCHAR(191) NOT NULL,
  `browser_token_hash` VARCHAR(64) NOT NULL,
  `customer_account_id` VARCHAR(191) NOT NULL,
  `auth_method` ENUM('EMAIL', 'MOBILE') NOT NULL,
  `trusted_until` DATETIME(3) NOT NULL,
  `last_used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `uq_customer_remembered_auth_browser_customer`(`browser_token_hash`, `customer_account_id`),
  INDEX `idx_customer_remembered_auth_browser`(`browser_token_hash`),
  INDEX `idx_customer_remembered_auth_customer`(`customer_account_id`),
  INDEX `idx_customer_remembered_auth_trusted_until`(`trusted_until`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_remembered_auth`
  ADD CONSTRAINT `customer_remembered_auth_customer_account_id_fkey`
  FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
