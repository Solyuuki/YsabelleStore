-- Sprint 10 Phase 4: Restock Order persistence foundation.
-- Restock orders represent procurement intent only. They never create physical inventory.

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

    UNIQUE INDEX `uq_restock_order_lines_order_product`(`restock_order_id`, `product_id`),
    INDEX `idx_restock_order_lines_product`(`product_id`),
    INDEX `idx_restock_order_lines_recommendation`(`recommendation_id`),
    INDEX `idx_restock_order_lines_order_selected`(`restock_order_id`, `is_selected`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `restock_orders`
    ADD CONSTRAINT `fk_restock_orders_created_by`
    FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `restock_orders`
    ADD CONSTRAINT `fk_restock_orders_approved_by`
    FOREIGN KEY (`approved_by_id`) REFERENCES `users`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `restock_order_lines`
    ADD CONSTRAINT `fk_restock_order_lines_order`
    FOREIGN KEY (`restock_order_id`) REFERENCES `restock_orders`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `restock_order_lines`
    ADD CONSTRAINT `fk_restock_order_lines_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `restock_order_lines`
    ADD CONSTRAINT `fk_restock_order_lines_recommendation`
    FOREIGN KEY (`recommendation_id`) REFERENCES `recommendation_records`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
