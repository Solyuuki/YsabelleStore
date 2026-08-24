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
  PRIMARY KEY (`id`),
  CONSTRAINT `product_image_assets_product_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `products`
  ADD COLUMN `active_image_asset_id` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `uq_products_active_image_asset`
  ON `products`(`active_image_asset_id`);

ALTER TABLE `products`
  ADD CONSTRAINT `products_active_image_asset_fkey`
  FOREIGN KEY (`active_image_asset_id`) REFERENCES `product_image_assets`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
