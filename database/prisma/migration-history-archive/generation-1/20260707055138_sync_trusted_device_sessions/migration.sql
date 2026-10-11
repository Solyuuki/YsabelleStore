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
    `expires_at` DATETIME(3) NOT NULL,
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
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_categories_name`(`name`),
    UNIQUE INDEX `uq_categories_slug`(`slug`),
    INDEX `idx_categories_is_active`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(80) NOT NULL,
    `barcode` VARCHAR(80) NULL,
    `name` VARCHAR(160) NOT NULL,
    `description` VARCHAR(255) NULL,
    `unit` ENUM('PIECE', 'PACK', 'BOX', 'BOTTLE', 'SACHET', 'KILOGRAM', 'GRAM', 'LITER', 'MILLILITER') NOT NULL DEFAULT 'PIECE',
    `cost_price` DECIMAL(10, 2) NOT NULL,
    `selling_price` DECIMAL(10, 2) NOT NULL,
    `reorder_level` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `target_stock_level` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `uq_products_sku`(`sku`),
    UNIQUE INDEX `uq_products_barcode`(`barcode`),
    INDEX `idx_products_category_active`(`category_id`, `is_active`),
    INDEX `idx_products_name`(`name`),
    INDEX `idx_products_barcode`(`barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_batches` (
    `id` VARCHAR(191) NOT NULL,
    `product_id` VARCHAR(191) NOT NULL,
    `batch_code` VARCHAR(80) NOT NULL,
    `quantity_received` INTEGER UNSIGNED NOT NULL,
    `quantity_remaining` INTEGER UNSIGNED NOT NULL,
    `unit_cost` DECIMAL(10, 2) NOT NULL,
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
    `product_id` VARCHAR(191) NOT NULL,
    `batch_id` VARCHAR(191) NULL,
    `performed_by_id` VARCHAR(191) NULL,
    `type` ENUM('STOCK_IN', 'STOCK_OUT', 'SALE', 'ADJUSTMENT', 'RETURN', 'EXPIRED', 'DAMAGED') NOT NULL,
    `quantity` INTEGER UNSIGNED NOT NULL,
    `reason` VARCHAR(255) NULL,
    `reference_type` VARCHAR(80) NULL,
    `reference_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idx_inventory_movements_product_created`(`product_id`, `created_at`),
    INDEX `idx_inventory_movements_batch`(`batch_id`),
    INDEX `idx_inventory_movements_type_created`(`type`, `created_at`),
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

    INDEX `idx_forecasts_product_generated`(`product_id`, `generated_at`),
    INDEX `idx_forecasts_status_generated`(`status`, `generated_at`),
    INDEX `idx_forecasts_generated_by`(`generated_by_id`),
    UNIQUE INDEX `uq_forecasts_product_period_model`(`product_id`, `forecast_period_start`, `forecast_period_end`, `model_name`),
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

-- AddForeignKey
ALTER TABLE `trusted_devices` ADD CONSTRAINT `trusted_devices_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE `forecast_records` ADD CONSTRAINT `forecast_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `forecast_records` ADD CONSTRAINT `forecast_records_generated_by_id_fkey` FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_records` ADD CONSTRAINT `recommendation_records_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_records` ADD CONSTRAINT `recommendation_records_forecast_record_id_fkey` FOREIGN KEY (`forecast_record_id`) REFERENCES `forecast_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_records` ADD CONSTRAINT `recommendation_records_generated_by_id_fkey` FOREIGN KEY (`generated_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
