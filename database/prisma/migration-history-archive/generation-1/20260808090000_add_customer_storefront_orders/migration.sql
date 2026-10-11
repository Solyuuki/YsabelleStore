CREATE TABLE `customer_orders` (
  `id` VARCHAR(191) NOT NULL,
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
  INDEX `idx_customer_orders_status_created`(`status`, `created_at`),
  INDEX `idx_customer_orders_phone_created`(`customer_phone`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

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
  PRIMARY KEY (`id`),
  CONSTRAINT `customer_order_items_order_fkey` FOREIGN KEY (`order_id`) REFERENCES `customer_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `customer_order_items_product_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
