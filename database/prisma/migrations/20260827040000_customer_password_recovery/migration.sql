CREATE TABLE `customer_password_reset_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `customer_account_id` VARCHAR(191) NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `uq_customer_password_reset_tokens_token_hash`(`token_hash`),
  INDEX `idx_customer_password_reset_tokens_customer`(`customer_account_id`),
  INDEX `idx_customer_password_reset_tokens_expires`(`expires_at`),
  INDEX `idx_customer_password_reset_tokens_used`(`used_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `customer_password_reset_tokens`
  ADD CONSTRAINT `customer_password_reset_tokens_customer_account_id_fkey`
  FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
