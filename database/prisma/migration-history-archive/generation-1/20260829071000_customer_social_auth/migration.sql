-- Sprint 9 Phase 6: customer Google/Facebook authentication persistence.
ALTER TABLE customer_accounts MODIFY password_hash VARCHAR(255) NULL;

CREATE TABLE customer_social_identities (
  id VARCHAR(191) NOT NULL,
  customer_account_id VARCHAR(191) NOT NULL,
  provider ENUM('GOOGLE','FACEBOOK') NOT NULL,
  provider_subject VARCHAR(191) NOT NULL,
  provider_email VARCHAR(191) NULL,
  provider_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_social_identities_provider_subject (provider, provider_subject),
  UNIQUE KEY uq_customer_social_identities_customer_provider (customer_account_id, provider),
  KEY idx_customer_social_identities_email (provider_email),
  CONSTRAINT fk_customer_social_identities_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE customer_social_link_intents (
  id VARCHAR(191) NOT NULL,
  customer_account_id VARCHAR(191) NOT NULL,
  token_hash VARCHAR(64) NOT NULL,
  provider ENUM('GOOGLE','FACEBOOK') NOT NULL,
  provider_subject VARCHAR(191) NOT NULL,
  provider_email VARCHAR(191) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_social_link_intents_token_hash (token_hash),
  KEY idx_customer_social_link_intents_customer (customer_account_id),
  KEY idx_customer_social_link_intents_expires (expires_at),
  KEY idx_customer_social_link_intents_used (used_at),
  CONSTRAINT fk_customer_social_link_intents_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE customer_oauth_transactions (
  id VARCHAR(191) NOT NULL,
  provider ENUM('GOOGLE','FACEBOOK') NOT NULL,
  transport ENUM('WEB','ELECTRON') NOT NULL,
  state_hash VARCHAR(64) NOT NULL,
  browser_binding_hash VARCHAR(64) NULL,
  pkce_verifier_ciphertext TEXT NOT NULL,
  nonce_ciphertext TEXT NULL,
  nonce_hash VARCHAR(64) NULL,
  electron_challenge VARCHAR(86) NULL,
  return_path VARCHAR(255) NOT NULL DEFAULT '/',
  expires_at DATETIME(3) NOT NULL,
  consumed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_oauth_transactions_state_hash (state_hash),
  KEY idx_customer_oauth_transactions_expires (expires_at),
  KEY idx_customer_oauth_transactions_consumed (consumed_at)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE customer_oauth_handoffs (
  id VARCHAR(191) NOT NULL,
  customer_account_id VARCHAR(191) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  verifier_challenge VARCHAR(86) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  used_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_customer_oauth_handoffs_code_hash (code_hash),
  KEY idx_customer_oauth_handoffs_customer (customer_account_id),
  KEY idx_customer_oauth_handoffs_expires (expires_at),
  KEY idx_customer_oauth_handoffs_used (used_at),
  CONSTRAINT fk_customer_oauth_handoffs_customer FOREIGN KEY (customer_account_id) REFERENCES customer_accounts(id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
