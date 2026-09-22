CREATE TABLE `customer_cart_items` (
  `id` VARCHAR(191) NOT NULL,
  `customer_account_id` VARCHAR(191) NOT NULL,
  `product_id` VARCHAR(191) NOT NULL,
  `quantity` INTEGER UNSIGNED NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `uq_customer_cart_items_customer_product`(`customer_account_id`, `product_id`),
  INDEX `idx_customer_cart_items_customer_updated`(`customer_account_id`, `updated_at`),
  INDEX `idx_customer_cart_items_product`(`product_id`),
  CONSTRAINT `fk_customer_cart_items_customer`
    FOREIGN KEY (`customer_account_id`) REFERENCES `customer_accounts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_customer_cart_items_product`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
