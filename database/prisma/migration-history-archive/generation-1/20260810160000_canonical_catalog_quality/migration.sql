-- AlterTable
ALTER TABLE `categories` ADD COLUMN `data_quality_status` ENUM('APPROVED', 'NEEDS_REVIEW', 'REJECTED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    ADD COLUMN `is_storefront_visible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `record_source` ENUM('CATALOG', 'IMPORT', 'TEST_FIXTURE', 'INTERNAL') NOT NULL DEFAULT 'CATALOG';

-- AlterTable
ALTER TABLE `products` ADD COLUMN `brand` VARCHAR(120) NULL,
    ADD COLUMN `data_quality_status` ENUM('APPROVED', 'NEEDS_REVIEW', 'REJECTED') NOT NULL DEFAULT 'NEEDS_REVIEW',
    ADD COLUMN `is_storefront_visible` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `record_source` ENUM('CATALOG', 'IMPORT', 'TEST_FIXTURE', 'INTERNAL') NOT NULL DEFAULT 'CATALOG',
    ADD COLUMN `size_unit` ENUM('MILLILITER', 'LITER', 'GRAM', 'KILOGRAM', 'PIECE') NULL,
    ADD COLUMN `size_value` DECIMAL(10, 3) NULL,
    ADD COLUMN `variant` VARCHAR(120) NULL;

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

-- CreateIndex
CREATE INDEX `idx_categories_storefront_quality` ON `categories`(`is_storefront_visible`, `data_quality_status`, `is_active`);

-- CreateIndex
CREATE INDEX `idx_products_storefront_quality` ON `products`(`is_storefront_visible`, `data_quality_status`, `status`);

-- CreateIndex
CREATE INDEX `idx_products_source_quality` ON `products`(`record_source`, `data_quality_status`);

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
ALTER TABLE `catalog_audit_logs` ADD CONSTRAINT `catalog_audit_logs_canonical_product_id_fkey` FOREIGN KEY (`canonical_product_id`) REFERENCES `products`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
