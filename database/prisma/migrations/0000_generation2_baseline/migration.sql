-- YSABELLE STORE Migration Generation 2 canonical baseline
-- Generated from database/prisma/schema.prisma at Sprint 11 cutover.
-- Raw-SQL contracts intentionally retained: product review rating CHECK and saved-address ON UPDATE.

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('OWNER', 'STAFF') NOT NULL DEFAULT 'STAFF',
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_users_email`(`email`),
    INDEX `idx_users_role_status`(`role`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trusted_devices` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `device_label` VARCHAR(120) NULL,
    `user_agent` VARCHAR(255) NULL,
    `last_used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_trusted_devices_token_hash`(`token_hash`),
    INDEX `idx_trusted_devices_user_id`(`user_id`),
    INDEX `idx_trusted_devices_expires_at`(`expires_at`),
    INDEX `idx_trusted_devices_revoked_at`(`revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `username` VARCHAR(30) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(40) NULL,
    `phone_normalized` VARCHAR(16) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `phone_verified_at` DATETIME(3) NULL,
    `password_hash` VARCHAR(255) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_customer_accounts_username`(`username`),
    UNIQUE INDEX `uq_customer_accounts_email`(`email`),
    UNIQUE INDEX `uq_customer_accounts_phone_normalized`(`phone_normalized`),
    INDEX `idx_customer_accounts_status`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_remembered_auth` (
    `id` VARCHAR(191) NOT NULL,
    `browser_token_hash` VARCHAR(64) NOT NULL,
    `customer_account_id` VARCHAR(191) NOT NULL,
    `auth_method` ENUM('EMAIL', 'MOBILE') NOT NULL,
    `trusted_until` DATETIME(3) NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_customer_remembered_auth_browser`(`browser_token_hash`),
    INDEX `idx_customer_remembered_auth_customer`(`customer_account_id`),
    INDEX `idx_customer_remembered_auth_trusted_until`(`trusted_until`),
    UNIQUE INDEX `uq_customer_remembered_auth_browser_customer`(`browser_token_hash`, `customer_account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_mobile_auth_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `customer_account_id` VARCHAR(191) NULL,
    `phone_normalized` VARCHAR(16) NOT NULL,
    `otp_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `failed_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_customer_mobile_auth_challenges_phone_created`(`phone_normalized`, `created_at`),
    INDEX `idx_customer_mobile_auth_challenges_customer`(`customer_account_id`),
    INDEX `idx_customer_mobile_auth_challenges_expires`(`expires_at`),
    INDEX `idx_customer_mobile_auth_challenges_consumed`(`consumed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_mobile_registration_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `registration_intent_hash` VARCHAR(64) NOT NULL,
    `phone_normalized` VARCHAR(16) NOT NULL,
    `otp_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `failed_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_customer_mobile_registration_intent_created`(`registration_intent_hash`, `created_at`),
    INDEX `idx_customer_mobile_registration_phone_created`(`phone_normalized`, `created_at`),
    INDEX `idx_customer_mobile_registration_expires`(`expires_at`),
    INDEX `idx_customer_mobile_registration_consumed`(`consumed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_email_registration_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `registration_intent_hash` VARCHAR(64) NOT NULL,
    `email_normalized` VARCHAR(191) NOT NULL,
    `otp_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `failed_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_customer_email_registration_intent_created`(`registration_intent_hash`, `created_at`),
    INDEX `idx_customer_email_registration_email_created`(`email_normalized`, `created_at`),
    INDEX `idx_customer_email_registration_expires`(`expires_at`),
    INDEX `idx_customer_email_registration_consumed`(`consumed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_email_auth_challenges` (
    `id` VARCHAR(191) NOT NULL,
    `customer_account_id` VARCHAR(191) NULL,
    `email_normalized` VARCHAR(191) NOT NULL,
    `otp_hash` VARCHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `failed_attempts` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_customer_email_auth_email_created`(`email_normalized`, `created_at`),
    INDEX `idx_customer_email_auth_customer`(`customer_account_id`),
    INDEX `idx_customer_email_auth_expires`(`expires_at`),
    INDEX `idx_customer_email_auth_consumed`(`consumed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_social_identities` (
    `id` VARCHAR(191) NOT NULL,
    `customer_account_id` VARCHAR(191) NOT NULL,
    `provider` ENUM('GOOGLE', 'FACEBOOK') NOT NULL,
    `provider_subject` VARCHAR(191) NOT NULL,
    `provider_email` VARCHAR(191) NULL,
    `provider_email_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_customer_social_identities_email`(`provider_email`),
    UNIQUE INDEX `uq_customer_social_identities_provider_subject`(`provider`, `provider_subject`),
    UNIQUE INDEX `uq_customer_social_identities_customer_provider`(`customer_account_id`, `provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_social_link_intents` (
    `id` VARCHAR(191) NOT NULL,
    `customer_account_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(64) NOT NULL,
    `provider` ENUM('GOOGLE', 'FACEBOOK') NOT NULL,
    `provider_subject` VARCHAR(191) NOT NULL,
    `provider_email` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_customer_social_link_intents_token_hash`(`token_hash`),
    INDEX `idx_customer_social_link_intents_customer`(`customer_account_id`),
    INDEX `idx_customer_social_link_intents_expires`(`expires_at`),
    INDEX `idx_customer_social_link_intents_used`(`used_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_oauth_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `provider` ENUM('GOOGLE', 'FACEBOOK') NOT NULL,
    `transport` ENUM('WEB', 'ELECTRON') NOT NULL,
    `state_hash` VARCHAR(64) NOT NULL,
    `browser_binding_hash` VARCHAR(64) NULL,
    `pkce_verifier_ciphertext` TEXT NOT NULL,
    `nonce_ciphertext` TEXT NULL,
    `nonce_hash` VARCHAR(64) NULL,
    `electron_challenge` VARCHAR(86) NULL,
    `return_path` VARCHAR(255) NOT NULL DEFAULT '/',
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_customer_oauth_transactions_state_hash`(`state_hash`),
    INDEX `idx_customer_oauth_transactions_expires`(`expires_at`),
    INDEX `idx_customer_oauth_transactions_consumed`(`consumed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_oauth_handoffs` (
    `id` VARCHAR(191) NOT NULL,
    `customer_account_id` VARCHAR(191) NOT NULL,
    `code_hash` VARCHAR(64) NOT NULL,
    `verifier_challenge` VARCHAR(86) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `uq_customer_oauth_handoffs_code_hash`(`code_hash`),
    INDEX `idx_customer_oauth_handoffs_customer`(`customer_account_id`),
    INDEX `idx_customer_oauth_handoffs_expires`(`expires_at`),
    INDEX `idx_customer_oauth_handoffs_used`(`used_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

-- CreateTable
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
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `record_source` ENUM('CATALOG', 'IMPORT', 'TEST_FIXTURE', 'INTERNAL') NOT NULL DEFAULT 'CATALOG',
    `data_quality_status` ENUM('APPROVED', 'NEEDS_REVIEW', 'REJECTED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    `is_storefront_visible` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_categories_name`(`name`),
    UNIQUE INDEX `uq_categories_slug`(`slug`),
    INDEX `idx_categories_is_active`(`is_active`),
    INDEX `idx_categories_storefront_quality`(`is_storefront_visible`, `data_quality_status`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `active_image_asset_id` VARCHAR(191) NULL,
    `sku` VARCHAR(80) NOT NULL,
    `barcode` VARCHAR(80) NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` VARCHAR(255) NULL,
    `image_url` VARCHAR(2048) NULL,
    `brand` VARCHAR(120) NULL,
    `variant` VARCHAR(120) NULL,
    `size_value` DECIMAL(10, 3) NULL,
    `size_unit` ENUM('MILLILITER', 'LITER', 'GRAM', 'KILOGRAM', 'PIECE') NULL,
    `unit` ENUM('PIECE', 'PACK', 'BOX', 'BOTTLE', 'SACHET', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER') NOT NULL DEFAULT 'PIECE',
    `cost_price` DECIMAL(10, 2) NULL,
    `selling_price` DECIMAL(10, 2) NOT NULL,
    `reorder_level` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `target_stock_level` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `status` ENUM('ACTIVE', 'INACTIVE', 'DISCONTINUED') NOT NULL DEFAULT 'ACTIVE',
    `record_source` ENUM('CATALOG', 'IMPORT', 'TEST_FIXTURE', 'INTERNAL') NOT NULL DEFAULT 'CATALOG',
    `data_quality_status` ENUM('APPROVED', 'NEEDS_REVIEW', 'REJECTED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    `is_storefront_visible` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_products_active_image_asset`(`active_image_asset_id`),
    UNIQUE INDEX `uq_products_sku`(`sku`),
    UNIQUE INDEX `uq_products_barcode`(`barcode`),
    INDEX `idx_products_category_status`(`category_id`, `status`),
    INDEX `idx_products_name`(`name`),
    INDEX `idx_products_status_created`(`status`, `created_at`),
    INDEX `idx_products_storefront_quality`(`is_storefront_visible`, `data_quality_status`, `status`),
    INDEX `idx_products_source_quality`(`record_source`, `data_quality_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_barcodes` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `barcode` VARCHAR(80) NOT NULL,
    `type` ENUM('MANUFACTURER', 'INTERNAL') NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `source` ENUM('MANUAL', 'IMPORT', 'RECEIVING_SCAN', 'SYSTEM_INTERNAL', 'VERIFIED_BOOTSTRAP', 'MIGRATION') NOT NULL,
    `registered_by_id` VARCHAR(191) NULL,
    `source_reference` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_product_barcodes_barcode`(`barcode`),
    INDEX `idx_product_barcodes_product_primary`(`product_id`, `is_primary`),
    INDEX `idx_product_barcodes_product_type`(`product_id`, `type`),
    INDEX `idx_product_barcodes_source_created`(`source`, `created_at`),
    INDEX `idx_product_barcodes_registered_by`(`registered_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_image_assets` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quality_status` ENUM('APPROVED', 'NEEDS_REVIEW', 'REJECTED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    `processing_status` ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `original_storage_key` VARCHAR(500) NOT NULL,
    `processed_storage_key` VARCHAR(500) NULL,
    `card_storage_key` VARCHAR(500) NULL,
    `pdp_storage_key` VARCHAR(500) NULL,
    `source_mime_type` VARCHAR(80) NOT NULL,
    `source_bytes` INTEGER UNSIGNED NOT NULL,
    `source_width` INTEGER UNSIGNED NULL,
    `source_height` INTEGER UNSIGNED NULL,
    `diagnostics` JSON NULL,
    `processing_version` VARCHAR(40) NOT NULL DEFAULT 'ciqe-v1',
    `approved_at` DATETIME(3) NULL,
    `rejected_at` DATETIME(3) NULL,
    `superseded_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_image_assets_product_created`(`product_id`, `created_at`),
    INDEX `idx_product_image_assets_quality`(`product_id`, `quality_status`, `processing_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_reviews` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `reviewer_display_name` VARCHAR(120) NOT NULL,
    `rating` TINYINT UNSIGNED NOT NULL,
    `comment` VARCHAR(1000) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    CONSTRAINT `chk_product_reviews_rating` CHECK (`rating` BETWEEN 1 AND 5),

    INDEX `idx_product_reviews_product_created`(`product_id`, `created_at`),
    INDEX `idx_product_reviews_product_rating_created`(`product_id`, `rating`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_aliases` (
    `id` VARCHAR(191) NOT NULL,
    `canonical_product_id` VARCHAR(191) NOT NULL,
    `type` ENUM('RAW_NAME', 'SKU', 'BARCODE', 'SUPPLIER_CODE') NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `normalized_value` VARCHAR(255) NOT NULL,
    `record_source` ENUM('CATALOG', 'IMPORT', 'TEST_FIXTURE', 'INTERNAL') NOT NULL DEFAULT 'IMPORT',
    `source_reference` VARCHAR(255) NULL,
    `evidence` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_alias_lookup`(`type`, `normalized_value`),
    UNIQUE INDEX `uq_product_alias_identity`(`canonical_product_id`, `type`, `normalized_value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_canonical_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `source_product_id` VARCHAR(191) NOT NULL,
    `canonical_product_id` VARCHAR(191) NOT NULL,
    `match_type` ENUM('BARCODE', 'SKU', 'SUPPLIER_CODE', 'NORMALIZED_IDENTITY', 'MANUAL_REVIEW') NOT NULL,
    `action` ENUM('MAPPED', 'MERGED') NOT NULL DEFAULT 'MAPPED',
    `reason` VARCHAR(500) NOT NULL,
    `evidence` JSON NOT NULL,
    `automated` BOOLEAN NOT NULL DEFAULT false,
    `approved_by` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_product_mapping_source`(`source_product_id`),
    INDEX `idx_product_mapping_canonical`(`canonical_product_id`),
    INDEX `idx_product_mapping_match_action`(`match_type`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_duplicate_candidates` (
    `id` VARCHAR(191) NOT NULL,
    `left_product_id` VARCHAR(191) NOT NULL,
    `right_product_id` VARCHAR(191) NOT NULL,
    `match_type` ENUM('BARCODE', 'SKU', 'SUPPLIER_CODE', 'NORMALIZED_IDENTITY', 'MANUAL_REVIEW') NOT NULL,
    `confidence` DECIMAL(5, 4) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `evidence` JSON NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'REJECTED', 'MERGED') NOT NULL DEFAULT 'PENDING',
    `resolved_by` VARCHAR(191) NULL,
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_product_duplicate_status_confidence`(`status`, `confidence`),
    INDEX `idx_product_duplicate_right`(`right_product_id`),
    UNIQUE INDEX `uq_product_duplicate_pair`(`left_product_id`, `right_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sarima_source_product_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `source_key` VARCHAR(80) NOT NULL,
    `source_product_id` VARCHAR(40) NOT NULL,
    `canonical_product_id` VARCHAR(191) NOT NULL,
    `source_dataset` VARCHAR(160) NOT NULL,
    `source_product_name` VARCHAR(160) NOT NULL,
    `source_category` VARCHAR(160) NOT NULL,
    `source_selling_price` DECIMAL(10, 2) NOT NULL,
    `historical_month_count` INTEGER UNSIGNED NOT NULL,
    `historical_start_period` VARCHAR(7) NOT NULL,
    `historical_end_period` VARCHAR(7) NOT NULL,
    `total_historical_units` INTEGER UNSIGNED NOT NULL,
    `confidence` ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
    `evidence` JSON NOT NULL,
    `approved_by` VARCHAR(191) NULL,
    `approved_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_sarima_source_mapping_key`(`source_key`),
    UNIQUE INDEX `uq_sarima_source_mapping_product`(`source_product_id`),
    UNIQUE INDEX `uq_sarima_source_mapping_canonical`(`canonical_product_id`),
    INDEX `idx_sarima_source_mapping_confidence`(`confidence`, `approved_at`),
    INDEX `idx_sarima_source_mapping_dataset_product`(`source_dataset`, `source_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `catalog_audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(80) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `canonical_product_id` VARCHAR(191) NULL,
    `action` VARCHAR(80) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `evidence` JSON NULL,
    `automated` BOOLEAN NOT NULL DEFAULT false,
    `actor` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_catalog_audit_entity_created`(`entity_type`, `entity_id`, `created_at`),
    INDEX `idx_catalog_audit_canonical_created`(`canonical_product_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quantity_on_hand` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `last_stock_updated_at` DATETIME(3) NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_inventory_product`(`product_id`),
    INDEX `idx_inventory_quantity_on_hand`(`quantity_on_hand`),
    INDEX `idx_inventory_last_stock_updated_at`(`last_stock_updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_batches` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `batch_code` VARCHAR(80) NOT NULL,
    `quantity_received` INTEGER UNSIGNED NOT NULL,
    `quantity_remaining` INTEGER UNSIGNED NOT NULL,
    `unit_cost` DECIMAL(10, 2) NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATE NULL,
    `status` ENUM('AVAILABLE', 'LOW_STOCK', 'DEPLETED', 'EXPIRED', 'REMOVED') NOT NULL DEFAULT 'AVAILABLE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_inventory_batches_product_status`(`product_id`, `status`),
    INDEX `idx_inventory_batches_product_expiry`(`product_id`, `expires_at`),
    INDEX `idx_inventory_batches_expires_at`(`expires_at`),
    UNIQUE INDEX `uq_inventory_batches_product_batch`(`product_id`, `batch_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `id` VARCHAR(191) NOT NULL,
    `inventory_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `performed_by_id` VARCHAR(191) NULL,
    `type` ENUM('STOCK_IN', 'SALE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN', 'RETURN_OUT', 'DAMAGE', 'EXPIRED', 'INITIAL_STOCK', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGED') NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `quantity_before` INTEGER UNSIGNED NOT NULL,
    `quantity_after` INTEGER UNSIGNED NOT NULL,
    `reason` VARCHAR(255) NULL,
    `reference_type` VARCHAR(80) NULL,
    `reference_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_inventory_movements_inventory_created`(`inventory_id`, `created_at`),
    INDEX `idx_inventory_movements_product_created`(`product_id`, `created_at`),
    INDEX `idx_inventory_movements_batch`(`batch_id`),
    INDEX `idx_inventory_movements_type_created`(`type`, `created_at`),
    INDEX `idx_inventory_movements_reference`(`reference_type`, `reference_id`),
    INDEX `idx_inventory_movements_performed_by`(`performed_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sales` (
    `id` VARCHAR(191) NOT NULL,
    `sale_number` VARCHAR(80) NOT NULL,
    `cashier_id` VARCHAR(191) NULL,
    `sale_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `subtotal_amount` DECIMAL(12, 2) NOT NULL,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('DRAFT', 'COMPLETED', 'VOIDED') NOT NULL DEFAULT 'COMPLETED',
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_sales_sale_number`(`sale_number`),
    INDEX `idx_sales_sale_date`(`sale_date`),
    INDEX `idx_sales_status_date`(`status`, `sale_date`),
    INDEX `idx_sales_cashier`(`cashier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sale_items` (
    `id` VARCHAR(191) NOT NULL,
    `sale_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_sale_items_sale`(`sale_id`),
    INDEX `idx_sale_items_product`(`product_id`),
    INDEX `idx_sale_items_batch`(`batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_cart_items` (
    `id` VARCHAR(191) NOT NULL,
    `customer_account_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_customer_cart_items_customer_updated`(`customer_account_id`, `updated_at`),
    INDEX `idx_customer_cart_items_product`(`product_id`),
    UNIQUE INDEX `uq_customer_cart_items_customer_product`(`customer_account_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_saved_addresses` (
    `customer_account_id` VARCHAR(191) NOT NULL,
    `address_line_1` VARCHAR(180) NOT NULL,
    `address_line_2` VARCHAR(180) NULL,
    `barangay` VARCHAR(120) NOT NULL,
    `city_municipality` VARCHAR(120) NOT NULL,
    `province_region` VARCHAR(120) NOT NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `country` VARCHAR(80) NOT NULL DEFAULT 'Philippines',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`customer_account_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_orders` (
    `id` VARCHAR(191) NOT NULL,
    `customer_account_id` VARCHAR(191) NULL,
    `order_number` VARCHAR(80) NOT NULL,
    `customer_name` VARCHAR(120) NOT NULL,
    `customer_email` VARCHAR(191) NULL,
    `customer_phone` VARCHAR(40) NOT NULL,
    `fulfillment_method` ENUM('STORE_PICKUP') NOT NULL DEFAULT 'STORE_PICKUP',
    `payment_method` ENUM('CASH_ON_PICKUP') NOT NULL DEFAULT 'CASH_ON_PICKUP',
    `status` ENUM('PENDING', 'CONFIRMED', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `subtotal_amount` DECIMAL(12, 2) NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `notes` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_customer_orders_order_number`(`order_number`),
    INDEX `idx_customer_orders_customer_created`(`customer_account_id`, `created_at`),
    INDEX `idx_customer_orders_status_created`(`status`, `created_at`),
    INDEX `idx_customer_orders_phone_created`(`customer_phone`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_order_items` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `unit_price` DECIMAL(10, 2) NOT NULL,
    `total_amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_customer_order_items_order`(`order_id`),
    INDEX `idx_customer_order_items_product`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_order_address_snapshots` (
    `order_id` VARCHAR(191) NOT NULL,
    `address_line_1` VARCHAR(180) NOT NULL,
    `address_line_2` VARCHAR(180) NULL,
    `barangay` VARCHAR(120) NOT NULL,
    `city_municipality` VARCHAR(120) NOT NULL,
    `province_region` VARCHAR(120) NOT NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `country` VARCHAR(80) NOT NULL DEFAULT 'Philippines',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`order_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forecast_records` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `generated_by_id` VARCHAR(191) NULL,
    `forecast_period_start` DATE NOT NULL,
    `forecast_period_end` DATE NOT NULL,
    `forecasted_demand` DECIMAL(12, 3) NOT NULL,
    `model_name` VARCHAR(80) NOT NULL DEFAULT 'SARIMA',
    `confidence_level` DECIMAL(5, 2) NULL,
    `confidence_notes` VARCHAR(255) NULL,
    `status` ENUM('PENDING', 'GENERATED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source_import_batch_id` VARCHAR(191) NULL,

    INDEX `idx_forecasts_product_generated`(`product_id`, `generated_at`),
    INDEX `idx_forecasts_status_generated`(`status`, `generated_at`),
    INDEX `idx_forecasts_generated_by`(`generated_by_id`),
    INDEX `idx_forecasts_source_import_batch`(`source_import_batch_id`),
    UNIQUE INDEX `uq_forecasts_product_period_model`(`product_id`, `forecast_period_start`, `forecast_period_end`, `model_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forecast_batch_cache` (
    `id` VARCHAR(191) NOT NULL,
    `source` ENUM('DATABASE', 'WORKBOOK_FALLBACK', 'EMPTY') NOT NULL,
    `source_version` VARCHAR(64) NOT NULL,
    `database_revision` VARCHAR(64) NOT NULL,
    `forecast_start_month` DATE NOT NULL,
    `status` ENUM('GENERATING', 'READY', 'FAILED', 'SUPERSEDED', 'EMPTY') NOT NULL DEFAULT 'GENERATING',
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `generated_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `duration_ms` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `total_product_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `successful_product_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `fallback_product_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `failed_product_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `error_code` VARCHAR(80) NULL,
    `generation_metadata` JSON NULL,
    `validation_metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_forecast_batches_active_status`(`is_active`, `status`),
    INDEX `idx_forecast_batches_source_version_month`(`source`, `source_version`, `forecast_start_month`, `status`),
    INDEX `idx_forecast_batches_status_started`(`status`, `started_at`),
    INDEX `idx_forecast_batches_generated`(`generated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forecast_product_results` (
    `id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NOT NULL,
    `source_product_id` VARCHAR(191) NOT NULL,
    `product_name` VARCHAR(160) NOT NULL,
    `category` VARCHAR(120) NOT NULL,
    `selling_price` DECIMAL(10, 2) NOT NULL,
    `result_status` VARCHAR(24) NOT NULL,
    `model_name` VARCHAR(40) NULL,
    `total_historical_2024` DECIMAL(14, 3) NOT NULL,
    `total_historical_2025` DECIMAL(14, 3) NOT NULL,
    `total_forecast_2026` DECIMAL(14, 3) NOT NULL,
    `growth_versus_2025` DECIMAL(14, 4) NULL,
    `current_month_forecast_quantity` DECIMAL(14, 3) NULL,
    `recent_historical_sales_total` DECIMAL(14, 3) NOT NULL,
    `twelve_month_forecast_total` DECIMAL(14, 3) NOT NULL,
    `forecast_variance_percentage` DECIMAL(14, 4) NULL,
    `warning_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `detail_payload` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_forecast_product_batch_name`(`batch_id`, `product_name`),
    INDEX `idx_forecast_product_batch_category_name`(`batch_id`, `category`, `product_name`),
    INDEX `idx_forecast_product_batch_total_forecast`(`batch_id`, `total_forecast_2026`),
    INDEX `idx_forecast_product_batch_current_forecast`(`batch_id`, `current_month_forecast_quantity`),
    INDEX `idx_forecast_product_batch_recent_sales`(`batch_id`, `recent_historical_sales_total`),
    INDEX `idx_forecast_product_batch_demand`(`batch_id`, `twelve_month_forecast_total`),
    INDEX `idx_forecast_product_batch_growth`(`batch_id`, `growth_versus_2025`),
    UNIQUE INDEX `uq_forecast_product_batch_source`(`batch_id`, `source_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historical_sales_import_batches` (
    `id` VARCHAR(191) NOT NULL,
    `batch_code` VARCHAR(80) NOT NULL,
    `original_file_name` VARCHAR(255) NOT NULL,
    `file_hash` VARCHAR(64) NOT NULL,
    `file_type` VARCHAR(16) NOT NULL,
    `file_size` INTEGER UNSIGNED NOT NULL,
    `import_mode` ENUM('APPEND_ONLY', 'REJECT_ON_OVERLAP', 'REPLACE_IMPORTED_OVERLAPS') NOT NULL DEFAULT 'APPEND_ONLY',
    `status` ENUM('PREVIEWED', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_SKIPS', 'FAILED', 'ROLLED_BACK') NOT NULL DEFAULT 'PREVIEWED',
    `total_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `valid_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `invalid_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `matched_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `unmatched_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `duplicate_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `overlap_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `pos_overlap_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `imported_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `skipped_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `replaced_rows` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `products_affected` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `forecast_refresh_status` ENUM('NOT_REQUIRED', 'PENDING', 'SUCCEEDED', 'FAILED') NOT NULL DEFAULT 'NOT_REQUIRED',
    `imported_by_user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `confirmed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `rolled_back_at` DATETIME(3) NULL,
    `rolled_back_by_user_id` VARCHAR(191) NULL,
    `rollback_reason` VARCHAR(500) NULL,
    `error_message` VARCHAR(500) NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `uq_historical_import_batch_code`(`batch_code`),
    INDEX `idx_historical_import_file_hash_status`(`file_hash`, `status`),
    INDEX `idx_historical_import_status_created`(`status`, `created_at`),
    INDEX `idx_historical_import_user_created`(`imported_by_user_id`, `created_at`),
    INDEX `idx_historical_import_rollback_user`(`rolled_back_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historical_monthly_sales` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `period` DATE NOT NULL,
    `quantity_sold` INTEGER UNSIGNED NOT NULL,
    `unit_price` DECIMAL(10, 2) NULL,
    `sales_amount` DECIMAL(12, 2) NULL,
    `source` ENUM('IMPORTED_HISTORICAL', 'POS_ACTUAL', 'DEVELOPMENT_FIXTURE') NOT NULL,
    `import_batch_id` VARCHAR(191) NULL,
    `active_key` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `replaces_record_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `invalidated_at` DATETIME(3) NULL,
    `invalidated_by_user_id` VARCHAR(191) NULL,
    `invalidation_reason` VARCHAR(500) NULL,

    UNIQUE INDEX `uq_historical_monthly_sales_active_key`(`active_key`),
    UNIQUE INDEX `uq_historical_monthly_sales_replaces`(`replaces_record_id`),
    INDEX `idx_historical_monthly_product_period_source_active`(`product_id`, `period`, `source`, `is_active`),
    INDEX `idx_historical_monthly_batch_active`(`import_batch_id`, `is_active`),
    INDEX `idx_historical_monthly_period_source_active`(`period`, `source`, `is_active`),
    INDEX `idx_historical_monthly_invalidated_by`(`invalidated_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historical_sales_import_rows` (
    `id` VARCHAR(191) NOT NULL,
    `import_batch_id` VARCHAR(191) NOT NULL,
    `row_number` INTEGER UNSIGNED NOT NULL,
    `raw_data` JSON NOT NULL,
    `normalized_sku` VARCHAR(80) NULL,
    `normalized_barcode` VARCHAR(80) NULL,
    `normalized_period` DATE NULL,
    `quantity_sold` INTEGER UNSIGNED NULL,
    `unit_price` DECIMAL(10, 2) NULL,
    `sales_amount` DECIMAL(12, 2) NULL,
    `status` ENUM('VALID', 'WARNING', 'INVALID', 'UNMATCHED', 'DUPLICATE', 'OVERLAP', 'IMPORTED', 'SKIPPED', 'REPLACED') NOT NULL,
    `error_code` VARCHAR(80) NULL,
    `error_message` VARCHAR(500) NULL,
    `warning_codes` JSON NULL,
    `matched_product_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_historical_import_rows_batch_status_row`(`import_batch_id`, `status`, `row_number`),
    INDEX `idx_historical_import_rows_product_period`(`matched_product_id`, `normalized_period`),
    UNIQUE INDEX `uq_historical_import_row_number`(`import_batch_id`, `row_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendation_records` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `forecast_record_id` VARCHAR(191) NULL,
    `generated_by_id` VARCHAR(191) NULL,
    `type` ENUM('RESTOCK', 'LOW_STOCK', 'OVERSTOCK', 'NEAR_EXPIRY', 'EXPIRY_RISK') NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `recommended_quantity` INTEGER UNSIGNED NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED') NOT NULL DEFAULT 'OPEN',
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_recommendations_product_severity`(`product_id`, `severity`),
    INDEX `idx_recommendations_type_status`(`type`, `status`),
    INDEX `idx_recommendations_forecast`(`forecast_record_id`),
    INDEX `idx_recommendations_generated_at`(`generated_at`),
    INDEX `idx_recommendations_generated_by`(`generated_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restock_orders` (
    `id` VARCHAR(191) NOT NULL,
    `order_number` VARCHAR(80) NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'AWAITING_DELIVERY', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `created_by_id` VARCHAR(191) NOT NULL,
    `approved_by_id` VARCHAR(191) NULL,
    `notes` VARCHAR(1000) NULL,
    `approved_at` DATETIME(3) NULL,
    `version` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_restock_orders_order_number`(`order_number`),
    INDEX `idx_restock_orders_status_created`(`status`, `created_at`),
    INDEX `idx_restock_orders_created_by`(`created_by_id`, `created_at`),
    INDEX `idx_restock_orders_approved_by`(`approved_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restock_order_lines` (
    `id` VARCHAR(191) NOT NULL,
    `restock_order_id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `recommendation_id` VARCHAR(191) NULL,
    `recommendation_source` ENUM('SARIMA', 'LOW_STOCK', 'TARGET_STOCK', 'MANUAL') NOT NULL DEFAULT 'MANUAL',
    `recommended_quantity` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `requested_quantity` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `received_quantity` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_selected` BOOLEAN NOT NULL DEFAULT true,
    `owner_override_reason` VARCHAR(500) NULL,
    `notes` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `idx_restock_order_lines_product`(`product_id`),
    INDEX `idx_restock_order_lines_recommendation`(`recommendation_id`),
    INDEX `idx_restock_order_lines_order_selected`(`restock_order_id`, `is_selected`),
    UNIQUE INDEX `uq_restock_order_lines_order_product`(`restock_order_id`, `product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `trusted_devices` ADD CONSTRAINT `trusted_devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_remembered_auth` ADD CONSTRAINT `customer_remembered_auth_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_social_identities` ADD CONSTRAINT `customer_social_identities_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_social_link_intents` ADD CONSTRAINT `customer_social_link_intents_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_oauth_handoffs` ADD CONSTRAINT `customer_oauth_handoffs_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_password_reset_tokens` ADD CONSTRAINT `customer_password_reset_tokens_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_sessions` ADD CONSTRAINT `customer_sessions_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_active_image_asset_id_fkey` FOREIGN KEY (`active_image_asset_id`) REFERENCES `product_image_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_barcodes` ADD CONSTRAINT `product_barcodes_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_barcodes` ADD CONSTRAINT `product_barcodes_registered_by_id_fkey` FOREIGN KEY (`registered_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_image_assets` ADD CONSTRAINT `product_image_assets_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reviews` ADD CONSTRAINT `product_reviews_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_aliases` ADD CONSTRAINT `product_aliases_canonical_product_id_fkey` FOREIGN KEY (`canonical_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_canonical_mappings` ADD CONSTRAINT `product_canonical_mappings_source_product_id_fkey` FOREIGN KEY (`source_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_canonical_mappings` ADD CONSTRAINT `product_canonical_mappings_canonical_product_id_fkey` FOREIGN KEY (`canonical_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_duplicate_candidates` ADD CONSTRAINT `product_duplicate_candidates_left_product_id_fkey` FOREIGN KEY (`left_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_duplicate_candidates` ADD CONSTRAINT `product_duplicate_candidates_right_product_id_fkey` FOREIGN KEY (`right_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sarima_source_product_mappings` ADD CONSTRAINT `sarima_source_product_mappings_canonical_product_id_fkey` FOREIGN KEY (`canonical_product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `catalog_audit_logs` ADD CONSTRAINT `catalog_audit_logs_canonical_product_id_fkey` FOREIGN KEY (`canonical_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory` ADD CONSTRAINT `inventory_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_inventory_id_fkey` FOREIGN KEY (`inventory_id`) REFERENCES `inventory`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_performed_by_id_fkey` FOREIGN KEY (`performed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_cashier_id_fkey` FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_cart_items` ADD CONSTRAINT `customer_cart_items_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_cart_items` ADD CONSTRAINT `customer_cart_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_saved_addresses` ADD CONSTRAINT `customer_saved_addresses_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_orders` ADD CONSTRAINT `customer_orders_customer_account_id_fkey` FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_order_items` ADD CONSTRAINT `customer_order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `customer_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_order_items` ADD CONSTRAINT `customer_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_order_address_snapshots` ADD CONSTRAINT `customer_order_address_snapshots_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `customer_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forecast_records` ADD CONSTRAINT `forecast_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forecast_records` ADD CONSTRAINT `forecast_records_generated_by_id_fkey` FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forecast_records` ADD CONSTRAINT `forecast_records_source_import_batch_id_fkey` FOREIGN KEY (`source_import_batch_id`) REFERENCES `historical_sales_import_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forecast_product_results` ADD CONSTRAINT `forecast_product_results_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `forecast_batch_cache`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_sales_import_batches` ADD CONSTRAINT `historical_sales_import_batches_imported_by_user_id_fkey` FOREIGN KEY (`imported_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_sales_import_batches` ADD CONSTRAINT `historical_sales_import_batches_rolled_back_by_user_id_fkey` FOREIGN KEY (`rolled_back_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_monthly_sales` ADD CONSTRAINT `historical_monthly_sales_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_monthly_sales` ADD CONSTRAINT `historical_monthly_sales_import_batch_id_fkey` FOREIGN KEY (`import_batch_id`) REFERENCES `historical_sales_import_batches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_monthly_sales` ADD CONSTRAINT `historical_monthly_sales_invalidated_by_user_id_fkey` FOREIGN KEY (`invalidated_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_monthly_sales` ADD CONSTRAINT `historical_monthly_sales_replaces_record_id_fkey` FOREIGN KEY (`replaces_record_id`) REFERENCES `historical_monthly_sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_sales_import_rows` ADD CONSTRAINT `historical_sales_import_rows_import_batch_id_fkey` FOREIGN KEY (`import_batch_id`) REFERENCES `historical_sales_import_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historical_sales_import_rows` ADD CONSTRAINT `historical_sales_import_rows_matched_product_id_fkey` FOREIGN KEY (`matched_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_records` ADD CONSTRAINT `recommendation_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_records` ADD CONSTRAINT `recommendation_records_forecast_record_id_fkey` FOREIGN KEY (`forecast_record_id`) REFERENCES `forecast_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_records` ADD CONSTRAINT `recommendation_records_generated_by_id_fkey` FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restock_orders` ADD CONSTRAINT `restock_orders_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restock_orders` ADD CONSTRAINT `restock_orders_approved_by_id_fkey` FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restock_order_lines` ADD CONSTRAINT `restock_order_lines_restock_order_id_fkey` FOREIGN KEY (`restock_order_id`) REFERENCES `restock_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restock_order_lines` ADD CONSTRAINT `restock_order_lines_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `restock_order_lines` ADD CONSTRAINT `restock_order_lines_recommendation_id_fkey` FOREIGN KEY (`recommendation_id`) REFERENCES `recommendation_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
