-- Expand-first barcode identity migration.
-- products.barcode remains the backwards-compatible primary-barcode mirror during Sprint 9.
-- The new table owns durable many-to-one physical barcode identity and is globally unique by barcode.

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

-- Preserve every currently recognized barcode before readers switch to the alias table.
INSERT INTO `product_barcodes` (
    `id`,
    `product_id`,
    `barcode`,
    `type`,
    `is_primary`,
    `source`,
    `registered_by_id`,
    `source_reference`,
    `created_at`,
    `updated_at`
)
SELECT
    CONCAT('pbc_', LOWER(REPLACE(UUID(), '-', ''))),
    `id`,
    `barcode`,
    CASE WHEN `barcode` LIKE 'YSB-%' THEN 'INTERNAL' ELSE 'MANUFACTURER' END,
    true,
    'MIGRATION',
    NULL,
    'products.barcode',
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `products`
WHERE `barcode` IS NOT NULL;

ALTER TABLE `product_barcodes`
    ADD CONSTRAINT `fk_product_barcodes_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `product_barcodes`
    ADD CONSTRAINT `fk_product_barcodes_registered_by`
    FOREIGN KEY (`registered_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
