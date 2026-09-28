-- Category management foundation: standalone taxonomy + storefront cover lifecycle.

ALTER TABLE `categories`
  ADD COLUMN `active_cover_asset_id` VARCHAR(191) NULL,
  ADD COLUMN `cover_status` ENUM('MISSING', 'PROCESSING', 'NEEDS_REVIEW', 'READY', 'FAILED') NOT NULL DEFAULT 'MISSING',
  ADD COLUMN `cover_position` ENUM('LEFT', 'CENTER', 'RIGHT') NOT NULL DEFAULT 'CENTER',
  ADD UNIQUE INDEX `uq_categories_active_cover_asset`(`active_cover_asset_id`),
  ADD INDEX `idx_categories_cover_status`(`cover_status`),
  ADD INDEX `idx_categories_storefront_cover`(`is_storefront_visible`, `cover_status`, `is_active`);

CREATE TABLE `category_image_assets` (
  `id` VARCHAR(191) NOT NULL,
  `category_id` VARCHAR(191) NOT NULL,
  `quality_status` ENUM('APPROVED', 'NEEDS_REVIEW', 'REJECTED') NOT NULL DEFAULT 'NEEDS_REVIEW',
  `processing_status` ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `original_storage_key` VARCHAR(500) NOT NULL,
  `processed_storage_key` VARCHAR(500) NULL,
  `cover_storage_key` VARCHAR(500) NULL,
  `thumbnail_storage_key` VARCHAR(500) NULL,
  `source_mime_type` VARCHAR(80) NOT NULL,
  `source_bytes` INTEGER UNSIGNED NOT NULL,
  `source_width` INTEGER UNSIGNED NULL,
  `source_height` INTEGER UNSIGNED NULL,
  `diagnostics` JSON NULL,
  `processing_version` VARCHAR(40) NOT NULL DEFAULT 'category-cover-v1',
  `approved_at` DATETIME(3) NULL,
  `rejected_at` DATETIME(3) NULL,
  `superseded_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `idx_category_image_assets_category_created`(`category_id`, `created_at`),
  INDEX `idx_category_image_assets_quality`(`category_id`, `quality_status`, `processing_status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `category_image_assets`
  ADD CONSTRAINT `fk_category_image_assets_category`
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `categories`
  ADD CONSTRAINT `fk_categories_active_cover_asset`
  FOREIGN KEY (`active_cover_asset_id`) REFERENCES `category_image_assets`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE `system_canonical_state`
SET `schema_version` = 3,
    `release_id` = 'g2-s3-c5-a2'
WHERE `id` = 1;
