-- Sprint 12: persist verified product-line membership without merging product IDs.
-- Existing SKUs, barcodes, prices, batches, and inventory remain independent.
CREATE TABLE `product_families` (
    `id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(120) NOT NULL,
    `canonical_name` VARCHAR(160) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `idx_product_families_identity`(`brand`, `canonical_name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product_family_aliases` (
    `id` VARCHAR(191) NOT NULL,
    `family_id` VARCHAR(191) NOT NULL,
    `alias` VARCHAR(160) NOT NULL,
    `normalized_alias` VARCHAR(160) NOT NULL,
    `source_reference` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `uq_product_family_alias_identity`(`family_id`, `normalized_alias`),
    INDEX `idx_product_family_alias_lookup`(`normalized_alias`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `products` ADD COLUMN `family_id` VARCHAR(191) NULL;
CREATE INDEX `idx_products_family_status` ON `products`(`family_id`, `status`);
ALTER TABLE `products` ADD CONSTRAINT `products_family_id_fkey`
  FOREIGN KEY (`family_id`) REFERENCES `product_families`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `product_family_aliases` ADD CONSTRAINT `product_family_aliases_family_id_fkey`
  FOREIGN KEY (`family_id`) REFERENCES `product_families`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- This mapping is narrowly verified. Never backfill generic variant aliases globally.
INSERT INTO `product_families` (`id`, `brand`, `canonical_name`, `created_at`, `updated_at`)
VALUES ('ysfam-gardenia-enriched-white', 'Gardenia', 'Enriched White Bread', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

INSERT INTO `product_family_aliases` (`id`, `family_id`, `alias`, `normalized_alias`, `source_reference`)
VALUES
  ('ysfam-gardenia-classic-alias', 'ysfam-gardenia-enriched-white', 'Classic Enriched White Bread', 'gardenia classic enriched white bread', 'verified-catalog-qa-2026-10-15'),
  ('ysfam-gardenia-enriched-alias', 'ysfam-gardenia-enriched-white', 'Enriched White Bread', 'gardenia enriched white bread', 'verified-catalog-qa-2026-10-15');

-- Only attach existing records when SKU AND observed identity/size agree.
UPDATE `products` SET `family_id` = 'ysfam-gardenia-enriched-white'
WHERE `sku` = 'YS-QA26-050' AND `family_id` IS NULL
  AND LOWER(TRIM(`brand`)) = 'gardenia'
  AND LOWER(TRIM(`variant`)) = 'classic enriched white'
  AND `size_unit` = 'GRAM' AND `size_value` = 400;

UPDATE `products` SET `family_id` = 'ysfam-gardenia-enriched-white'
WHERE `sku` = 'SARIMA-P022' AND `family_id` IS NULL
  AND LOWER(TRIM(`brand`)) = 'gardenia'
  AND LOWER(TRIM(`variant`)) = 'enriched white'
  AND `size_unit` = 'GRAM' AND `size_value` = 600;
