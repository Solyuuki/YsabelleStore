-- Preserve approved SARIMA workbook identities independently of catalog-to-catalog mappings.
-- Existing product, historical-sales, forecast, inventory, and POS rows are retained.

ALTER TABLE `products`
    MODIFY `cost_price` DECIMAL(10, 2) NULL;

CREATE TABLE `sarima_source_product_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `source_key` VARCHAR(80) NOT NULL,
    `source_product_id` VARCHAR(40) NOT NULL,
    `canonical_product_id` VARCHAR(191) NOT NULL,
    `source_dataset` VARCHAR(160) NOT NULL,
    `source_product_name` VARCHAR(160) NOT NULL,
    `source_category` VARCHAR(160) NOT NULL,
    `source_selling_price` DECIMAL(10, 2) NOT NULL,
    `historical_month_count` INT UNSIGNED NOT NULL,
    `historical_start_period` VARCHAR(7) NOT NULL,
    `historical_end_period` VARCHAR(7) NOT NULL,
    `total_historical_units` INT UNSIGNED NOT NULL,
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

ALTER TABLE `sarima_source_product_mappings`
    ADD CONSTRAINT `sarima_source_product_mappings_canonical_product_id_fkey`
    FOREIGN KEY (`canonical_product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
