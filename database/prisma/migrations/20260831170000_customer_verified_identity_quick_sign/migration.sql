ALTER TABLE customer_accounts
  ADD COLUMN email_verified_at DATETIME(3) NULL,
  ADD COLUMN phone_verified_at DATETIME(3) NULL;

CREATE TABLE customer_email_registration_challenges (
  id VARCHAR(191) NOT NULL,
  registration_intent_hash VARCHAR(64) NOT NULL,
  email_normalized VARCHAR(191) NOT NULL,
  otp_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  failed_attempts INTEGER UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_customer_email_registration_intent_created (registration_intent_hash, created_at),
  INDEX idx_customer_email_registration_email_created (email_normalized, created_at),
  INDEX idx_customer_email_registration_expires (expires_at),
  INDEX idx_customer_email_registration_consumed (consumed_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE customer_email_auth_challenges (
  id VARCHAR(191) NOT NULL,
  customer_account_id VARCHAR(191) NULL,
  email_normalized VARCHAR(191) NOT NULL,
  otp_hash VARCHAR(64) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  failed_attempts INTEGER UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX idx_customer_email_auth_email_created (email_normalized, created_at),
  INDEX idx_customer_email_auth_customer (customer_account_id),
  INDEX idx_customer_email_auth_expires (expires_at),
  INDEX idx_customer_email_auth_consumed (consumed_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
